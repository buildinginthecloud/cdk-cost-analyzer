// Jest imports are global
import { EC2Calculator } from '../../src/pricing/calculators/EC2Calculator';
import { PricingClient } from '../../src/pricing/types';

describe('EC2Calculator', () => {
  const calculator = new EC2Calculator();

  describe('supports', () => {
    it('should support AWS::EC2::Instance', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
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

    it('should calculate cost for t3.micro instance', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0.0104 * 730); // 730 hours per month
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain('Assumes 730 hours per month (24/7 operation)');
      expect(result.assumptions).toContain('Assumes Linux OS, shared tenancy, on-demand pricing');
    });

    it('should calculate cost for m5.large instance', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.096);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {
          InstanceType: 'm5.large',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0.096 * 730);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain('Assumes 730 hours per month (24/7 operation)');
    });

    it('should calculate cost for us-east-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonEC2',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'instanceType', value: 't3.micro' },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');
    });

    it('should calculate cost for eu-central-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0116);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonEC2',
        region: 'EU (Frankfurt)',
        filters: [
          { field: 'instanceType', value: 't3.micro' },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');
    });

    it('should calculate cost for ap-southeast-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0116);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(resource, 'ap-southeast-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonEC2',
        region: 'Asia Pacific (Singapore)',
        filters: [
          { field: 'instanceType', value: 't3.micro' },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');
    });

    it('should handle missing instance type property', async () => {
      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain('Instance type not specified');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
