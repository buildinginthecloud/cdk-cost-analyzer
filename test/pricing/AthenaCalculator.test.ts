import { AthenaCalculator } from '../../src/pricing/calculators/AthenaCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('AthenaCalculator', () => {
  const calculator = new AthenaCalculator();

  describe('supports', () => {
    it('should support AWS::Athena::WorkGroup and AWS::Athena::NamedQuery', () => {
      expect(calculator.supports('AWS::Athena::WorkGroup')).toBe(true);
      expect(calculator.supports('AWS::Athena::NamedQuery')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::Glue::Job')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate WorkGroup cost with default 1 TB scanned', async () => {
      const resource = {
        logicalId: 'MyWorkGroup',
        type: 'AWS::Athena::WorkGroup',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 1 TB × $5.00 = $5.00
      expect(result.amount).toBeCloseTo(5.00, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
    });

    it('should calculate WorkGroup cost with custom 10 TB scanned', async () => {
      const customCalculator = new AthenaCalculator(10);
      const resource = {
        logicalId: 'MyWorkGroup',
        type: 'AWS::Athena::WorkGroup',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 10 TB × $5.00 = $50.00
      expect(result.amount).toBeCloseTo(50.00, 2);
    });

    it('should return $0 cost for NamedQuery with confidence high', async () => {
      const resource = {
        logicalId: 'MyNamedQuery',
        type: 'AWS::Athena::NamedQuery',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('high');
      expect(result.assumptions[0]).toContain('Named queries have no direct cost');
    });

    it('should not call pricing client API (uses fallback pricing)', async () => {
      const resource = {
        logicalId: 'MyWorkGroup',
        type: 'AWS::Athena::WorkGroup',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should include custom TB note in assumptions when using custom constructor param', async () => {
      const customCalculator = new AthenaCalculator(5);
      const resource = {
        logicalId: 'MyWorkGroup',
        type: 'AWS::Athena::WorkGroup',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('configuration'))).toBe(true);
      // 5 TB × $5.00 = $25.00
      expect(result.amount).toBeCloseTo(25.00, 2);
    });
  });
});
