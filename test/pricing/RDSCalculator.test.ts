// Jest imports are global
import { RDSCalculator } from '../../src/pricing/calculators/RDSCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('RDSCalculator', () => {
  const calculator = new RDSCalculator();

  describe('supports', () => {
    it('should support AWS::RDS::DBInstance', () => {
      expect(calculator.supports('AWS::RDS::DBInstance')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost for db.t3.micro instance class', async () => {
      // Mock pricing: $0.017 per hour for instance, $0.115 per GB-month for storage
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.017) // Instance pricing
        .mockResolvedValueOnce(0.115); // Storage pricing

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected calculation:
      // Instance cost: 0.017 * 730 = 12.41
      // Storage cost: 0.115 * 100 = 11.5
      // Total: 12.41 + 11.5 = 23.91
      expect(result.amount).toBeCloseTo(23.91, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain('Assumes 730 hours per month (24/7 operation)');
      expect(result.assumptions).toContain('Assumes 100 GB of General Purpose (gp2) storage');
      expect(result.assumptions).toContain('Assumes Single-AZ deployment');
    });

    it('should calculate cost for db.m5.large instance class', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.192)
        .mockResolvedValueOnce(0.115);

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.m5.large',
          Engine: 'postgres',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected calculation:
      // Instance cost: 0.192 * 730 = 140.16
      // Storage cost: 0.115 * 100 = 11.5
      // Total: 140.16 + 11.5 = 151.66
      expect(result.amount).toBeCloseTo(151.66, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
    });

    it('should calculate cost for db.r5.xlarge instance class', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.336)
        .mockResolvedValueOnce(0.115);

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.r5.xlarge',
          Engine: 'mysql',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected calculation:
      // Instance cost: 0.336 * 730 = 245.28
      // Storage cost: 0.115 * 100 = 11.5
      // Total: 245.28 + 11.5 = 256.78
      expect(result.amount).toBeCloseTo(256.78, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
    });

    it('should calculate cost for MySQL engine', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.017)
        .mockResolvedValueOnce(0.115);

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonRDS',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'instanceType', value: 'db.t3.micro' },
          { field: 'databaseEngine', value: 'MySQL' },
          { field: 'deploymentOption', value: 'Single-AZ' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');
    });

    it('should calculate cost for PostgreSQL engine', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.017)
        .mockResolvedValueOnce(0.115);

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'postgres',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonRDS',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'instanceType', value: 'db.t3.micro' },
          { field: 'databaseEngine', value: 'PostgreSQL' },
          { field: 'deploymentOption', value: 'Single-AZ' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');
    });

    it('should calculate cost for MariaDB engine', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.017)
        .mockResolvedValueOnce(0.115);

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mariadb',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonRDS',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'instanceType', value: 'db.t3.micro' },
          { field: 'databaseEngine', value: 'MariaDB' },
          { field: 'deploymentOption', value: 'Single-AZ' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');
    });

    it('should handle missing DBInstanceClass property', async () => {
      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          Engine: 'mysql',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain('DB instance class or engine not specified');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should handle missing Engine property', async () => {
      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain('DB instance class or engine not specified');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should handle missing both DBInstanceClass and Engine properties', async () => {
      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain('DB instance class or engine not specified');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should handle pricing data unavailable for instance', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null) // Instance pricing unavailable
        .mockResolvedValueOnce(0.115);

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available for instance class db.t3.micro');
    });

    it('should handle pricing data unavailable for storage', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.017)
        .mockResolvedValueOnce(null); // Storage pricing unavailable

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Should still calculate with instance cost only (storage defaults to 0)
      // Instance cost: 0.017 * 730 = 12.41
      expect(result.amount).toBeCloseTo(12.41, 2);
      expect(result.confidence).toBe('high');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API timeout'));

      const resource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'postgres',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
      expect(result.assumptions[0]).toContain('API timeout');
    });
  });
});
