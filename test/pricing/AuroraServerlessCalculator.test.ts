import { AuroraServerlessCalculator } from '../../src/pricing/calculators/AuroraServerlessCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('AuroraServerlessCalculator', () => {
  const calculator = new AuroraServerlessCalculator();

  describe('supports', () => {
    it('should support AWS::RDS::DBCluster', () => {
      expect(calculator.supports('AWS::RDS::DBCluster')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::RDS::DBInstance')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('canCalculate', () => {
    it('should handle Serverless v2 clusters', () => {
      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: {
          ServerlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 8 },
        },
      };
      expect(calculator.canCalculate!(resource)).toBe(true);
    });

    it('should handle Serverless v1 clusters', () => {
      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: { EngineMode: 'serverless' },
      };
      expect(calculator.canCalculate!(resource)).toBe(true);
    });

    it('should not handle provisioned clusters', () => {
      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: { EngineMode: 'provisioned' },
      };
      expect(calculator.canCalculate!(resource)).toBe(false);
    });

    it('should not handle clusters without serverless properties', () => {
      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: {},
      };
      expect(calculator.canCalculate!(resource)).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate v2 cost with API pricing', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.12);

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: {
          ServerlessV2ScalingConfiguration: { MinCapacity: 1, MaxCapacity: 4 },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // avg ACU = (1+4)/2 = 2.5, compute = 2.5 * 730 * 0.12 = 219.00
      // storage = 100 * 0.10 = 10.00
      // io = 100 * 0.20 = 20.00
      // total = 249.00
      expect(result.amount).toBeCloseTo(249.00, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('Aurora Serverless v2'))).toBe(true);
    });

    it('should calculate v1 cost with fallback pricing', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: { EngineMode: 'serverless' },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // avg ACU = (0.5+16)/2 = 8.25, compute = 8.25 * 730 * 0.06 = 361.35
      // storage = 100 * 0.10 = 10.00
      // no io for v1
      // total = 371.35
      expect(result.amount).toBeCloseTo(371.35, 2);
      expect(result.assumptions.some(a => a.includes('Aurora Serverless v1'))).toBe(true);
    });

    it('should use custom ACU values', async () => {
      const customCalc = new AuroraServerlessCalculator(2, 8, 200);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.12);

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: {
          ServerlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 16 },
        },
      };

      const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

      // custom overrides: avg ACU = (2+8)/2 = 5, compute = 5 * 730 * 0.12 = 438.00
      // storage = 200 * 0.10 = 20.00, io = 20.00
      // total = 478.00
      expect(result.amount).toBeCloseTo(478.00, 2);
    });

    it('should handle API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValueOnce(new Error('API error'));

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::RDS::DBCluster',
        properties: {
          ServerlessV2ScalingConfiguration: { MinCapacity: 1, MaxCapacity: 4 },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
