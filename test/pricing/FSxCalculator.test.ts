// Jest imports are global
import { FSxCalculator } from '../../src/pricing/calculators/FSxCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('FSxCalculator', () => {
  const mockPricingClient: PricingClient = {
    getPrice: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('supports', () => {
    const calculator = new FSxCalculator();

    it('should support AWS::FSx::FileSystem', () => {
      expect(calculator.supports('AWS::FSx::FileSystem')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EFS::FileSystem')).toBe(false);
      expect(calculator.supports('AWS::RDS::DBInstance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for WINDOWS filesystem with default storage', async () => {
      const calculator = new FSxCalculator();
      const resource = {
        logicalId: 'MyFSx',
        type: 'AWS::FSx::FileSystem',
        properties: {
          FileSystemType: 'WINDOWS',
          StorageCapacity: 32,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 32 GB * $0.013/GB = $0.416
      expect(result.amount).toBeCloseTo(0.416, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should calculate cost for LUSTRE filesystem', async () => {
      const calculator = new FSxCalculator();
      const resource = {
        logicalId: 'MyFSx',
        type: 'AWS::FSx::FileSystem',
        properties: {
          FileSystemType: 'LUSTRE',
          StorageCapacity: 1200,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 1200 GB * $0.145/GB = $174.00
      expect(result.amount).toBeCloseTo(174.0, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should default to WINDOWS when FileSystemType is not specified', async () => {
      const calculator = new FSxCalculator();
      const resource = {
        logicalId: 'MyFSx',
        type: 'AWS::FSx::FileSystem',
        properties: {
          StorageCapacity: 32,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 32 GB * $0.013/GB = $0.416 (Windows default)
      expect(result.amount).toBeCloseTo(0.416, 2);
      expect(result.assumptions).toContain('File system type: WINDOWS');
    });

    it('should use customStorageGB from constructor over resource property', async () => {
      const calculator = new FSxCalculator(500);
      const resource = {
        logicalId: 'MyFSx',
        type: 'AWS::FSx::FileSystem',
        properties: {
          FileSystemType: 'WINDOWS',
          StorageCapacity: 32,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 500 GB * $0.013/GB = $6.50 (custom storage from constructor)
      expect(result.amount).toBeCloseTo(6.5, 2);
      expect(result.assumptions).toContain('Storage capacity: 500 GB');
    });

    it('should use resource StorageCapacity when no custom constructor param', async () => {
      const calculator = new FSxCalculator();
      const resource = {
        logicalId: 'MyFSx',
        type: 'AWS::FSx::FileSystem',
        properties: {
          FileSystemType: 'WINDOWS',
          StorageCapacity: 256,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 256 GB * $0.013/GB = $3.328
      expect(result.amount).toBeCloseTo(3.328, 2);
      expect(result.assumptions).toContain('Storage capacity: 256 GB');
    });

    it('should default to 32 GB when no storage specified anywhere', async () => {
      const calculator = new FSxCalculator();
      const resource = {
        logicalId: 'MyFSx',
        type: 'AWS::FSx::FileSystem',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 32 GB * $0.013/GB = $0.416 (default)
      expect(result.amount).toBeCloseTo(0.416, 2);
      expect(result.assumptions).toContain('Storage capacity: 32 GB');
    });

    it('should NOT call mockPricingClient.getPrice', async () => {
      const calculator = new FSxCalculator();
      const resource = {
        logicalId: 'MyFSx',
        type: 'AWS::FSx::FileSystem',
        properties: {
          FileSystemType: 'LUSTRE',
          StorageCapacity: 100,
        },
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });
  });
});
