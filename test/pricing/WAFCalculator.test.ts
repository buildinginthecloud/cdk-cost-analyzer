import { WAFCalculator } from '../../src/pricing/calculators/WAFCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('WAFCalculator', () => {
  const calculator = new WAFCalculator();

  describe('supports', () => {
    it('should support AWS::WAFv2::WebACL', () => {
      expect(calculator.supports('AWS::WAFv2::WebACL')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::WAFv2::RuleGroup')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost with default assumptions (0 rules, 1M requests)', async () => {
      const resource = {
        logicalId: 'MyWebACL',
        type: 'AWS::WAFv2::WebACL',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // $5.00 (ACL) + $0.00 (0 rules) + $0.60 (1M requests) = $5.60
      expect(result.amount).toBeCloseTo(5.60, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
    });

    it('should not call pricing client API (uses fallback pricing)', async () => {
      const resource = {
        logicalId: 'MyWebACL',
        type: 'AWS::WAFv2::WebACL',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should calculate cost with rules from resource.properties.Rules', async () => {
      const resource = {
        logicalId: 'MyWebACL',
        type: 'AWS::WAFv2::WebACL',
        properties: {
          Rules: [
            { Name: 'Rule1', Priority: 1 },
            { Name: 'Rule2', Priority: 2 },
            { Name: 'Rule3', Priority: 3 },
            { Name: 'Rule4', Priority: 4 },
            { Name: 'Rule5', Priority: 5 },
          ],
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // $5.00 (ACL) + $5.00 (5 rules × $1.00) + $0.60 (1M requests) = $10.60
      expect(result.amount).toBeCloseTo(10.60, 2);
      expect(result.confidence).toBe('medium');
    });

    it('should calculate cost with custom requests via constructor', async () => {
      const customCalculator = new WAFCalculator(10_000_000);
      const resource = {
        logicalId: 'MyWebACL',
        type: 'AWS::WAFv2::WebACL',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // $5.00 (ACL) + $0.00 (0 rules) + $6.00 (10M requests × $0.60/M) = $11.00
      expect(result.amount).toBeCloseTo(11.00, 2);
    });

    it('should include assumption about rules count', async () => {
      const resource = {
        logicalId: 'MyWebACL',
        type: 'AWS::WAFv2::WebACL',
        properties: {
          Rules: [{ Name: 'Rule1' }, { Name: 'Rule2' }],
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('2'))).toBe(true);
      // $5 + $2 + $0.60 = $7.60
      expect(result.amount).toBeCloseTo(7.60, 2);
    });

    it('should include custom request note in assumptions when using custom constructor param', async () => {
      const customCalculator = new WAFCalculator(5_000_000);
      const resource = {
        logicalId: 'MyWebACL',
        type: 'AWS::WAFv2::WebACL',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('configuration'))).toBe(true);
    });
  });
});
