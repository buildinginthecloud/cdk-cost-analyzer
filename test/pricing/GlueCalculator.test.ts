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

    it('should calculate cost with default 100 DPU-hours for a Job', async () => {
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 100 DPU-hours × $0.44 = $44.00
      expect(result.amount).toBeCloseTo(44.00, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
    });

    it('should calculate cost with default 100 DPU-hours for a Crawler', async () => {
      const resource = {
        logicalId: 'MyGlueCrawler',
        type: 'AWS::Glue::Crawler',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 100 DPU-hours × $0.44 = $44.00
      expect(result.amount).toBeCloseTo(44.00, 2);
      expect(result.confidence).toBe('medium');
    });

    it('should calculate cost with custom 200 DPU-hours', async () => {
      const customCalculator = new GlueCalculator(200);
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 200 DPU-hours × $0.44 = $88.00
      expect(result.amount).toBeCloseTo(88.00, 2);
    });

    it('should not call pricing client API (uses fallback pricing)', async () => {
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should include custom DPU-hours note in assumptions when using custom constructor param', async () => {
      const customCalculator = new GlueCalculator(50);
      const resource = {
        logicalId: 'MyGlueJob',
        type: 'AWS::Glue::Job',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('configuration'))).toBe(true);
      // 50 DPU-hours × $0.44 = $22.00
      expect(result.amount).toBeCloseTo(22.00, 2);
    });
  });
});
