// Jest imports are global
import { DocumentDBCalculator } from '../../src/pricing/calculators/DocumentDBCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('DocumentDBCalculator', () => {
  const calculator = new DocumentDBCalculator();

  describe('supports', () => {
    it('should support AWS::DocDB::DBCluster', () => {
      expect(calculator.supports('AWS::DocDB::DBCluster')).toBe(true);
    });

    it('should support AWS::DocDB::DBInstance', () => {
      expect(calculator.supports('AWS::DocDB::DBInstance')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::RDS::DBInstance')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::Neptune::DBInstance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return $0 for AWS::DocDB::DBCluster with high confidence', async () => {
      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::DocDB::DBCluster',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain(
        'DocumentDB cluster cost is calculated on individual AWS::DocDB::DBInstance resources',
      );
    });

    it('should calculate cost for DBInstance with mock API pricing', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.24);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::DocDB::DBInstance',
        properties: {
          DBInstanceClass: 'db.r6g.large',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Instance: 0.24 * 730 = 175.20, Storage: 100 * 0.10 = 10.00, Total: 185.20
      expect(result.amount).toBeCloseTo(185.2, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
    });

    it('should use fallback pricing when API returns null', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::DocDB::DBInstance',
        properties: {
          DBInstanceClass: 'db.r6g.large',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Fallback: 0.24 * 730 = 175.20, Storage: 100 * 0.10 = 10.00, Total: 185.20
      expect(result.amount).toBeCloseTo(185.2, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
    });

    it('should calculate cost correctly with a different mock API rate', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.48);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::DocDB::DBInstance',
        properties: {
          DBInstanceClass: 'db.r6g.xlarge',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Instance: 0.48 * 730 = 350.40, Storage: 100 * 0.10 = 10.00, Total: 360.40
      expect(result.amount).toBeCloseTo(360.4, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
    });

    it('should handle API error and return unknown confidence', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API timeout'));

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::DocDB::DBInstance',
        properties: {
          DBInstanceClass: 'db.r6g.large',
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
