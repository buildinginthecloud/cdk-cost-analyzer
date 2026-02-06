// Jest imports are global
import { LambdaCalculator } from '../../src/pricing/calculators/LambdaCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('LambdaCalculator', () => {
  const calculator = new LambdaCalculator();

  describe('supports', () => {
    it('should support AWS::Lambda::Function', () => {
      expect(calculator.supports('AWS::Lambda::Function')).toBe(true);
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

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost for 128MB memory configuration', async () => {
      // Mock pricing: $0.20 per 1M requests, $0.0000166667 per GB-second
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.20) // Request pricing
        .mockResolvedValueOnce(0.0000166667); // Compute pricing

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 128,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected calculation:
      // Request cost: (1,000,000 / 1,000,000) * 0.20 = 0.20
      // GB-seconds: (128 / 1024) * (1000 / 1000) * 1,000,000 = 125,000
      // Compute cost: 125,000 * 0.0000166667 = 2.083375
      // Total: 0.20 + 2.083375 = 2.283375
      expect(result.amount).toBeCloseTo(2.283375, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 1,000,000 invocations per month');
      expect(result.assumptions).toContain('Assumes 1000ms average execution time');
      expect(result.assumptions).toContain('Assumes 128MB memory allocation');
    });

    it('should calculate cost for 512MB memory configuration', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.20)
        .mockResolvedValueOnce(0.0000166667);

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 512,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected calculation:
      // Request cost: 0.20
      // GB-seconds: (512 / 1024) * 1 * 1,000,000 = 500,000
      // Compute cost: 500,000 * 0.0000166667 = 8.33335
      // Total: 0.20 + 8.33335 = 8.53335
      expect(result.amount).toBeCloseTo(8.53335, 5);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 512MB memory allocation');
    });

    it('should calculate cost for 1024MB memory configuration', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.20)
        .mockResolvedValueOnce(0.0000166667);

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 1024,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Expected calculation:
      // Request cost: 0.20
      // GB-seconds: (1024 / 1024) * 1 * 1,000,000 = 1,000,000
      // Compute cost: 1,000,000 * 0.0000166667 = 16.6667
      // Total: 0.20 + 16.6667 = 16.8667
      expect(result.amount).toBeCloseTo(16.8667, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 1024MB memory allocation');
    });

    it('should calculate cost with default assumptions when memory not specified', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.20)
        .mockResolvedValueOnce(0.0000166667);

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Should use default 128MB memory
      expect(result.amount).toBeCloseTo(2.283375, 4);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 128MB memory allocation');
      expect(result.assumptions).toContain('Assumes 1,000,000 invocations per month');
      expect(result.assumptions).toContain('Assumes 1000ms average execution time');
    });

    it('should handle missing memory property gracefully', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.20)
        .mockResolvedValueOnce(0.0000166667);

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          FunctionName: 'test-function',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Should use default 128MB and calculate successfully
      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('Assumes 128MB memory allocation');
    });

    it('should handle pricing data unavailable for requests', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(null) // Request pricing unavailable
        .mockResolvedValueOnce(0.0000166667);

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 256,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available');
    });

    it('should handle pricing data unavailable for compute', async () => {
      jest.mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.20)
        .mockResolvedValueOnce(null); // Compute pricing unavailable

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 256,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Network timeout'));

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 512,
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
      expect(result.assumptions[0]).toContain('Network timeout');
    });
  });

  describe('fallback pricing with custom assumptions (lines 70-89)', () => {
    const fallbackMockClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use fallback pricing when request price is null but custom invocations provided', async () => {
      const customCalculator = new LambdaCalculator(2000000, undefined);
      
      jest.mocked(fallbackMockClient.getPrice)
        .mockResolvedValueOnce(null) // Request pricing unavailable
        .mockResolvedValueOnce(0.0000166667); // Compute pricing available

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 256 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', fallbackMockClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback request pricing'))).toBe(true);
    });

    it('should use fallback pricing when compute price is null but custom duration provided', async () => {
      const customCalculator = new LambdaCalculator(undefined, 500);
      
      jest.mocked(fallbackMockClient.getPrice)
        .mockResolvedValueOnce(0.20) // Request pricing available
        .mockResolvedValueOnce(null); // Compute pricing unavailable

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 512 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', fallbackMockClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback compute pricing'))).toBe(true);
    });

    it('should use both fallback prices when both are null and custom assumptions provided', async () => {
      const customCalculator = new LambdaCalculator(5000000, 2000);
      
      jest.mocked(fallbackMockClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 1024 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', fallbackMockClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback'))).toBe(true);
    });
  });

  describe('custom assumption messages in error handler (lines 123-128)', () => {
    const errorMockClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should include custom invocation assumption message on error', async () => {
      const customCalculator = new LambdaCalculator(3000000, undefined);
      
      jest.mocked(errorMockClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 256 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', errorMockClient);

      expect(result.assumptions.some(a => a.includes('custom invocation count'))).toBe(true);
    });

    it('should include custom duration assumption message on error', async () => {
      const customCalculator = new LambdaCalculator(undefined, 750);
      
      jest.mocked(errorMockClient.getPrice).mockRejectedValue(new Error('Timeout'));

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 512 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', errorMockClient);

      expect(result.assumptions.some(a => a.includes('custom duration'))).toBe(true);
    });

    it('should include both custom assumption messages when both provided on error', async () => {
      const customCalculator = new LambdaCalculator(2000000, 1500);
      
      jest.mocked(errorMockClient.getPrice).mockRejectedValue(new Error('Network Error'));

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 1024 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', errorMockClient);

      expect(result.assumptions.some(a => a.includes('custom invocation count'))).toBe(true);
      expect(result.assumptions.some(a => a.includes('custom duration'))).toBe(true);
    });
  });

  describe('error handler with fallback pricing (lines 135-151)', () => {
    const fallbackErrorMockClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use fallback pricing on API error when custom invocations provided', async () => {
      const customCalculator = new LambdaCalculator(1000000, undefined);
      
      jest.mocked(fallbackErrorMockClient.getPrice).mockRejectedValue(new Error('Service unavailable'));

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 128 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', fallbackErrorMockClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions.some(a => a.includes('fallback pricing'))).toBe(true);
    });

    it('should use fallback pricing on API error when custom duration provided', async () => {
      const customCalculator = new LambdaCalculator(undefined, 500);
      
      jest.mocked(fallbackErrorMockClient.getPrice).mockRejectedValue(new Error('Connection refused'));

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 256 },
      };

      const result = await customCalculator.calculateCost(resource, 'us-east-1', fallbackErrorMockClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
    });

    it('should return zero cost on API error without custom assumptions', async () => {
      const defaultCalculator = new LambdaCalculator();
      
      jest.mocked(fallbackErrorMockClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: { MemorySize: 512 },
      };

      const result = await defaultCalculator.calculateCost(resource, 'us-east-1', fallbackErrorMockClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });
  });
});
