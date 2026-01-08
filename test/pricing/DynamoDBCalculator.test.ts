// Jest imports are global
import { DynamoDBCalculator } from '../../src/pricing/calculators/DynamoDBCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('DynamoDBCalculator', () => {
  const calculator = new DynamoDBCalculator();

  describe('supports', () => {
    it('should support AWS::DynamoDB::Table', () => {
      expect(calculator.supports('AWS::DynamoDB::Table')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    it('should calculate cost for on-demand billing mode', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('On-demand billing mode');
    });

    it('should calculate cost for provisioned billing mode', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PROVISIONED',
          ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 5,
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain('10 provisioned read capacity units');
      expect(result.assumptions).toContain('5 provisioned write capacity units');
    });

    it('should use default provisioned capacity when not specified', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.assumptions).toContain('5 provisioned read capacity units');
      expect(result.assumptions).toContain('5 provisioned write capacity units');
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PROVISIONED',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
