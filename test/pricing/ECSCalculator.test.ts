// Jest imports are global
import { ECSCalculator } from '../../src/pricing/calculators/ECSCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('ECSCalculator', () => {
  const calculator = new ECSCalculator();

  describe('supports', () => {
    it('should support AWS::ECS::Service', () => {
      expect(calculator.supports('AWS::ECS::Service')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    it('should calculate cost for Fargate launch type', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.04);

      const resource = {
        logicalId: 'MyService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 2,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('2 task(s) running');
      expect(result.assumptions).toContain('Fargate launch type');
    });

    it('should use default desired count when not specified', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.04);

      const resource = {
        logicalId: 'MyService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.assumptions).toContain('1 task(s) running');
    });

    it('should calculate cost for EC2 launch type', async () => {
      const resource = {
        logicalId: 'MyService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'EC2',
          DesiredCount: 3,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain('3 task(s) running on EC2 launch type');
      expect(result.assumptions).toContain('EC2 launch type costs depend on underlying EC2 instances');
    });

    it('should default to Fargate when launch type not specified', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.04);

      const resource = {
        logicalId: 'MyService',
        type: 'AWS::ECS::Service',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Fargate launch type');
    });

    it('should handle unsupported launch type', async () => {
      const resource = {
        logicalId: 'MyService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'EXTERNAL',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Unsupported launch type');
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
