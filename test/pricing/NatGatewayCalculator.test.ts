// Jest imports are global
import { NatGatewayCalculator } from '../../src/pricing/calculators/NatGatewayCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('NatGatewayCalculator', () => {
  const testResource = {
    logicalId: 'TestNatGateway',
    type: 'AWS::EC2::NatGateway',
    properties: {},
  };

  describe('supports', () => {
    it('should support AWS::EC2::NatGateway', () => {
      const calculator = new NatGatewayCalculator();
      expect(calculator.supports('AWS::EC2::NatGateway')).toBe(true);
    });

    it('should not support other resource types', () => {
      const calculator = new NatGatewayCalculator();
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });
  });

  describe('pricing unavailable (lines 62-86)', () => {
    it('should return zero cost when hourly rate is null', async () => {
      const mockClient: PricingClient = {
        getPrice: jest.fn().mockImplementation(async (params) => {
          const usageType = params.filters?.find((f: any) => f.field === 'usagetype')?.value;
          if (usageType?.includes('Hours')) return null;
          if (usageType?.includes('Bytes')) return 0.045;
          return null;
        }),
      };

      const calculator = new NatGatewayCalculator();
      const result = await calculator.calculateCost(testResource, 'us-east-1', mockClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions.some(a => a.includes('not available'))).toBe(true);
    });

    it('should return zero cost when data processing rate is null', async () => {
      const mockClient: PricingClient = {
        getPrice: jest.fn().mockImplementation(async (params) => {
          const usageType = params.filters?.find((f: any) => f.field === 'usagetype')?.value;
          if (usageType?.includes('Hours')) return 0.045;
          if (usageType?.includes('Bytes')) return null;
          return null;
        }),
      };

      const calculator = new NatGatewayCalculator();
      const result = await calculator.calculateCost(testResource, 'eu-central-1', mockClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should include custom data processing message (lines 69-71)', async () => {
      const mockClient: PricingClient = {
        getPrice: jest.fn().mockResolvedValue(null),
      };

      const calculator = new NatGatewayCalculator(500);
      const result = await calculator.calculateCost(testResource, 'us-west-2', mockClient);

      expect(result.assumptions.some(a => a.includes('custom data processing'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('500 GB'))).toBe(true);
    });
  });

  describe('exception handling (lines 112-124)', () => {
    it('should handle Error exceptions', async () => {
      const mockClient: PricingClient = {
        getPrice: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      const calculator = new NatGatewayCalculator();
      const result = await calculator.calculateCost(testResource, 'us-east-1', mockClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
      expect(result.assumptions[0]).toContain('Network error');
    });

    it('should handle string exceptions', async () => {
      const mockClient: PricingClient = {
        getPrice: jest.fn().mockRejectedValue('String error'),
      };

      const calculator = new NatGatewayCalculator();
      const result = await calculator.calculateCost(testResource, 'eu-west-1', mockClient);

      expect(result.amount).toBe(0);
      expect(result.assumptions[0]).toContain('String error');
    });
  });
});
