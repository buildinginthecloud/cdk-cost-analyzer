import { KinesisCalculator } from '../../src/pricing/calculators/KinesisCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('KinesisCalculator', () => {
  const calculator = new KinesisCalculator();

  describe('supports', () => {
    it('should support Kinesis resource types', () => {
      expect(calculator.supports('AWS::Kinesis::Stream')).toBe(true);
      expect(calculator.supports('AWS::KinesisFirehose::DeliveryStream')).toBe(true);
      expect(calculator.supports('AWS::KinesisAnalyticsV2::Application')).toBe(true);
    });

    it('should not support other resource types', () => {
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

    describe('Data Stream - Provisioned', () => {
      it('should calculate provisioned stream cost with API pricing', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.015);

        const resource = {
          logicalId: 'MyStream',
          type: 'AWS::Kinesis::Stream',
          properties: { ShardCount: 4 },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 4 shards × $0.015 × 730 = $43.80
        expect(result.amount).toBeCloseTo(43.80, 2);
        expect(result.confidence).toBe('high');
      });

      it('should use default shard count when not specified', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.015);

        const resource = {
          logicalId: 'MyStream',
          type: 'AWS::Kinesis::Stream',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 2 shards × $0.015 × 730 = $21.90
        expect(result.amount).toBeCloseTo(21.90, 2);
      });

      it('should use fallback pricing when API returns null', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

        const resource = {
          logicalId: 'MyStream',
          type: 'AWS::Kinesis::Stream',
          properties: { ShardCount: 2 },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(21.90, 2);
        expect(result.confidence).toBe('medium');
      });
    });

    describe('Data Stream - On-Demand', () => {
      it('should calculate on-demand stream cost', async () => {
        const resource = {
          logicalId: 'MyStream',
          type: 'AWS::Kinesis::Stream',
          properties: {
            StreamModeDetails: { StreamMode: 'ON_DEMAND' },
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 1000GB × $0.04 = $40 + 2000GB × $0.015 = $30 = $70
        expect(result.amount).toBeCloseTo(70.00, 2);
        expect(result.confidence).toBe('medium');
        expect(result.assumptions.some(a => a.includes('On-demand mode'))).toBe(true);
      });

      it('should use custom ingestion/retrieval values', async () => {
        const customCalc = new KinesisCalculator(undefined, 500, 1000);

        const resource = {
          logicalId: 'MyStream',
          type: 'AWS::Kinesis::Stream',
          properties: { StreamModeDetails: { StreamMode: 'ON_DEMAND' } },
        };

        const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 500 × $0.04 = $20 + 1000 × $0.015 = $15 = $35
        expect(result.amount).toBeCloseTo(35.00, 2);
      });
    });

    describe('Firehose', () => {
      it('should calculate firehose cost', async () => {
        const resource = {
          logicalId: 'MyFirehose',
          type: 'AWS::KinesisFirehose::DeliveryStream',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 1000GB × $0.029 = $29.00
        expect(result.amount).toBeCloseTo(29.00, 2);
        expect(result.confidence).toBe('medium');
      });

      it('should use custom firehose GB', async () => {
        const customCalc = new KinesisCalculator(undefined, undefined, undefined, 500);

        const resource = {
          logicalId: 'MyFirehose',
          type: 'AWS::KinesisFirehose::DeliveryStream',
          properties: {},
        };

        const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 500GB × $0.029 = $14.50
        expect(result.amount).toBeCloseTo(14.50, 2);
      });
    });

    describe('Analytics', () => {
      it('should calculate analytics cost', async () => {
        const resource = {
          logicalId: 'MyApp',
          type: 'AWS::KinesisAnalyticsV2::Application',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 2 KPUs × $0.11 × 730 = $160.60
        expect(result.amount).toBeCloseTo(160.60, 2);
        expect(result.confidence).toBe('medium');
      });

      it('should use custom KPU count', async () => {
        const customCalc = new KinesisCalculator(undefined, undefined, undefined, undefined, 4);

        const resource = {
          logicalId: 'MyApp',
          type: 'AWS::KinesisAnalyticsV2::Application',
          properties: {},
        };

        const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 4 KPUs × $0.11 × 730 = $321.20
        expect(result.amount).toBeCloseTo(321.20, 2);
      });
    });

    it('should handle API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockImplementation(() => {
        return Promise.reject(new Error('API connection failed'));
      });

      const resource = {
        logicalId: 'MyStream',
        type: 'AWS::Kinesis::Stream',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
