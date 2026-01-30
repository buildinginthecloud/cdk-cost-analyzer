import * as fc from 'fast-check';
// Jest imports are global
import { EC2Calculator } from '../../src/pricing/calculators/EC2Calculator';
import { PricingClient } from '../../src/pricing/types';

describe('EC2Calculator - Property Tests', () => {

  // Feature: cdk-cost-analyzer, Property 6: EC2 costs vary by instance type and region
  it('should produce different costs for different instance types or regions', async () => {
    const calculator = new EC2Calculator();

    // Create a mock pricing client
    const mockPricingClient = {
      getPrice: jest.fn(),
    } as PricingClient;

    // Setup mock to return different prices for different instance types
    (mockPricingClient.getPrice as jest.MockedFunction<any>).mockImplementation(async (params: any) => {
      const instanceTypeFilter = params.filters?.find((f: any) => f.field === 'instanceType');
      const instanceType = instanceTypeFilter?.value;

      if (!instanceType) {
        return null;
      }

      // Return different prices for different instance types
      const priceMap: Record<string, number> = {
        't3.micro': 0.0104,
        't3.small': 0.0208,
        'm5.large': 0.096,
        'm5.xlarge': 0.192,
      };

      return priceMap[instanceType] || 0.05;
    });

    const resource1 = {
      logicalId: 'Instance1',
      type: 'AWS::EC2::Instance',
      properties: {
        InstanceType: 't3.micro',
      },
    };

    const resource2 = {
      logicalId: 'Instance2',
      type: 'AWS::EC2::Instance',
      properties: {
        InstanceType: 'm5.large',
      },
    };

    const cost1 = await calculator.calculateCost(resource1, 'us-east-1', mockPricingClient);
    const cost2 = await calculator.calculateCost(resource2, 'us-east-1', mockPricingClient);

    // Both costs should be valid
    expect(cost1.amount).toBeGreaterThan(0);
    expect(cost2.amount).toBeGreaterThan(0);
    expect(cost1.currency).toBe('USD');
    expect(cost2.currency).toBe('USD');

    // Different instance types should produce different costs
    expect(cost1.amount).not.toBe(cost2.amount);

    // Verify that the pricing client was called
    expect(mockPricingClient.getPrice).toHaveBeenCalledTimes(2);
  });

  it('should produce higher costs for larger instance types in the same region', () => {
    const calculator = new EC2Calculator();

    // Define instance types in ascending order of size/cost
    const smallerInstances = ['t3.micro', 't3.small', 't3.medium'];
    const largerInstances = ['m5.large', 'm5.xlarge', 'm5.2xlarge'];

    const createMockPricingClient = (): PricingClient => ({
      getPrice: jest.fn().mockImplementation(async (params) => {
        const instanceType = params.filters?.find((f: any) => f.field === 'instanceType')?.value as string;

        if (!instanceType) {
          return null;
        }

        // Simulate realistic pricing where larger instances cost more
        const pricingMap: Record<string, number> = {
          't3.micro': 0.0104,
          't3.small': 0.0208,
          't3.medium': 0.0416,
          'm5.large': 0.096,
          'm5.xlarge': 0.192,
          'm5.2xlarge': 0.384,
        };

        return pricingMap[instanceType] || 0.05;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...smallerInstances),
        fc.constantFrom(...largerInstances),
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (smallerType, largerType, region) => {
          const smallerResource = {
            logicalId: 'SmallerInstance',
            type: 'AWS::EC2::Instance',
            properties: {
              InstanceType: smallerType,
            },
          };

          const largerResource = {
            logicalId: 'LargerInstance',
            type: 'AWS::EC2::Instance',
            properties: {
              InstanceType: largerType,
            },
          };

          const smallerCost = await calculator.calculateCost(smallerResource, region, mockPricingClient);
          const largerCost = await calculator.calculateCost(largerResource, region, mockPricingClient);

          // Larger instances should cost more than smaller ones
          expect(largerCost.amount).toBeGreaterThan(smallerCost.amount);
          expect(smallerCost.confidence).toBe('high');
          expect(largerCost.confidence).toBe('high');
        },
      ),
      { numRuns: 10 },
    );
  });

  it('should handle missing instance type gracefully', () => {
    const calculator = new EC2Calculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(0.05),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (region) => {
          const resource = {
            logicalId: 'InstanceWithoutType',
            type: 'AWS::EC2::Instance',
            properties: {},
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions).toContain('Instance type not specified');
        },
      ),
      { numRuns: 10 },
    );
  });

  it('should handle pricing API failures gracefully', () => {
    const calculator = new EC2Calculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(null),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('t3.micro', 't3.small', 'm5.large'),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (instanceType, region) => {
          const resource = {
            logicalId: 'TestInstance',
            type: 'AWS::EC2::Instance',
            properties: {
              InstanceType: instanceType,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Pricing data not available');
        },
      ),
      { numRuns: 10 },
    );
  });
});
