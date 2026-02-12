// Jest imports are global
import { StepFunctionsCalculator } from '../../src/pricing/calculators/StepFunctionsCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('StepFunctionsCalculator', () => {
  const calculator = new StepFunctionsCalculator();

  describe('supports', () => {
    it('should support AWS::StepFunctions::StateMachine', () => {
      expect(calculator.supports('AWS::StepFunctions::StateMachine')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('calculateCost - Standard Workflow', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = {
        getPrice: jest.fn(),
      };
    });

    it('should calculate cost for Standard workflow with default assumptions', async () => {
      // $0.025 per 1,000 state transitions = $0.000025 per transition
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected: 10,000 executions * 10 transitions/execution * $0.000025 = $2.50
      expect(result.amount).toBeCloseTo(2.5, 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('STANDARD workflow type');
      expect(result.assumptions.some(a => a.includes('10,000 executions'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('10 state transitions per execution'))).toBe(true);
    });

    it('should default to STANDARD workflow when Type property is missing', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('STANDARD workflow type');
      expect(result.confidence).toBe('medium');
    });

    it('should use correct usagetype filter for Standard workflow', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceCode: 'AWSStepFunctions',
          filters: expect.arrayContaining([
            { field: 'productFamily', value: 'AWS Step Functions' },
            { field: 'usagetype', value: 'USE1-StateTransition' },
          ]),
        }),
      );
    });

    it('should use correct regional prefix for EU region', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            { field: 'usagetype', value: 'EUC1-StateTransition' },
          ]),
        }),
      );
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions.some(a => a.includes('Pricing data not available'))).toBe(true);
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Network timeout'));

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions.some(a => a.includes('Failed to fetch pricing'))).toBe(true);
    });
  });

  describe('calculateCost - Express Workflow', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = {
        getPrice: jest.fn(),
      };
    });

    it('should calculate cost for Express workflow with default assumptions', async () => {
      // $1.00 per million requests = $0.000001 per request
      // $0.00001667 per GB-second
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.000001) // request price
        .mockResolvedValueOnce(0.00001667); // duration price

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected:
      // Request cost: 10,000 * $0.000001 = $0.01
      // Duration: (64/1024) * (1000/1000) * 10000 = 625 GB-seconds
      // Duration cost: 625 * $0.00001667 = $0.0104
      // Total: ~$0.02
      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('EXPRESS workflow type');
      expect(result.assumptions.some(a => a.includes('10,000 executions'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('1000ms average execution duration'))).toBe(true);
    });

    it('should use correct usagetype filters for Express workflow', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000001);

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledTimes(2);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceCode: 'AWSStepFunctions',
          filters: expect.arrayContaining([
            { field: 'productFamily', value: 'AWS Step Functions' },
            { field: 'usagetype', value: 'USE1-ExpressRequest' },
          ]),
        }),
      );

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceCode: 'AWSStepFunctions',
          filters: expect.arrayContaining([
            { field: 'productFamily', value: 'AWS Step Functions' },
            { field: 'usagetype', value: 'USE1-ExpressDuration' },
          ]),
        }),
      );
    });

    it('should handle pricing data unavailable for request price', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null) // request price unavailable
        .mockResolvedValueOnce(0.00001667);

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle pricing data unavailable for duration price', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.000001)
        .mockResolvedValueOnce(null); // duration price unavailable

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions.some(a => a.includes('Failed to fetch pricing'))).toBe(true);
    });
  });

  describe('custom usage assumptions', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = {
        getPrice: jest.fn(),
      };
    });

    it('should use custom monthly executions for Standard workflow', async () => {
      const customCalculator = new StepFunctionsCalculator(50000, undefined, undefined);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 50,000 executions * 10 transitions * $0.000025 = $12.50
      expect(result.amount).toBeCloseTo(12.5, 2);
      expect(result.assumptions.some(a => a.includes('50,000 executions'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('custom monthly executions'))).toBe(true);
    });

    it('should use custom state transitions per execution for Standard workflow', async () => {
      const customCalculator = new StepFunctionsCalculator(undefined, 25, undefined);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 10,000 executions * 25 transitions * $0.000025 = $6.25
      expect(result.amount).toBeCloseTo(6.25, 2);
      expect(result.assumptions.some(a => a.includes('25 state transitions per execution'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('custom state transitions per execution'))).toBe(true);
    });

    it('should use custom average duration for Express workflow', async () => {
      const customCalculator = new StepFunctionsCalculator(undefined, undefined, 5000);
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.000001)
        .mockResolvedValueOnce(0.00001667);

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('5000ms average execution duration'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('custom average duration'))).toBe(true);
    });

    it('should use all custom assumptions together', async () => {
      const customCalculator = new StepFunctionsCalculator(100000, 15, 2000);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // 100,000 executions * 15 transitions * $0.000025 = $37.50
      expect(result.amount).toBeCloseTo(37.5, 2);
      expect(result.assumptions.some(a => a.includes('100,000 executions'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('15 state transitions per execution'))).toBe(true);
    });
  });

  describe('fallback pricing with custom assumptions', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = {
        getPrice: jest.fn(),
      };
    });

    it('should use fallback pricing when API returns null and custom assumptions provided (Standard)', async () => {
      const customCalculator = new StepFunctionsCalculator(20000, undefined, undefined);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });

    it('should use fallback pricing when API returns null and custom assumptions provided (Express)', async () => {
      const customCalculator = new StepFunctionsCalculator(20000, undefined, 500);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });

    it('should use fallback pricing on API error when custom assumptions provided (Standard)', async () => {
      const customCalculator = new StepFunctionsCalculator(15000, 20, undefined);
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Service unavailable'));

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback pricing'))).toBe(true);
    });

    it('should use fallback pricing on API error when custom assumptions provided (Express)', async () => {
      const customCalculator = new StepFunctionsCalculator(undefined, undefined, 3000);
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Connection refused'));

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });

    it('should return zero cost on API error without custom assumptions', async () => {
      const defaultCalculator = new StepFunctionsCalculator();
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await defaultCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should use partial fallback when only request price is null (Express)', async () => {
      const customCalculator = new StepFunctionsCalculator(10000, undefined, 1000);
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null) // request price unavailable
        .mockResolvedValueOnce(0.00001667); // duration price available

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback request pricing'))).toBe(true);
    });

    it('should use partial fallback when only duration price is null (Express)', async () => {
      const customCalculator = new StepFunctionsCalculator(10000, undefined, 1000);
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.000001) // request price available
        .mockResolvedValueOnce(null); // duration price unavailable

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback duration pricing'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    let mockPricingClient: PricingClient;

    beforeEach(() => {
      mockPricingClient = {
        getPrice: jest.fn(),
      };
    });

    it('should handle unknown region gracefully', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      await calculator.calculateCost(resource, 'unknown-region', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            { field: 'usagetype', value: 'StateTransition' },
          ]),
        }),
      );
    });

    it('should handle Type property with unexpected value (defaults to STANDARD)', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'UNKNOWN_TYPE',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('STANDARD workflow type');
    });

    it('should handle zero executions', async () => {
      const zeroExecCalculator = new StepFunctionsCalculator(0, undefined, undefined);
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await zeroExecCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
    });

    it('should show total state transitions in assumptions', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.000025);

      const resource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('Total estimated state transitions: 100,000'))).toBe(true);
    });

    it('should show GB-seconds in assumptions for Express workflow', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.000001)
        .mockResolvedValueOnce(0.00001667);

      const resource = {
        logicalId: 'MyExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions.some(a => a.includes('Total estimated GB-seconds'))).toBe(true);
    });
  });
});
