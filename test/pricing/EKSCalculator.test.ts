import { EKSCalculator } from '../../src/pricing/calculators/EKSCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('EKSCalculator', () => {
  const calculator = new EKSCalculator();

  describe('supports', () => {
    it('should support AWS::EKS::Cluster', () => {
      expect(calculator.supports('AWS::EKS::Cluster')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::ECS::Cluster')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost with API pricing', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.10);

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::EKS::Cluster',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(73.00, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain('Worker nodes (EC2/Fargate) are calculated separately');
    });

    it('should use fallback pricing when API returns null', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::EKS::Cluster',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(73.00, 2);
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('fallback pricing'))).toBe(true);
    });

    it('should handle API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValueOnce(new Error('API timeout'));

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::EKS::Cluster',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });

    it('should use different API hourly rate when available', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.12);

      const resource = {
        logicalId: 'MyCluster',
        type: 'AWS::EKS::Cluster',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeCloseTo(87.60, 2);
      expect(result.confidence).toBe('high');
    });
  });
});
