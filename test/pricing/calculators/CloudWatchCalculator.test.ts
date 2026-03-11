import {
  CloudWatchLogsCalculator,
  CloudWatchAlarmCalculator,
  CloudWatchDashboardCalculator,
} from '../../../src/pricing/calculators/CloudWatchCalculator';
import { PricingClient } from '../../../src/pricing/types';

describe('CloudWatchLogsCalculator', () => {
  const calculator = new CloudWatchLogsCalculator();

  describe('constructor', () => {
    it('should accept no parameters for default configuration', () => {
      const calc = new CloudWatchLogsCalculator();
      expect(calc).toBeInstanceOf(CloudWatchLogsCalculator);
    });

    it('should accept custom monthly ingestion GB', () => {
      const calc = new CloudWatchLogsCalculator(500);
      expect(calc).toBeInstanceOf(CloudWatchLogsCalculator);
    });
  });

  describe('supports', () => {
    it('should support AWS::Logs::LogGroup', () => {
      expect(calculator.supports('AWS::Logs::LogGroup')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::CloudWatch::Alarm')).toBe(false);
      expect(calculator.supports('AWS::CloudWatch::Dashboard')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
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
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.50) // ingestion price
        .mockResolvedValueOnce(0.03); // storage price

      const resource = {
        logicalId: 'AppLogGroup',
        type: 'AWS::Logs::LogGroup',
        properties: { RetentionInDays: 30 },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Ingestion: 10GB × $0.50 = $5.00
      // Storage: (10 × 30 / 30) = 10GB avg × $0.03 = $0.30
      // Total: $5.30
      expect(result.amount).toBeCloseTo(5.30, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Log ingestion: 10GB × $0.50/GB = $5.00/month');
      expect(result.assumptions).toContain('Does not include Logs Insights query costs');
    });

    it('should use 365 days when retention is never expire (0)', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.50)
        .mockResolvedValueOnce(0.03);

      const resource = {
        logicalId: 'AppLogGroup',
        type: 'AWS::Logs::LogGroup',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Storage: (10 × 365 / 30) = 121.67GB avg × $0.03 = $3.65
      // Ingestion: 10GB × $0.50 = $5.00
      // Total: $8.65
      expect(result.amount).toBeCloseTo(8.65, 1);
      expect(result.assumptions.some(a => a.includes('never expire'))).toBe(true);
    });

    it('should calculate with custom ingestion volume', async () => {
      const customCalculator = new CloudWatchLogsCalculator(100);

      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.50)
        .mockResolvedValueOnce(0.03);

      const resource = {
        logicalId: 'AppLogGroup',
        type: 'AWS::Logs::LogGroup',
        properties: { RetentionInDays: 7 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Ingestion: 100GB × $0.50 = $50.00
      // Storage: (100 × 7 / 30) = 23.33GB avg × $0.03 = $0.70
      // Total: $50.70
      expect(result.amount).toBeCloseTo(50.70, 1);
      expect(result.assumptions).toContain('Using custom log ingestion volume from configuration');
    });

    it('should use fallback pricing when API unavailable', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const resource = {
        logicalId: 'AppLogGroup',
        type: 'AWS::Logs::LogGroup',
        properties: { RetentionInDays: 30 },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(0, 0);
      expect(result.confidence).toBe('unknown');
    });

    it('should use partial fallback when only ingestion price unavailable', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null) // ingestion unavailable
        .mockResolvedValueOnce(0.03); // storage available

      const resource = {
        logicalId: 'AppLogGroup',
        type: 'AWS::Logs::LogGroup',
        properties: { RetentionInDays: 30 },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain('Using fallback ingestion pricing (API unavailable)');
    });

    it('should handle API errors gracefully', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API connection failed'));

      const resource = {
        logicalId: 'AppLogGroup',
        type: 'AWS::Logs::LogGroup',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain('Failed to calculate CloudWatch Logs cost: API connection failed');
    });

    it('should query pricing API with correct parameters', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.50)
        .mockResolvedValueOnce(0.03);

      const resource = {
        logicalId: 'AppLogGroup',
        type: 'AWS::Logs::LogGroup',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenNthCalledWith(1, {
        serviceCode: 'AmazonCloudWatch',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'productFamily', value: 'Data Payload' },
          { field: 'group', value: 'Ingestion' },
        ],
      });

      expect(mockPricingClient.getPrice).toHaveBeenNthCalledWith(2, {
        serviceCode: 'AmazonCloudWatch',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'productFamily', value: 'Storage Snapshot' },
        ],
      });
    });
  });
});

