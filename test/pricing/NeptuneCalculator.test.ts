// Jest imports are global
import { NeptuneCalculator } from '../../src/pricing/calculators/NeptuneCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('NeptuneCalculator', () => {
  const calculator = new NeptuneCalculator();

  describe('supports', () => {
    it('should support AWS::Neptune::DBCluster', () => {
      expect(calculator.supports('AWS::Neptune::DBCluster')).toBe(true);
    });

    it('should support AWS::Neptune::DBInstance', () => {
      expect(calculator.supports('AWS::Neptune::DBInstance')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::RDS::DBInstance')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::DocDB::DBInstance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return $0 for AWS::Neptune::DBCluster with high confidence', async () => {
      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::Neptune::DBCluster',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain(
        'Neptune cluster cost is calculated on individual AWS::Neptune::DBInstance resources',
      );
    });

    it('should calculate cost for DBInstance with mock API pricing', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.348);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::Neptune::DBInstance',
        properties: {
          DBInstanceClass: 'db.r5.large',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Instance: 0.348 * 730 = 254.04, Storage: 100 * 0.10 = 10.00, Total: 264.04
      expect(result.amount).toBeCloseTo(264.04, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
    });

    it('should use fallback pricing when API returns null', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::Neptune::DBInstance',
        properties: {
          DBInstanceClass: 'db.r5.large',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Fallback: 0.348 * 730 = 254.04, Storage: 100 * 0.10 = 10.00, Total: 264.04
      expect(result.amount).toBeCloseTo(264.04, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
    });

    it('should handle API error and return unknown confidence', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API timeout'));

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::Neptune::DBInstance',
        properties: {
          DBInstanceClass: 'db.r5.large',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
      expect(result.assumptions[0]).toContain('API timeout');
    });
  });
});
