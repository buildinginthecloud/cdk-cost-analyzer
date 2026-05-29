import { GlueCalculator } from '../../src/pricing/calculators/GlueCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('GlueCalculator', () => {
  const calculator = new GlueCalculator();

  describe('supports', () => {
    it('should support AWS::Glue::Job and AWS::Glue::Crawler', () => {
      expect(calculator.supports('AWS::Glue::Job')).toBe(true);
      expect(calculator.supports('AWS::Glue::Crawler')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::Glue::Database')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should default a Job with no DPU properties to 2 DPU × 50h', async () => {
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 2 DPU × 50h × $0.44 = $44.00
      expect(result.amount).toBeCloseTo(44.00, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('default 2 DPU'))).toBe(true);
    });

    it('should default a Crawler to 2 DPU × 50h', async () => {
      const resource = {
        logicalId: 'MyGlueCrawler',
        type: 'AWS::Glue::Crawler',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 2 DPU × 50h × $0.44 = $44.00
      expect(result.amount).toBeCloseTo(44.00, 2);
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('crawler default'))).toBe(true);
    });

    it('should derive DPUs from WorkerType + NumberOfWorkers (G.2X × 10 = 20 DPU)', async () => {
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {
          WorkerType: 'G.2X',
          NumberOfWorkers: 10,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 20 DPU × 50h × $0.44 = $440.00
      expect(result.amount).toBeCloseTo(440.00, 2);
      expect(result.assumptions.some(a => a.includes('G.2X'))).toBe(true);
    });

    it('should derive DPUs from G.1X workers', async () => {
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {
          WorkerType: 'G.1X',
          NumberOfWorkers: 5,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 5 DPU × 50h × $0.44 = $110.00
      expect(result.amount).toBeCloseTo(110.00, 2);
    });

    it('should fall back to MaxCapacity if no WorkerType is given', async () => {
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {
          MaxCapacity: 10,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 10 DPU × 50h × $0.44 = $220.00
      expect(result.amount).toBeCloseTo(220.00, 2);
      expect(result.assumptions.some(a => a.includes('MaxCapacity'))).toBe(true);
    });

    it('should respect custom hoursPerMonth', async () => {
      const customCalculator = new GlueCalculator(20);
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {
          WorkerType: 'G.1X',
          NumberOfWorkers: 2,
        },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 2 DPU × 20h × $0.44 = $17.60
      expect(result.amount).toBeCloseTo(17.60, 2);
      expect(result.assumptions.some(a => a.includes('custom hoursPerMonth'))).toBe(true);
    });

    it('should not call pricing client API (uses fixed pricing)', async () => {
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });
  });
});
