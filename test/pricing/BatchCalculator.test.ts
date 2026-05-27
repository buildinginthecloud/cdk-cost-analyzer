import { BatchCalculator } from '../../src/pricing/calculators/BatchCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('BatchCalculator', () => {
  const calculator = new BatchCalculator();

  describe('supports', () => {
    it('should support Batch resource types', () => {
      expect(calculator.supports('AWS::Batch::JobDefinition')).toBe(true);
      expect(calculator.supports('AWS::Batch::ComputeEnvironment')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::ECS::Service')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('AWS::Batch::JobDefinition', () => {
      it('should return $0 with high confidence for job definitions', async () => {
        const resource = {
          logicalId: 'MyJobDef',
          type: 'AWS::Batch::JobDefinition',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe('high');
        expect(result.currency).toBe('USD');
        expect(result.assumptions[0]).toContain('AWS Batch has no additional charge for job definitions');
      });
    });

    describe('AWS::Batch::ComputeEnvironment', () => {
      it('should calculate Fargate cost with default hours (100)', async () => {
        const resource = {
          logicalId: 'MyComputeEnv',
          type: 'AWS::Batch::ComputeEnvironment',
          properties: {
            ComputeResources: { Type: 'FARGATE' },
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // vcpuCost = 1 * 0.04048 * 100 = 4.048
        // memoryCost = 2 * 0.004445 * 100 = 0.889
        // total = 4.937
        expect(result.amount).toBeCloseTo(4.94, 2);
        expect(result.confidence).toBe('medium');
      });

      it('should default to FARGATE when ComputeResources is not specified', async () => {
        const resource = {
          logicalId: 'MyComputeEnv',
          type: 'AWS::Batch::ComputeEnvironment',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(4.94, 2);
        expect(result.confidence).toBe('medium');
      });

      it('should return $0 with high confidence for EC2 compute environments', async () => {
        const resource = {
          logicalId: 'MyComputeEnv',
          type: 'AWS::Batch::ComputeEnvironment',
          properties: {
            ComputeResources: { Type: 'EC2' },
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe('high');
        expect(result.assumptions[0]).toContain('EC2-based Batch uses underlying EC2 instance pricing');
      });

      it('should use custom hours per month', async () => {
        const customCalc = new BatchCalculator(200);

        const resource = {
          logicalId: 'MyComputeEnv',
          type: 'AWS::Batch::ComputeEnvironment',
          properties: {
            ComputeResources: { Type: 'FARGATE' },
          },
        };

        const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

        // vcpuCost = 1 * 0.04048 * 200 = 8.096
        // memoryCost = 2 * 0.004445 * 200 = 1.778
        // total = 9.874
        expect(result.amount).toBeCloseTo(9.87, 2);
      });
    });

    it('should not call the pricing API', async () => {
      const resource = {
        logicalId: 'MyComputeEnv',
        type: 'AWS::Batch::ComputeEnvironment',
        properties: { ComputeResources: { Type: 'FARGATE' } },
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });
  });
});
