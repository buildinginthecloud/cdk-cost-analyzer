// Jest imports are global
import { ResourceWithId } from '../../../src/diff/types';
import { ALBCalculator } from '../../../src/pricing/calculators/ALBCalculator';
import { PricingClient } from '../../../src/pricing/types';

describe('ALBCalculator', () => {
  // Test utilities and mocks
  class MockPricingClient implements PricingClient {
    private hourlyRate: number | null = null;
    private lcuRate: number | null = null;
    private shouldThrowError: Error | null = null;

    setHourlyRate(rate: number | null): void {
      this.hourlyRate = rate;
    }

    setLCURate(rate: number | null): void {
      this.lcuRate = rate;
    }

    setError(error: Error): void {
      this.shouldThrowError = error;
    }

    reset(): void {
      this.hourlyRate = null;
      this.lcuRate = null;
      this.shouldThrowError = null;
    }

    async getPrice(params: any): Promise<number | null> {
      if (this.shouldThrowError) {
        throw this.shouldThrowError;
      }

      const usageType = params.filters?.find((f: any) => f.field === 'usagetype')?.value;

      if (usageType?.includes('LoadBalancerUsage')) {
        return this.hourlyRate;
      } else if (usageType?.includes('LCUUsage')) {
        return this.lcuRate;
      }

      return null;
    }
  }

  // Test resource factory
  const createApplicationLoadBalancer = (properties?: Partial<any>): ResourceWithId => ({
    logicalId: 'TestALB',
    type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    properties: {
      Type: 'application',
      ...properties,
    },
  });

  const createNetworkLoadBalancer = (): ResourceWithId => ({
    logicalId: 'TestNLB',
    type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    properties: {
      Type: 'network',
    },
  });

  const createGenericResource = (type: string): ResourceWithId => ({
    logicalId: 'TestResource',
    type,
    properties: {},
  });

  describe('supports', () => {
    const calculator = new ALBCalculator();

    it('should support AWS::ElasticLoadBalancingV2::LoadBalancer', () => {
      expect(calculator.supports('AWS::ElasticLoadBalancingV2::LoadBalancer')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
      expect(calculator.supports('AWS::RDS::DBInstance')).toBe(false);
      expect(calculator.supports('')).toBe(false);
    });
  });

  describe('canCalculate', () => {
    const calculator = new ALBCalculator();

    it('should return true for application load balancers', () => {
      const resource = createApplicationLoadBalancer();
      expect(calculator.canCalculate(resource)).toBe(true);
    });

    it('should return false for network load balancers', () => {
      const resource = createNetworkLoadBalancer();
      expect(calculator.canCalculate(resource)).toBe(false);
    });

    it('should return false for resources without Type property', () => {
      const resource = createApplicationLoadBalancer();
      delete resource.properties.Type;
      expect(calculator.canCalculate(resource)).toBe(false);
    });

    it('should return false for unsupported resource types', () => {
      const resource = createGenericResource('AWS::S3::Bucket');
      expect(calculator.canCalculate(resource)).toBe(false);
    });

    it('should return false for gateway load balancers', () => {
      const resource = {
        logicalId: 'TestGLB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Type: 'gateway',
        },
      };
      expect(calculator.canCalculate(resource)).toBe(false);
    });
  });

  describe('calculateCost', () => {
    let calculator: ALBCalculator;
    let mockPricingClient: MockPricingClient;

    beforeEach(() => {
      calculator = new ALBCalculator();
      mockPricingClient = new MockPricingClient();
    });

    describe('default parameters', () => {
      it('should use default values when no custom parameters provided', async () => {
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeGreaterThan(0);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('medium');

        // Verify default assumptions are included
        expect(result.assumptions.some(a => a.includes('25'))).toBe(true); // Default new connections
        expect(result.assumptions.some(a => a.includes('3000'))).toBe(true); // Default active connections
        expect(result.assumptions.some(a => a.includes('100'))).toBe(true); // Default processed bytes
      });

      it('should calculate cost with realistic default values', async () => {
        // Test with realistic AWS ALB pricing for eu-central-1
        mockPricingClient.setHourlyRate(0.0225); // $0.0225/hour
        mockPricingClient.setLCURate(0.008); // $0.008/LCU/hour

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        // Expected calculation with defaults:
        // Hourly cost: 0.0225 * 730 = 16.425
        // LCU calculations:
        // - New connections: 25/25 = 1 LCU
        // - Active connections: 3000/3000 = 1 LCU
        // - Processed bytes: 100/730 = 0.137 LCU
        // Max LCU: 1 LCU/hour
        // LCU cost: 0.008 * 1 * 730 = 5.84
        // Total: 16.425 + 5.84 = 22.265
        expect(result.amount).toBeCloseTo(22.265, 2);
        expect(result.confidence).toBe('medium');
      });
    });

    describe('custom parameters', () => {
      it('should use custom parameters when provided', async () => {
        const customCalculator = new ALBCalculator(100, 5000, 200);
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeGreaterThan(0);
        expect(result.confidence).toBe('medium');

        // Verify custom assumptions are included
        expect(result.assumptions.some(a => a.includes('100'))).toBe(true); // Custom new connections
        expect(result.assumptions.some(a => a.includes('5000'))).toBe(true); // Custom active connections
        expect(result.assumptions.some(a => a.includes('200'))).toBe(true); // Custom processed bytes
      });

      it('should calculate higher cost with higher custom parameters', async () => {
        const defaultCalculator = new ALBCalculator();
        const highUsageCalculator = new ALBCalculator(1000, 50000, 1000);

        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();

        const defaultResult = await defaultCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);
        const highUsageResult = await highUsageCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(highUsageResult.amount).toBeGreaterThan(defaultResult.amount);
        expect(highUsageResult.confidence).toBe('medium');
      });
    });

    describe('LCU calculations', () => {
      it('should calculate LCU from new connections correctly', async () => {
        // 100 connections/sec = 4 LCU (100/25)
        const lcuCalculator = new ALBCalculator(100, 1, 1);
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await lcuCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // With 100 new connections/sec, should get 4 LCU from new connections
        // This should be the highest LCU value
        // LCU cost: 0.008 * 4 * 730 = 23.36
        // Hourly cost: 0.0225 * 730 = 16.425
        // Total: 16.425 + 23.36 = 39.785
        expect(result.amount).toBeCloseTo(39.785, 2);
        expect(result.assumptions.some(a => a.includes('100/sec'))).toBe(true);
      });

      it('should calculate LCU from active connections correctly', async () => {
        // 12000 active connections/min = 4 LCU (12000/3000)
        const lcuCalculator = new ALBCalculator(1, 12000, 1);
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await lcuCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // With 12000 active connections/min, should get 4 LCU from active connections
        expect(result.amount).toBeCloseTo(39.785, 2);
        expect(result.assumptions.some(a => a.includes('12000/min'))).toBe(true);
      });

      it('should calculate LCU from processed bytes correctly', async () => {
        // 2920 GB/month = 4 GB/hour (2920/730) = 4 LCU
        const lcuCalculator = new ALBCalculator(1, 1, 2920);
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await lcuCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // With 2920 GB/month (4 GB/hour), should get 4 LCU from processed bytes
        expect(result.amount).toBeCloseTo(39.785, 2);
        expect(result.assumptions.some(a => a.includes('2920 GB/month'))).toBe(true);
      });

      it('should use maximum LCU value for billing', async () => {
        // Set up scenario where processed bytes gives highest LCU
        const lcuCalculator = new ALBCalculator(50, 1000, 2920); // bytes: 4 LCU, connections: much less
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await lcuCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Processed bytes: 2920/730 = 4 LCU (highest)
        // New connections: 50/25 = 2 LCU
        // Active connections: 1000/3000 = 0.33 LCU
        // Should use 4 LCU for billing
        expect(result.amount).toBeCloseTo(39.785, 2);
      });
    });

    describe('cost calculation mathematics', () => {
      it('should calculate hourly cost correctly', async () => {
        mockPricingClient.setHourlyRate(0.05);
        mockPricingClient.setLCURate(0.0);

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Hourly cost: 0.05 * 730 = 36.5
        // LCU cost: 0 (rate is 0)
        // Total: 36.5
        expect(result.amount).toBeCloseTo(36.5, 2);
        expect(result.assumptions.some(a => a.includes('Hourly rate: $0.0500/hour × 730 hours = $36.50/month'))).toBe(true);
      });

      it('should calculate LCU cost correctly', async () => {
        mockPricingClient.setHourlyRate(0.0);
        mockPricingClient.setLCURate(0.01);

        const lcuCalculator = new ALBCalculator(100, 1, 1); // 4 LCU from new connections
        const resource = createApplicationLoadBalancer();
        const result = await lcuCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Hourly cost: 0
        // LCU cost: 0.01 * 4 * 730 = 29.2
        // Total: 29.2
        expect(result.amount).toBeCloseTo(29.2, 2);
        expect(result.assumptions.some(a => a.includes('LCU cost: $0.0100/LCU/hour × 4.00 LCU × 730 hours = $29.20/month'))).toBe(true);
      });

      it('should add hourly and LCU costs correctly', async () => {
        mockPricingClient.setHourlyRate(0.02);
        mockPricingClient.setLCURate(0.005);

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Hourly cost: 0.02 * 730 = 14.6
        // LCU cost: 0.005 * 1 * 730 = 3.65 (1 LCU from default 25 new conn/sec or 3000 active conn/min)
        // Total: 14.6 + 3.65 = 18.25
        expect(result.amount).toBeCloseTo(18.25, 1);
        expect(result.confidence).toBe('medium');
      });
    });

    describe('non-application load balancer handling', () => {
      it('should return zero cost for network load balancer', () => {
        const resource = createNetworkLoadBalancer();
        const result = calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        return result.then(r => {
          expect(r.amount).toBe(0);
          expect(r.currency).toBe('USD');
          expect(r.confidence).toBe('unknown');
          expect(r.assumptions).toContain('This calculator only supports Application Load Balancers');
        });
      });

      it('should return zero cost for load balancer without Type property', async () => {
        const resource = createApplicationLoadBalancer();
        delete resource.properties.Type;

        mockPricingClient.setHourlyRate(null);
        mockPricingClient.setLCURate(null);

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('unknown');
        expect(result.assumptions[0]).toContain('Pricing data not available for Application Load Balancer in region us-east-1');
      });

      it('should return zero cost for unsupported resource types', () => {
        const resource = createGenericResource('AWS::S3::Bucket');

        // This test verifies the supports() method works correctly
        expect(calculator.supports(resource.type)).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should handle null hourly rate gracefully', async () => {
        mockPricingClient.setHourlyRate(null);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('unknown');
        expect(result.assumptions[0]).toContain('Pricing data not available for Application Load Balancer in region us-east-1');
      });

      it('should handle null LCU rate gracefully', async () => {
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(null);

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('unknown');
        expect(result.assumptions[0]).toContain('Pricing data not available for Application Load Balancer in region us-east-1');
      });

      it('should handle pricing client exceptions gracefully', async () => {
        mockPricingClient.setError(new Error('Network timeout'));

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('unknown');
        expect(result.assumptions[0]).toContain('Failed to fetch pricing: Network timeout');
      });

      it('should handle different types of errors', async () => {
        const errorTypes = [
          new Error('Connection refused'),
          new Error('Service unavailable'),
          new Error('Invalid region'),
        ];

        for (const error of errorTypes) {
          mockPricingClient.reset();
          mockPricingClient.setError(error);

          const resource = createApplicationLoadBalancer();
          const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

          expect(result.amount).toBe(0);
          expect(result.confidence).toBe('unknown');
          expect(result.assumptions[0]).toContain(`Failed to fetch pricing: ${error.message}`);
        }
      });
    });

    describe('successful calculation structure', () => {
      it('should return valid MonthlyCost structure for successful calculations', async () => {
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeGreaterThan(0);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('medium');
        expect(Array.isArray(result.assumptions)).toBe(true);
        expect(result.assumptions.length).toBeGreaterThan(0);

        // Should include detailed breakdown
        expect(result.assumptions.some(a => a.includes('Hourly rate:'))).toBe(true);
        expect(result.assumptions.some(a => a.includes('LCU consumption:'))).toBe(true);
        expect(result.assumptions.some(a => a.includes('LCU cost:'))).toBe(true);
        expect(result.assumptions.some(a => a.includes('Total:'))).toBe(true);
      });

      it('should include detailed cost breakdown in assumptions', async () => {
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        const resource = createApplicationLoadBalancer();
        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Verify detailed breakdown components
        const assumptions = result.assumptions.join(' ');
        expect(assumptions).toContain('730 hours');
        expect(assumptions).toContain('New connections:');
        expect(assumptions).toContain('Active connections:');
        expect(assumptions).toContain('Processed data:');
        expect(assumptions).toContain('/month');
      });
    });

    describe('region prefix mapping', () => {
      it('should use correct region prefix format with hyphen', async () => {
        mockPricingClient.setHourlyRate(0.0225);
        mockPricingClient.setLCURate(0.008);

        // Spy on the getPrice method to track calls
        const getPriceSpy = jest.spyOn(mockPricingClient, 'getPrice');

        const resource = createApplicationLoadBalancer();
        
        // Test eu-central-1 which should use EUC1-LoadBalancerUsage format
        await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        // Verify the pricing client was called with the correct format
        expect(getPriceSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.arrayContaining([
              expect.objectContaining({
                field: 'usagetype',
                value: 'EUC1-LoadBalancerUsage',
              }),
            ]),
          }),
        );
      });
    });
  });
});
