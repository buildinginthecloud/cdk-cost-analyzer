import { SNSCalculator } from '../../src/pricing/calculators/SNSCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('SNSCalculator', () => {
  const calculator = new SNSCalculator();

  describe('supports', () => {
    it('should support AWS::SNS::Topic', () => {
      expect(calculator.supports('AWS::SNS::Topic')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::SQS::Queue')).toBe(false);
    });
  });

  describe('calculateCost - basic publish costs', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = { getPrice: jest.fn() };
    });

    it('should calculate cost with default assumptions', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 1,000,000 publishes per month');
    });

    it('should apply free tier for first 1M publishes', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('free'))).toBe(true);
    });

    it('should charge for publishes beyond free tier', async () => {
      const customCalculator = new SNSCalculator(2000000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 2M publishes - 1M free = 1M billable at $0.50/million = $0.50
      expect(result.amount).toBeGreaterThan(0);
      expect(result.assumptions.some(a => a.includes('billable'))).toBe(true);
    });
  });

  describe('calculateCost - delivery costs', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = { getPrice: jest.fn() };
    });

    it('should calculate HTTP delivery costs', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.60);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('Assumes 1,000,000 HTTP/S deliveries per month');
    });

    it('should calculate email delivery costs when configured', async () => {
      const customCalculator = new SNSCalculator(1000000, 1000000, 100000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(2.00);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('email'))).toBe(true);
    });

    it('should calculate SMS delivery costs when configured', async () => {
      const customCalculator = new SNSCalculator(1000000, 1000000, 0, 10000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00645);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('SMS'))).toBe(true);
    });

    it('should calculate mobile push delivery costs when configured', async () => {
      const customCalculator = new SNSCalculator(1000000, 1000000, 0, 0, 500000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('mobile push'))).toBe(true);
    });
  });

  describe('calculateCost - custom usage assumptions', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = { getPrice: jest.fn() };
    });

    it('should use custom publish count from configuration', async () => {
      const customCalculator = new SNSCalculator(5000000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('Assumes 5,000,000 publishes per month');
      expect(result.assumptions.some(a => a.includes('custom publish count'))).toBe(true);
    });

    it('should use custom HTTP delivery count from configuration', async () => {
      const customCalculator = new SNSCalculator(undefined, 2000000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.60);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('Assumes 2,000,000 HTTP/S deliveries per month');
      expect(result.assumptions.some(a => a.includes('custom HTTP delivery'))).toBe(true);
    });
  });

  describe('calculateCost - error handling', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = { getPrice: jest.fn() };
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions.some(a => a.includes('not available'))).toBe(true);
    });

    it('should use fallback pricing when API unavailable with custom assumptions', async () => {
      const customCalculator = new SNSCalculator(2000000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Network error'));

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });

    it('should use fallback pricing on API error with custom assumptions', async () => {
      const customCalculator = new SNSCalculator(2000000);
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Timeout'));

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });
  });

  describe('calculateCost - edge cases', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = { getPrice: jest.fn() };
    });

    it('should handle zero usage', async () => {
      const customCalculator = new SNSCalculator(0, 0, 0, 0, 0);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
    });

    it('should handle unknown region gracefully', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'unknown-region', mockPricingClient);

      expect(result.currency).toBe('USD');
    });

    it('should handle very large usage values', async () => {
      const customCalculator = new SNSCalculator(1000000000, 1000000000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

      const resource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium');
    });
  });
});
