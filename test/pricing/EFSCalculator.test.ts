// Jest imports are global
import { EFSCalculator } from '../../src/pricing/calculators/EFSCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('EFSCalculator', () => {
  const calculator = new EFSCalculator();

  describe('supports', () => {
    it('should support AWS::EFS::FileSystem', () => {
      expect(calculator.supports('AWS::EFS::FileSystem')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
    });
  });

  describe('calculateCost - Standard Storage', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost with default assumptions for standard storage', async () => {
      // Mock Standard storage pricing: $0.30 per GB-month
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: 100 GB × $0.30/GB = $30.00
      expect(result.amount).toBeCloseTo(30.00, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('Standard storage'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('100 GB'))).toBe(true);
    });

    it('should calculate cost for eu-central-1 region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.33);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonEFS',
        region: 'EU (Frankfurt)',
        filters: [
          { field: 'productFamily', value: 'Storage' },
          { field: 'usagetype', value: 'EUC1-TimedStorage-ByteHrs' },
        ],
      });
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium');
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Should use fallback pricing: 100 GB × $0.30 = $30.00
      expect(result.amount).toBeCloseTo(30.00, 2);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Network timeout'));

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });

  describe('calculateCost - Infrequent Access Storage', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should detect lifecycle policy and calculate IA storage costs', async () => {
      const iaCalculator = new EFSCalculator(100, 50); // 50% in IA

      // Mock pricing responses
      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs') && !usageType?.includes('IA')) return 0.30;
        if (usageType?.includes('IATimedStorage')) return 0.016;
        if (usageType?.includes('IARequests')) return 0.01;
        return null;
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            { TransitionToIA: 'AFTER_30_DAYS' },
          ],
        },
      };

      const result = await iaCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: 50 GB Standard × $0.30 + 50 GB IA × $0.016 + 5 GB IA requests × $0.01
      // = $15.00 + $0.80 + $0.05 = $15.85
      expect(result.amount).toBeCloseTo(15.85, 2);
      expect(result.assumptions.some(a => a.includes('Standard storage'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('Infrequent Access storage'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('Lifecycle policy detected'))).toBe(true);
    });

    it('should not apply IA costs without lifecycle policy even with IA percentage configured', async () => {
      const iaCalculator = new EFSCalculator(100, 50); // 50% in IA configured

      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {}, // No lifecycle policy
      };

      const result = await iaCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Without lifecycle policy, all storage should be Standard
      expect(result.amount).toBeCloseTo(30.00, 2);
      expect(result.assumptions.some(a => a.includes('Infrequent Access storage'))).toBe(false);
    });

    it('should handle IA pricing unavailable with fallback', async () => {
      const iaCalculator = new EFSCalculator(100, 30); // 30% in IA

      // Only Standard pricing available
      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs') && !usageType?.includes('IA')) return 0.30;
        return null; // IA pricing unavailable
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            { TransitionToIA: 'AFTER_7_DAYS' },
          ],
        },
      };

      const result = await iaCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });
  });

  describe('calculateCost - Provisioned Throughput', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate provisioned throughput costs', async () => {
      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs')) return 0.30;
        if (usageType?.includes('ProvisionedTP')) return 6.00;
        return null;
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          ThroughputMode: 'provisioned',
          ProvisionedThroughputInMibps: 10,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: 100 GB × $0.30 + 10 MB/s × $6.00 = $30 + $60 = $90
      expect(result.amount).toBeCloseTo(90.00, 2);
      expect(result.assumptions.some(a => a.includes('Provisioned Throughput'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('10 MB/s'))).toBe(true);
    });

    it('should not calculate provisioned throughput for bursting mode', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          ThroughputMode: 'bursting',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Only storage cost
      expect(result.amount).toBeCloseTo(30.00, 2);
      expect(result.assumptions.some(a => a.includes('Provisioned Throughput'))).toBe(false);
    });

    it('should not calculate provisioned throughput without ProvisionedThroughputInMibps', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          ThroughputMode: 'provisioned',
          // Missing ProvisionedThroughputInMibps
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Only storage cost
      expect(result.amount).toBeCloseTo(30.00, 2);
      expect(result.assumptions.some(a => a.includes('Provisioned Throughput'))).toBe(false);
    });

    it('should handle provisioned throughput pricing unavailable with fallback', async () => {
      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs')) return 0.30;
        return null; // Provisioned throughput pricing unavailable
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          ThroughputMode: 'provisioned',
          ProvisionedThroughputInMibps: 5,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Should use fallback: 100 GB × $0.30 + 5 MB/s × $6.00 = $30 + $30 = $60
      expect(result.amount).toBeCloseTo(60.00, 2);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback Provisioned Throughput'))).toBe(true);
    });
  });

  describe('calculateCost - Custom Storage Size', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use custom storage size from configuration', async () => {
      const customCalculator = new EFSCalculator(500); // 500 GB storage

      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: 500 GB × $0.30 = $150.00
      expect(result.amount).toBeCloseTo(150.00, 2);
      expect(result.assumptions.some(a => a.includes('500 GB'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('custom storage size'))).toBe(true);
    });

    it('should use custom IA percentage from configuration', async () => {
      const customCalculator = new EFSCalculator(200, 75); // 200 GB, 75% IA

      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs') && !usageType?.includes('IA')) return 0.30;
        if (usageType?.includes('IATimedStorage')) return 0.016;
        if (usageType?.includes('IARequests')) return 0.01;
        return null;
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            { TransitionToIA: 'AFTER_14_DAYS' },
          ],
        },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: 50 GB Standard × $0.30 + 150 GB IA × $0.016 + 15 GB requests × $0.01
      // = $15.00 + $2.40 + $0.15 = $17.55
      expect(result.amount).toBeCloseTo(17.55, 2);
      expect(result.assumptions.some(a => a.includes('custom IA percentage'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('75%'))).toBe(true);
    });
  });

  describe('calculateCost - Combined Scenarios', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate all cost components together', async () => {
      const combinedCalculator = new EFSCalculator(100, 40); // 40% IA

      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs') && !usageType?.includes('IA')) return 0.30;
        if (usageType?.includes('IATimedStorage')) return 0.016;
        if (usageType?.includes('IARequests')) return 0.01;
        if (usageType?.includes('ProvisionedTP')) return 6.00;
        return null;
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            { TransitionToIA: 'AFTER_30_DAYS' },
          ],
          ThroughputMode: 'provisioned',
          ProvisionedThroughputInMibps: 5,
        },
      };

      const result = await combinedCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected:
      // Standard: 60 GB × $0.30 = $18.00
      // IA Storage: 40 GB × $0.016 = $0.64
      // IA Requests: 4 GB × $0.01 = $0.04
      // Provisioned: 5 MB/s × $6.00 = $30.00
      // Total: $48.68
      expect(result.amount).toBeCloseTo(48.68, 2);
      expect(result.confidence).toBe('medium');
    });

    it('should handle multiple lifecycle policies', async () => {
      const iaCalculator = new EFSCalculator(100, 25);

      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs') && !usageType?.includes('IA')) return 0.30;
        if (usageType?.includes('IATimedStorage')) return 0.016;
        if (usageType?.includes('IARequests')) return 0.01;
        return null;
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            { TransitionToIA: 'AFTER_30_DAYS' },
            { TransitionToPrimaryStorageClass: 'AFTER_1_ACCESS' },
          ],
        },
      };

      const result = await iaCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.assumptions.some(a => a.includes('Lifecycle policy detected'))).toBe(true);
    });
  });

  describe('calculateCost - Edge Cases', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle zero storage size', async () => {
      const zeroCalculator = new EFSCalculator(0);

      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await zeroCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
    });

    it('should handle 100% IA storage', async () => {
      const fullIACalculator = new EFSCalculator(100, 100);

      jest.mocked(mockPricingClient.getPrice).mockImplementation(async (params) => {
        const usageType = params.filters?.find(f => f.field === 'usagetype')?.value;
        if (usageType?.includes('TimedStorage-ByteHrs') && !usageType?.includes('IA')) return 0.30;
        if (usageType?.includes('IATimedStorage')) return 0.016;
        if (usageType?.includes('IARequests')) return 0.01;
        return null;
      });

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            { TransitionToIA: 'AFTER_7_DAYS' },
          ],
        },
      };

      const result = await fullIACalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: 0 GB Standard + 100 GB IA × $0.016 + 10 GB requests × $0.01
      // = $0 + $1.60 + $0.10 = $1.70
      expect(result.amount).toBeCloseTo(1.70, 2);
    });

    it('should handle empty properties', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(30.00, 2);
      expect(result.confidence).toBe('medium');
    });

    it('should handle undefined properties', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: undefined as any,
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle empty lifecycle policies array', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [],
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(30.00, 2);
      expect(result.assumptions.some(a => a.includes('Infrequent Access'))).toBe(false);
    });

    it('should handle lifecycle policy without TransitionToIA', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            { TransitionToPrimaryStorageClass: 'AFTER_1_ACCESS' },
          ],
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(30.00, 2);
      // No IA storage without TransitionToIA
      expect(result.assumptions.some(a => a.includes('Infrequent Access storage'))).toBe(false);
    });

    it('should handle string error in catch block', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue('String error');

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('String error');
    });
  });

  describe('calculateCost - Region Handling', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use correct region prefix for us-west-2', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.30);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-west-2', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'US West (Oregon)',
          filters: expect.arrayContaining([
            expect.objectContaining({ value: 'USW2-TimedStorage-ByteHrs' }),
          ]),
        }),
      );
    });

    it('should use correct region prefix for ap-southeast-1', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.36);

      const resource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      await calculator.calculateCost(resource, 'ap-southeast-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'Asia Pacific (Singapore)',
          filters: expect.arrayContaining([
            expect.objectContaining({ value: 'APS3-TimedStorage-ByteHrs' }),
          ]),
        }),
      );
    });
  });
});