describe('CloudWatchAlarmCalculator', () => {
  const calculator = new CloudWatchAlarmCalculator();

  describe('supports', () => {
    it('should support AWS::CloudWatch::Alarm', () => {
      expect(calculator.supports('AWS::CloudWatch::Alarm')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::Logs::LogGroup')).toBe(false);
      expect(calculator.supports('AWS::CloudWatch::Dashboard')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate standard alarm cost', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.10);

      const resource = {
        logicalId: 'CPUAlarm',
        type: 'AWS::CloudWatch::Alarm',
        properties: { Period: 300 },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(0.10, 2);
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('standard'))).toBe(true);
    });

    it('should calculate high-resolution alarm cost (period < 60s)', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.10);

      const resource = {
        logicalId: 'HighResAlarm',
        type: 'AWS::CloudWatch::Alarm',
        properties: { Period: 10 },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // High-res = 3x standard = $0.30
      expect(result.amount).toBeCloseTo(0.30, 2);
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('high-resolution'))).toBe(true);
    });

    it('should default to 60s period when not specified', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.10);

      const resource = {
        logicalId: 'DefaultAlarm',
        type: 'AWS::CloudWatch::Alarm',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Default period = 60s = standard alarm
      expect(result.amount).toBeCloseTo(0.10, 2);
      expect(result.assumptions.some(a => a.includes('standard'))).toBe(true);
    });

    it('should handle multiple metrics', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.10);

      const resource = {
        logicalId: 'MultiMetricAlarm',
        type: 'AWS::CloudWatch::Alarm',
        properties: {
          Period: 60,
          Metrics: [
            { Id: 'm1', MetricStat: {} },
            { Id: 'm2', MetricStat: {} },
            { Id: 'e1', Expression: 'SUM(METRICS())' },
          ],
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 3 metrics × $0.10 = $0.30
      expect(result.amount).toBeCloseTo(0.30, 2);
    });

    it('should use fallback pricing when API unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

      const resource = {
        logicalId: 'FallbackAlarm',
        type: 'AWS::CloudWatch::Alarm',
        properties: { Period: 300 },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(0.10, 2);
      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain('Using fallback pricing (API unavailable)');
    });

    it('should handle API errors gracefully', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Timeout'));

      const resource = {
        logicalId: 'ErrorAlarm',
        type: 'AWS::CloudWatch::Alarm',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });
  });
});

describe('CloudWatchDashboardCalculator', () => {
  const calculator = new CloudWatchDashboardCalculator();

  describe('supports', () => {
    it('should support AWS::CloudWatch::Dashboard', () => {
      expect(calculator.supports('AWS::CloudWatch::Dashboard')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::CloudWatch::Alarm')).toBe(false);
      expect(calculator.supports('AWS::Logs::LogGroup')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate dashboard cost with API pricing', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(3.00);

      const resource = {
        logicalId: 'MyDashboard',
        type: 'AWS::CloudWatch::Dashboard',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(3.00, 2);
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain('CloudWatch dashboard: $3.00/month');
      expect(result.assumptions.some(a => a.includes('First 3 dashboards'))).toBe(true);
    });

    it('should use fallback pricing when API unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

      const resource = {
        logicalId: 'MyDashboard',
        type: 'AWS::CloudWatch::Dashboard',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(3.00, 2);
      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain('Using fallback pricing (API unavailable)');
    });

    it('should handle API errors gracefully', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Network error'));

      const resource = {
        logicalId: 'MyDashboard',
        type: 'AWS::CloudWatch::Dashboard',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should query pricing API with correct parameters', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(3.00);

      const resource = {
        logicalId: 'MyDashboard',
        type: 'AWS::CloudWatch::Dashboard',
        properties: {},
      };

      await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonCloudWatch',
        region: 'EU (Frankfurt)',
        filters: [
          { field: 'productFamily', value: 'Dashboard' },
        ],
      });
    });
  });
});
