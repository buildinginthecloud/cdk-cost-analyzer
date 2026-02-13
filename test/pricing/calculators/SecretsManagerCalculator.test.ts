// Jest imports are global
import { SecretsManagerCalculator } from '../../../src/pricing/calculators/SecretsManagerCalculator';
import { PricingClient } from '../../../src/pricing/types';

describe('SecretsManagerCalculator', () => {
  const calculator = new SecretsManagerCalculator();

  describe('constructor', () => {
    it('should accept no parameters for default configuration', () => {
      const calc = new SecretsManagerCalculator();
      expect(calc).toBeInstanceOf(SecretsManagerCalculator);
    });

    it('should accept custom monthly API calls parameter', () => {
      const calc = new SecretsManagerCalculator(50_000);
      expect(calc).toBeInstanceOf(SecretsManagerCalculator);
    });

    it('should accept undefined parameter', () => {
      const calc = new SecretsManagerCalculator(undefined);
      expect(calc).toBeInstanceOf(SecretsManagerCalculator);
    });
  });

  describe('supports', () => {
    it('should support AWS::SecretsManager::Secret', () => {
      expect(calculator.supports('AWS::SecretsManager::Secret')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
      expect(calculator.supports('AWS::SNS::Topic')).toBe(false);
      expect(calculator.supports('AWS::SQS::Queue')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost with API pricing available', async () => {
      // Mock storage price: $0.40/month and API call price: $0.05/10K
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.40) // storage price
        .mockResolvedValueOnce(0.05); // API call price

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: $0.40 (storage) + (10,000 / 10,000) * $0.05 (API calls) = $0.45
      expect(result.amount).toBeCloseTo(0.45, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Secret storage: $0.40/month');
      expect(result.assumptions).toContain('API calls: 10,000 calls × $0.0500/10K = $0.05/month');
      expect(result.assumptions).toContain('Total: $0.45/month');
      expect(result.assumptions).toContain('No free tier for Secrets Manager');
    });

    it('should calculate cost with custom API call volume', async () => {
      const customCalculator = new SecretsManagerCalculator(50_000);

      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.40) // storage price
        .mockResolvedValueOnce(0.05); // API call price

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: $0.40 (storage) + (50,000 / 10,000) * $0.05 (API calls) = $0.65
      expect(result.amount).toBeCloseTo(0.65, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('API calls: 50,000 calls × $0.0500/10K = $0.25/month');
      expect(result.assumptions).toContain('Using custom API call volume from configuration');
    });

    it('should use fallback pricing when storage price is unavailable', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null) // storage price unavailable
        .mockResolvedValueOnce(0.05); // API call price available

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: $0.40 (fallback storage) + (10,000 / 10,000) * $0.05 (API calls) = $0.45
      expect(result.amount).toBeCloseTo(0.45, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain('Using fallback storage pricing (API unavailable)');
      expect(result.assumptions).toContain('Secret storage: $0.40/month');
    });

    it('should use fallback pricing when API call price is unavailable', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.40) // storage price available
        .mockResolvedValueOnce(null); // API call price unavailable

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: $0.40 (storage) + (10,000 / 10,000) * $0.05 (fallback API calls) = $0.45
      expect(result.amount).toBeCloseTo(0.45, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain('Using fallback API call pricing (API unavailable)');
      expect(result.assumptions).toContain('API calls: 10,000 calls × $0.0500/10K = $0.05/month');
    });

    it('should use fallback pricing when all prices are unavailable', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null) // storage price unavailable
        .mockResolvedValueOnce(null); // API call price unavailable

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain('Pricing data not available for Secrets Manager in region us-east-1');
      expect(result.assumptions).toContain('Would assume 10,000 API calls per month');
    });

    it('should handle zero API calls', async () => {
      const zeroCallsCalculator = new SecretsManagerCalculator(0);

      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.40) // storage price
        .mockResolvedValueOnce(0.05); // API call price

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await zeroCallsCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: $0.40 (storage) + (0 / 10,000) * $0.05 (API calls) = $0.40
      expect(result.amount).toBeCloseTo(0.40, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('API calls: 0 calls × $0.0500/10K = $0.00/month');
      expect(result.assumptions).toContain('Total: $0.40/month');
    });

    it('should handle API errors gracefully', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API connection failed'));

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain('Failed to calculate Secrets Manager cost: API connection failed');
    });

    it('should query pricing API with correct parameters', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.40)
        .mockResolvedValueOnce(0.05);

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Verify storage pricing query
      expect(mockPricingClient.getPrice).toHaveBeenNthCalledWith(1, {
        serviceCode: 'AWSSecretsManager',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'productFamily', value: 'Secret' },
          { field: 'group', value: 'SecretStorage' },
        ],
      });

      // Verify API call pricing query
      expect(mockPricingClient.getPrice).toHaveBeenNthCalledWith(2, {
        serviceCode: 'AWSSecretsManager',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'productFamily', value: 'Secret' },
          { field: 'group', value: 'SecretRotation' },
        ],
      });
    });

    it('should include informational assumptions about cross-region replication', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.40)
        .mockResolvedValueOnce(0.05);

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('Cross-region replication incurs additional costs (not calculated)');
    });

    it('should calculate cost for different regions correctly', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.42) // Different regional pricing
        .mockResolvedValueOnce(0.06);

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'eu-west-1', mockPricingClient);

      // Expected: $0.42 (storage) + (10,000 / 10,000) * $0.06 (API calls) = $0.48
      expect(result.amount).toBeCloseTo(0.48, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
    });

    it('should handle large API call volumes correctly', async () => {
      const largeVolumeCalculator = new SecretsManagerCalculator(1_000_000);

      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.40)
        .mockResolvedValueOnce(0.05);

      const resource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const result = await largeVolumeCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: $0.40 (storage) + (1,000,000 / 10,000) * $0.05 (API calls) = $5.40
      expect(result.amount).toBeCloseTo(5.40, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('API calls: 1,000,000 calls × $0.0500/10K = $5.00/month');
      expect(result.assumptions).toContain('Total: $5.40/month');
    });
  });
});
