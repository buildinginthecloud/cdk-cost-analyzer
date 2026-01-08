// Jest imports are global
import { S3Calculator } from '../../src/pricing/calculators/S3Calculator';
import { PricingClient } from '../../src/pricing/types';

describe('S3Calculator', () => {
  const calculator = new S3Calculator();

  describe('supports', () => {
    it('should support AWS::S3::Bucket', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost with default assumptions', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.023);

      const resource = {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        properties: {
          BucketName: 'my-test-bucket',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0.023 * 100); // 100 GB default storage
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 100 GB of standard storage');
      expect(result.assumptions).toContain('Does not include request costs or data transfer');
    });

    it('should calculate cost for us-east-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.023);

      const resource = {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonS3',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'storageClass', value: 'General Purpose' },
          { field: 'volumeType', value: 'Standard' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium');
    });

    it('should calculate cost for eu-central-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0245);

      const resource = {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonS3',
        region: 'EU (Frankfurt)',
        filters: [
          { field: 'storageClass', value: 'General Purpose' },
          { field: 'volumeType', value: 'Standard' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium');
    });

    it('should calculate cost for eu-west-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0235);

      const resource = {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'eu-west-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonS3',
        region: 'EU (Ireland)',
        filters: [
          { field: 'storageClass', value: 'General Purpose' },
          { field: 'volumeType', value: 'Standard' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium');
    });

    it('should calculate cost for ap-southeast-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.025);

      const resource = {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'ap-southeast-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonS3',
        region: 'Asia Pacific (Singapore)',
        filters: [
          { field: 'storageClass', value: 'General Purpose' },
          { field: 'volumeType', value: 'Standard' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium');
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Network timeout'));

      const resource = {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
