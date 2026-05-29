import { AppRunnerCalculator } from '../../src/pricing/calculators/AppRunnerCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('AppRunnerCalculator', () => {
  const calculator = new AppRunnerCalculator();

  describe('supports', () => {
    it('should support App Runner service', () => {
      expect(calculator.supports('AWS::AppRunner::Service')).toBe(true);
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

    it('should calculate cost with default CPU and memory', async () => {
      const resource = {
        logicalId: 'MyService',
        type: 'AWS::AppRunner::Service',
        properties: {
          InstanceConfiguration: {
            Cpu: '1 vCPU',
            Memory: '2 GB',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // vcpuCost = 1 * 0.064 * 730 = 46.72
      // memoryCost = 2 * 0.007 * 730 = 10.22
      // requestCost = (1e6 / 1e6) * 0.10 = 0.10
      // total = 57.04
      expect(result.amount).toBeCloseTo(57.04, 2);
      expect(result.confidence).toBe('medium');
      expect(result.currency).toBe('USD');
    });

    it('should parse 0.25 vCPU correctly', async () => {
      const resource = {
        logicalId: 'MyService',
        type: 'AWS::AppRunner::Service',
        properties: {
          InstanceConfiguration: {
            Cpu: '0.25 vCPU',
            Memory: '2 GB',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // vcpuCost = 0.25 * 0.064 * 730 = 11.68
      // memoryCost = 2 * 0.007 * 730 = 10.22
      // requestCost = 0.10
      // total = 22.00
      expect(result.amount).toBeCloseTo(22.00, 2);
    });

    it('should parse 0.5 GB memory correctly', async () => {
      const resource = {
        logicalId: 'MyService',
        type: 'AWS::AppRunner::Service',
        properties: {
          InstanceConfiguration: {
            Cpu: '1 vCPU',
            Memory: '0.5 GB',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // vcpuCost = 1 * 0.064 * 730 = 46.72
      // memoryCost = 0.5 * 0.007 * 730 = 2.555
      // requestCost = 0.10
      // total = 49.375
      expect(result.amount).toBeCloseTo(49.375, 3);
    });

    it('should apply defaults when InstanceConfiguration is missing', async () => {
      const resource = {
        logicalId: 'MyService',
        type: 'AWS::AppRunner::Service',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // defaults: 1 vCPU, 2 GB, 1M requests
      // total = 57.04
      expect(result.amount).toBeCloseTo(57.04, 2);
    });

    it('should use custom requests per month from constructor', async () => {
      const customCalc = new AppRunnerCalculator(10_000_000); // 10M requests

      const resource = {
        logicalId: 'MyService',
        type: 'AWS::AppRunner::Service',
        properties: {
          InstanceConfiguration: {
            Cpu: '1 vCPU',
            Memory: '2 GB',
          },
        },
      };

      const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

      // vcpuCost = 1 * 0.064 * 730 = 46.72
      // memoryCost = 2 * 0.007 * 730 = 10.22
      // requestCost = (10e6 / 1e6) * 0.10 = 1.00
      // total = 57.94
      expect(result.amount).toBeCloseTo(57.94, 2);
    });

    it('should not call the pricing API', async () => {
      const resource = {
        logicalId: 'MyService',
        type: 'AWS::AppRunner::Service',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });
  });
});
