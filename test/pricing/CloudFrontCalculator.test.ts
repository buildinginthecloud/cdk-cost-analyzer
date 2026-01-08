// Jest imports are global
import { CloudFrontCalculator } from '../../src/pricing/calculators/CloudFrontCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('CloudFrontCalculator', () => {
  let calculator: CloudFrontCalculator;
  let mockPricingClient: PricingClient;

  beforeEach(() => {
    calculator = new CloudFrontCalculator();
    mockPricingClient = {
      getPrice: jest.fn(),
    };
  });

  describe('supports', () => {
    it('should support AWS::CloudFront::Distribution', () => {
      expect(calculator.supports('AWS::CloudFront::Distribution')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost with default assumptions', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.085); // Data transfer price
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.0075); // Request price

      const resource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 100 GB of data transfer out to internet');
      expect(result.assumptions).toContain('Assumes 1,000,000 HTTP/HTTPS requests per month');
    });

    it('should use custom data transfer assumption', async () => {
      const customCalculator = new CloudFrontCalculator(500, undefined);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.085);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.0075);

      const resource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('Assumes 500 GB of data transfer out to internet');
      expect(result.assumptions).toContain('Using custom data transfer assumption: 500 GB from configuration');
    });

    it('should use custom request assumption', async () => {
      const customCalculator = new CloudFrontCalculator(undefined, 5000000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.085);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.0075);

      const resource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('Assumes 5,000,000 HTTP/HTTPS requests per month');
      expect(result.assumptions).toContain('Using custom request count assumption: 5,000,000 requests from configuration');
    });

    it('should handle missing pricing data', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

      const resource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available');
      expect(result.assumptions).toContain('Would assume 100 GB of data transfer out to internet');
      expect(result.assumptions).toContain('Would assume 1,000,000 HTTP/HTTPS requests per month');
    });

    it('should handle missing pricing data with custom assumptions', async () => {
      const customCalculator = new CloudFrontCalculator(500, 2000000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

      const resource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available');
      expect(result.assumptions).toContain('Would assume 500 GB of data transfer out to internet');
      expect(result.assumptions).toContain('Would assume 2,000,000 HTTP/HTTPS requests per month');
      expect(result.assumptions).toContain('Using custom data transfer assumption: 500 GB from configuration');
      expect(result.assumptions).toContain('Using custom request count assumption: 2,000,000 requests from configuration');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValueOnce(new Error('API Error'));

      const resource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });

    it('should calculate separate data transfer and request costs', async () => {
      const dataTransferPrice = 0.085;
      const requestPrice = 0.0075;
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(dataTransferPrice);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(requestPrice);

      const resource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Default: 100 GB data transfer + 1M requests
      const expectedDataTransferCost = 100 * dataTransferPrice;
      const expectedRequestCost = (1000000 / 10000) * requestPrice;
      const expectedTotal = expectedDataTransferCost + expectedRequestCost;

      expect(result.amount).toBeCloseTo(expectedTotal, 2);
    });
  });
});
