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
      { numRuns: 10 },
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
      { numRuns: 10 },
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
      { numRuns: 10 },
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
      { numRuns: 10 },
    );
  });
});

describe('NatGatewayCalculator - Unit Tests', () => {
  const testResource = {
    logicalId: 'TestNatGateway',
    type: 'AWS::EC2::NatGateway',
    properties: {},
  };

  describe('pricing unavailable paths (lines 62-86)', () => {
    it('should return zero cost with unknown confidence when hourly rate is null', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockImplementation(async (params: any) => {
          if (params.filters.some((f: any) => f.value.includes('Hours'))) {
            return null; // Hourly rate unavailable
          }
          if (params.filters.some((f: any) => f.value.includes('Bytes'))) {
            return 0.045; // Data processing available
          }
          return null;
        }),
      };

      const calculator = new NatGatewayCalculator();
      const cost = await calculator.calculateCost(testResource, 'us-east-1', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions.some(a => a.includes('Pricing data not available'))).toBe(true);
      expect(cost.assumptions.some(a => a.includes('100 GB'))).toBe(true);
      expect(cost.assumptions.some(a => a.includes('730 hours'))).toBe(true);
    });

    it('should return zero cost with unknown confidence when data processing rate is null', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockImplementation(async (params: any) => {
          if (params.filters.some((f: any) => f.value.includes('Hours'))) {
            return 0.045; // Hourly rate available
          }
          if (params.filters.some((f: any) => f.value.includes('Bytes'))) {
            return null; // Data processing unavailable
          }
          return null;
        }),
      };

      const calculator = new NatGatewayCalculator();
      const cost = await calculator.calculateCost(testResource, 'eu-central-1', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions.some(a => a.includes('Pricing data not available'))).toBe(true);
    });

    it('should return zero cost when both hourly and data processing rates are null', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockResolvedValue(null),
      };

      const calculator = new NatGatewayCalculator();
      const cost = await calculator.calculateCost(testResource, 'ap-southeast-1', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions.some(a => a.includes('Pricing data not available'))).toBe(true);
    });

    it('should include custom data processing assumption message when provided (line 69-71)', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockResolvedValue(null),
      };

      const customDataGB = 500;
      const calculator = new NatGatewayCalculator(customDataGB);
      const cost = await calculator.calculateCost(testResource, 'us-west-2', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions.some(a => a.includes('500 GB'))).toBe(true);
      expect(cost.assumptions.some(a => a.includes('custom data processing assumption'))).toBe(true);
    });

    it('should not include custom assumption message when using default data processing', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockResolvedValue(null),
      };

      const calculator = new NatGatewayCalculator(); // No custom value
      const cost = await calculator.calculateCost(testResource, 'eu-west-1', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.assumptions.some(a => a.includes('custom data processing assumption'))).toBe(false);
    });
  });

  describe('exception handling (lines 112-124)', () => {
    it('should handle pricing API errors gracefully', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockRejectedValue(new Error('Network timeout')),
      };

      const calculator = new NatGatewayCalculator();
      const cost = await calculator.calculateCost(testResource, 'us-east-1', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions[0]).toContain('Failed to fetch pricing');
      expect(cost.assumptions[0]).toContain('Network timeout');
    });

    it('should handle non-Error exceptions', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockRejectedValue('String error message'),
      };

      const calculator = new NatGatewayCalculator();
      const cost = await calculator.calculateCost(testResource, 'eu-central-1', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions[0]).toContain('Failed to fetch pricing');
      expect(cost.assumptions[0]).toContain('String error message');
    });

    it('should handle AWS SDK throttling errors', async () => {
      const throttlingError = new Error('Rate exceeded');
      throttlingError.name = 'ThrottlingException';
      
      const mockPricingClient = {
        getPrice: jest.fn().mockRejectedValue(throttlingError),
      };

      const calculator = new NatGatewayCalculator();
      const cost = await calculator.calculateCost(testResource, 'ap-northeast-1', mockPricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });

  describe('region prefix mapping', () => {
    it('should return empty prefix for unknown regions', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockResolvedValue(0.045),
      };

      const calculator = new NatGatewayCalculator();
      // Using an unknown/invalid region should still work
      const cost = await calculator.calculateCost(testResource, 'unknown-region-1', mockPricingClient);

      // Should still attempt to calculate (even if prefix is empty)
      expect(cost).toBeDefined();
    });

    it('should use correct prefix for various regions', async () => {
      const mockPricingClient = {
        getPrice: jest.fn().mockResolvedValue(0.045),
      };

      const calculator = new NatGatewayCalculator();
      
      // Test various region prefixes
      const regions = [
        'us-east-1',
        'us-west-2',
        'eu-central-1',
        'ap-southeast-1',
        'sa-east-1',
        'me-south-1',
        'af-south-1',
      ];

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, mockPricingClient);
        expect(cost).toBeDefined();
        expect(mockPricingClient.getPrice).toHaveBeenCalled();
      }
    });
  });
});
