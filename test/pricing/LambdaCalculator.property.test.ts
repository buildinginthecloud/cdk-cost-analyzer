import * as fc from 'fast-check';
// Jest imports are global
import { LambdaCalculator } from '../../src/pricing/calculators/LambdaCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('LambdaCalculator - Property Tests', () => {
  // Feature: cdk-cost-analyzer, Property 8: Lambda costs scale with memory configuration
  it('should produce equal or higher costs for higher memory allocations', () => {
    const calculator = new LambdaCalculator();

    // Define memory sizes in ascending order (AWS Lambda supports 128MB to 10240MB in 1MB increments)
    const memoryConfigurations = [128, 256, 512, 1024, 1536, 2048, 3008, 4096, 5120, 10240];
    const regions = ['us-east-1', 'us-west-2', 'eu-central-1', 'eu-west-1', 'ap-southeast-1'];

    // Create a mock pricing client that returns realistic Lambda pricing
    const createMockPricingClient = (): PricingClient => ({
      getPrice: jest.fn().mockImplementation(async (params) => {
        const group = params.filters?.find((f: any) => f.field === 'group')?.value;

        if (!group) {
          return null;
        }

        // Realistic Lambda pricing (as of 2024)
        // Request pricing: $0.20 per 1M requests
        // Compute pricing: $0.0000166667 per GB-second
        if (group === 'AWS-Lambda-Requests') {
          return 0.20;
        } else if (group === 'AWS-Lambda-Duration') {
          return 0.0000166667;
        }

        return null;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    // Property: For any two Lambda functions where one has higher memory allocation,
    // the higher memory function should have equal or higher estimated cost
    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...memoryConfigurations),
        fc.constantFrom(...memoryConfigurations),
        fc.constantFrom(...regions),
        async (memory1, memory2, region) => {
          const resource1 = {
            logicalId: 'Function1',
            type: 'AWS::Lambda::Function',
            properties: {
              MemorySize: memory1,
            },
          };

          const resource2 = {
            logicalId: 'Function2',
            type: 'AWS::Lambda::Function',
            properties: {
              MemorySize: memory2,
            },
          };

          const cost1 = await calculator.calculateCost(resource1, region, mockPricingClient);
          const cost2 = await calculator.calculateCost(resource2, region, mockPricingClient);

          // Both costs should be valid
          expect(cost1.amount).toBeGreaterThanOrEqual(0);
          expect(cost2.amount).toBeGreaterThanOrEqual(0);
          expect(cost1.currency).toBe('USD');
          expect(cost2.currency).toBe('USD');
          expect(cost1.confidence).toBe('medium');
          expect(cost2.confidence).toBe('medium');

          // If memory2 > memory1, then cost2 should be >= cost1
          if (memory2 > memory1) {
            expect(cost2.amount).toBeGreaterThanOrEqual(cost1.amount);
          } else if (memory1 > memory2) {
            expect(cost1.amount).toBeGreaterThanOrEqual(cost2.amount);
          } else {
            // Same memory should produce the same cost
            expect(cost1.amount).toBe(cost2.amount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should produce strictly higher costs for strictly higher memory allocations', () => {
    const calculator = new LambdaCalculator();

    // Define pairs of memory sizes where one is clearly larger
    const smallerMemory = [128, 256, 512, 1024];
    const largerMemory = [1024, 2048, 3008, 4096];

    const createMockPricingClient = (): PricingClient => ({
      getPrice: jest.fn().mockImplementation(async (params) => {
        const group = params.filters?.find((f: any) => f.field === 'group')?.value;

        if (group === 'AWS-Lambda-Requests') {
          return 0.20;
        } else if (group === 'AWS-Lambda-Duration') {
          return 0.0000166667;
        }

        return null;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...smallerMemory),
        fc.constantFrom(...largerMemory),
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (smallerMem, largerMem, region) => {
          // Only test when larger is actually larger
          fc.pre(largerMem > smallerMem);

          const smallerResource = {
            logicalId: 'SmallerFunction',
            type: 'AWS::Lambda::Function',
            properties: {
              MemorySize: smallerMem,
            },
          };

          const largerResource = {
            logicalId: 'LargerFunction',
            type: 'AWS::Lambda::Function',
            properties: {
              MemorySize: largerMem,
            },
          };

          const smallerCost = await calculator.calculateCost(smallerResource, region, mockPricingClient);
          const largerCost = await calculator.calculateCost(largerResource, region, mockPricingClient);

          // Larger memory should cost strictly more
          expect(largerCost.amount).toBeGreaterThan(smallerCost.amount);
          expect(smallerCost.confidence).toBe('medium');
          expect(largerCost.confidence).toBe('medium');

          // Both should have assumptions about memory
          expect(smallerCost.assumptions.some(a => a.includes(`${smallerMem}MB`))).toBe(true);
          expect(largerCost.assumptions.some(a => a.includes(`${largerMem}MB`))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle missing memory size with default value', () => {
    const calculator = new LambdaCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockImplementation(async (params) => {
        const group = params.filters?.find((f: any) => f.field === 'group')?.value;

        if (group === 'AWS-Lambda-Requests') {
          return 0.20;
        } else if (group === 'AWS-Lambda-Duration') {
          return 0.0000166667;
        }

        return null;
      }),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (region) => {
          const resource = {
            logicalId: 'FunctionWithoutMemory',
            type: 'AWS::Lambda::Function',
            properties: {},
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // Should use default memory (128MB) and still calculate cost
          expect(cost.amount).toBeGreaterThan(0);
          expect(cost.confidence).toBe('medium');
          expect(cost.assumptions.some(a => a.includes('128MB'))).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle pricing API failures gracefully', () => {
    const calculator = new LambdaCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(null),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(128, 256, 512, 1024, 2048),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (memorySize, region) => {
          const resource = {
            logicalId: 'TestFunction',
            type: 'AWS::Lambda::Function',
            properties: {
              MemorySize: memorySize,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Pricing data not available');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle pricing API errors gracefully', () => {
    const calculator = new LambdaCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockRejectedValue(new Error('Network timeout')),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(128, 512, 1024),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (memorySize, region) => {
          const resource = {
            logicalId: 'TestFunction',
            type: 'AWS::Lambda::Function',
            properties: {
              MemorySize: memorySize,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // When API throws error, should handle gracefully
          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Failed to fetch pricing');
        },
      ),
      { numRuns: 50 },
    );
  });
});
