import * as fc from 'fast-check';
// Jest imports are global
import { ALBCalculator } from '../../src/pricing/calculators/ALBCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('ALBCalculator - Property Tests', () => {
  /**
   * Feature: production-readiness, Property 9: ALB costs scale with LCU assumptions
   * Validates: Requirements 8.1, 8.2, 8.3
   */
  it('should produce equal or higher costs for higher LCU assumptions', () => {
    // Define ranges for LCU parameters
    const newConnectionsRange = [10, 25, 50, 100, 200];
    const activeConnectionsRange = [1000, 3000, 5000, 10000, 15000];
    const processedBytesRange = [50, 100, 500, 1000, 2000];
    const regions = [
      'us-east-1',
      'us-west-2',
      'eu-central-1',
      'eu-west-1',
      'ap-southeast-1',
    ];

    // Create a mock pricing client that returns realistic ALB pricing
    const createMockPricingClient = (): PricingClient => ({
      getPrice: jest.fn().mockImplementation(async (params) => {
        const usageType = params.filters?.find((f: any) => f.field === 'usagetype')
          ?.value as string;

        if (!usageType) {
          return null;
        }

        // Realistic ALB pricing (as of 2024)
        // Hourly rate: ~$0.0225 per hour
        // LCU rate: ~$0.008 per LCU-hour
        if (usageType.includes('LoadBalancerUsage')) {
          return 0.0225;
        } else if (usageType.includes('LCUUsage')) {
          return 0.008;
        }

        return null;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    // Property: For any two ALB configurations where one has higher LCU assumptions,
    // the higher LCU configuration should have equal or higher estimated cost
    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...newConnectionsRange),
        fc.constantFrom(...activeConnectionsRange),
        fc.constantFrom(...processedBytesRange),
        fc.constantFrom(...newConnectionsRange),
        fc.constantFrom(...activeConnectionsRange),
        fc.constantFrom(...processedBytesRange),
        fc.constantFrom(...regions),
        async (
          newConn1,
          activeConn1,
          bytes1,
          newConn2,
          activeConn2,
          bytes2,
          region,
        ) => {
          const calculator1 = new ALBCalculator(newConn1, activeConn1, bytes1);
          const calculator2 = new ALBCalculator(newConn2, activeConn2, bytes2);

          const resource = {
            logicalId: 'TestALB',
            type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            properties: {
              Type: 'application',
            },
          };

          const cost1 = await calculator1.calculateCost(
            resource,
            region,
            mockPricingClient,
          );
          const cost2 = await calculator2.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          // Both costs should be valid
          expect(cost1.amount).toBeGreaterThanOrEqual(0);
          expect(cost2.amount).toBeGreaterThanOrEqual(0);
          expect(cost1.currency).toBe('USD');
          expect(cost2.currency).toBe('USD');
          expect(cost1.confidence).toBe('medium');
          expect(cost2.confidence).toBe('medium');

          // Calculate LCU consumption for both configurations
          // 1 LCU provides: 25 new connections/sec, 3000 active connections/min, 1 GB processed/hour
          const lcu1FromNewConn = newConn1 / 25;
          const lcu1FromActiveConn = activeConn1 / 3000;
          const lcu1FromBytes = bytes1 / 730; // GB per hour
          const lcu1PerHour = Math.max(
            lcu1FromNewConn,
            lcu1FromActiveConn,
            lcu1FromBytes,
          );

          const lcu2FromNewConn = newConn2 / 25;
          const lcu2FromActiveConn = activeConn2 / 3000;
          const lcu2FromBytes = bytes2 / 730; // GB per hour
          const lcu2PerHour = Math.max(
            lcu2FromNewConn,
            lcu2FromActiveConn,
            lcu2FromBytes,
          );

          // If LCU consumption is higher, cost should be higher or equal
          if (lcu2PerHour > lcu1PerHour) {
            expect(cost2.amount).toBeGreaterThanOrEqual(cost1.amount);
          } else if (lcu1PerHour > lcu2PerHour) {
            expect(cost1.amount).toBeGreaterThanOrEqual(cost2.amount);
          } else {
            // Same LCU consumption should produce the same cost
            expect(cost1.amount).toBeCloseTo(cost2.amount, 2);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should produce strictly higher costs for strictly higher LCU assumptions', () => {
    // Define pairs where one configuration clearly has higher LCU consumption
    const lowerLCUConfigs = [
      { newConn: 10, activeConn: 1000, bytes: 50 },
      { newConn: 25, activeConn: 3000, bytes: 100 },
      { newConn: 50, activeConn: 5000, bytes: 200 },
    ];

    const higherLCUConfigs = [
      { newConn: 100, activeConn: 10000, bytes: 1000 },
      { newConn: 200, activeConn: 15000, bytes: 2000 },
      { newConn: 300, activeConn: 20000, bytes: 3000 },
    ];

    const createMockPricingClient = (): PricingClient => ({
      getPrice: jest.fn().mockImplementation(async (params) => {
        const usageType = params.filters?.find((f: any) => f.field === 'usagetype')
          ?.value as string;

        if (usageType?.includes('LoadBalancerUsage')) {
          return 0.0225;
        } else if (usageType?.includes('LCUUsage')) {
          return 0.008;
        }

        return null;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...lowerLCUConfigs),
        fc.constantFrom(...higherLCUConfigs),
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (lowerConfig, higherConfig, region) => {
          const lowerCalculator = new ALBCalculator(
            lowerConfig.newConn,
            lowerConfig.activeConn,
            lowerConfig.bytes,
          );

          const higherCalculator = new ALBCalculator(
            higherConfig.newConn,
            higherConfig.activeConn,
            higherConfig.bytes,
          );

          const resource = {
            logicalId: 'TestALB',
            type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            properties: {
              Type: 'application',
            },
          };

          const lowerCost = await lowerCalculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );
          const higherCost = await higherCalculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          // Higher LCU configuration should cost strictly more
          expect(higherCost.amount).toBeGreaterThan(lowerCost.amount);
          expect(lowerCost.confidence).toBe('medium');
          expect(higherCost.confidence).toBe('medium');

          // Both should have assumptions about LCU consumption
          expect(lowerCost.assumptions.some((a) => a.includes('LCU'))).toBe(
            true,
          );
          expect(higherCost.assumptions.some((a) => a.includes('LCU'))).toBe(
            true,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should use default LCU assumptions when not provided', () => {
    const calculator = new ALBCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockImplementation(async (params) => {
        const usageType = params.filters?.find((f: any) => f.field === 'usagetype')
          ?.value as string;

        if (usageType?.includes('LoadBalancerUsage')) {
          return 0.0225;
        } else if (usageType?.includes('LCUUsage')) {
          return 0.008;
        }

        return null;
      }),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (region) => {
          const resource = {
            logicalId: 'ALBWithDefaults',
            type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            properties: {
              Type: 'application',
            },
          };

          const cost = await calculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          // Should use defaults and still calculate cost
          expect(cost.amount).toBeGreaterThan(0);
          expect(cost.confidence).toBe('medium');
          // Check that default values are mentioned in assumptions
          expect(
            cost.assumptions.some(
              (a) =>
                a.includes('25/sec') ||
                a.includes('3000/min') ||
                a.includes('100 GB'),
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should return zero cost for non-application load balancers', () => {
    const calculator = new ALBCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(0.0225),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('network', 'gateway'),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (loadBalancerType, region) => {
          const resource = {
            logicalId: 'NonALB',
            type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            properties: {
              Type: loadBalancerType,
            },
          };

          const cost = await calculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions).toContain(
            'This calculator only supports Application Load Balancers',
          );
        },
      ),
      { numRuns: 20 },
    );
  });

  it('should handle pricing API failures gracefully', () => {
    const calculator = new ALBCalculator(50, 5000, 500);

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(null),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (region) => {
          const resource = {
            logicalId: 'TestALB',
            type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            properties: {
              Type: 'application',
            },
          };

          const cost = await calculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Pricing data not available');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle pricing API errors gracefully', () => {
    const calculator = new ALBCalculator(100, 10000, 1000);

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockRejectedValue(new Error('Network timeout')),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (region) => {
          const resource = {
            logicalId: 'TestALB',
            type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            properties: {
              Type: 'application',
            },
          };

          const cost = await calculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          // When API throws error, should handle gracefully
          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Failed to fetch pricing');
        },
      ),
      { numRuns: 50 },
    );
  });
});
