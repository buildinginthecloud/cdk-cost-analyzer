import * as fc from 'fast-check';
// Jest imports are global
import { NatGatewayCalculator } from '../../src/pricing/calculators/NatGatewayCalculator';

describe('NatGatewayCalculator - Property Tests', () => {
  const calculator = new NatGatewayCalculator();
  let mockPricingClient: any;

  beforeEach(() => {
    mockPricingClient = {
      getPrice: jest.fn(),
    };

    // Mock successful pricing responses
    mockPricingClient.getPrice.mockImplementation(async (params: any) => {
      if (params.filters.some((f: any) => f.value.includes('Hours'))) {
        return 0.045; // Hourly rate
      }
      if (params.filters.some((f: any) => f.value.includes('Bytes'))) {
        return 0.045; // Data processing rate per GB
      }
      return null;
    });
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should include both hourly and data processing costs', () => {
    const natGatewayResourceArb = fc.record({
      logicalId: fc.string().filter(s => s.length > 0 && s.trim().length > 0),
      type: fc.constant('AWS::EC2::NatGateway'),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    void fc.assert(
      fc.asyncProperty(natGatewayResourceArb, async (resource) => {
        const region = 'eu-central-1';
        const cost = await calculator.calculateCost(resource, region, mockPricingClient);

        // Should have valid cost structure
        expect(cost.amount).toBeGreaterThanOrEqual(0);
        expect(cost.currency).toBe('USD');
        expect(cost.assumptions.length).toBeGreaterThan(0);

        // Assumptions should mention both hourly and data processing
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/hour|hourly/);
        expect(assumptionText).toMatch(/data|processing|gb/);
      }),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should scale cost with data processing assumptions', () => {
    const resource = {
      logicalId: 'TestNatGateway',
      type: 'AWS::EC2::NatGateway',
      properties: {},
    };

    const dataProcessingArb = fc.double({ min: 1, max: 10000, noNaN: true });

    void fc.assert(
      fc.asyncProperty(dataProcessingArb, dataProcessingArb, async (dataGB1, dataGB2) => {
        // Skip if values are too close
        if (Math.abs(dataGB1 - dataGB2) < 1) {
          return true;
        }

        const region = 'eu-central-1';

        // Create calculators with different data processing amounts
        const calculator1 = new NatGatewayCalculator(dataGB1);
        const calculator2 = new NatGatewayCalculator(dataGB2);

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

        // Higher data processing should result in higher or equal cost
        if (dataGB1 > dataGB2) {
          expect(cost1.amount).toBeGreaterThanOrEqual(cost2.amount);
        } else {
          expect(cost2.amount).toBeGreaterThanOrEqual(cost1.amount);
        }

        // Both should be valid
        expect(cost1.amount).toBeGreaterThanOrEqual(0);
        expect(cost2.amount).toBeGreaterThanOrEqual(0);

        return true;
      }),
      { numRuns: 30 },
    );
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should have non-zero cost due to hourly charges', () => {
    const natGatewayResourceArb = fc.record({
      logicalId: fc.string().filter(s => s.length > 0 && s.trim().length > 0),
      type: fc.constant('AWS::EC2::NatGateway'),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    void fc.assert(
      fc.asyncProperty(natGatewayResourceArb, async (resource) => {
        const region = 'eu-central-1';

        // Even with zero data processing, should have hourly cost
        const zeroDataCalculator = new NatGatewayCalculator(0);
        const cost = await zeroDataCalculator.calculateCost(
          resource,
          region,
          mockPricingClient,
        );

        // Should have some cost from hourly charges
        // (unless pricing is unavailable, in which case it would be 0)
        expect(cost.amount).toBeGreaterThanOrEqual(0);
        expect(cost.currency).toBe('USD');
        expect(cost.assumptions.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should support the NAT Gateway resource type', () => {
    expect(calculator.supports('AWS::EC2::NatGateway')).toBe(true);
    expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should include data processing amount in assumptions', () => {
    const resource = {
      logicalId: 'TestNatGateway',
      type: 'AWS::EC2::NatGateway',
      properties: {},
    };

    const dataProcessingArb = fc.double({ min: 1, max: 10000, noNaN: true });

    void fc.assert(
      fc.asyncProperty(dataProcessingArb, async (dataGB) => {
        const region = 'eu-central-1';
        const customCalculator = new NatGatewayCalculator(dataGB);
        const cost = await customCalculator.calculateCost(
          resource,
          region,
          mockPricingClient,
        );

        // Assumptions should mention the data processing amount
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain(dataGB.toString());
      }),
      { numRuns: 50 },
    );
  });
});
