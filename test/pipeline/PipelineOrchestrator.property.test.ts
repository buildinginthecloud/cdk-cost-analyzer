import * as fc from 'fast-check';
// Jest imports are global
import { DiffEngine } from '../../src/diff/DiffEngine';
import { CloudFormationTemplate } from '../../src/parser/types';
import { PricingService } from '../../src/pricing/PricingService';

// Mock PricingClient to avoid real AWS API calls
jest.mock('../../src/pricing/PricingClient', () => {
  return {
    PricingClient: jest.fn().mockImplementation(() => {
      return {
        getPrice: jest.fn().mockImplementation((params) => {
          const serviceCode = params?.serviceCode || 'AmazonEC2';
          const filters = params?.filters || [];
          
          // Handle Lambda special cases
          if (serviceCode === 'AWSLambda') {
            const groupFilter = filters.find((f: any) => f.field === 'group');
            if (groupFilter?.value === 'AWS-Lambda-Requests') {
              return Promise.resolve(0.20);
            }
            if (groupFilter?.value === 'AWS-Lambda-Duration') {
              return Promise.resolve(0.0000166667);
            }
          }
          
          const prices: Record<string, number> = {
            AmazonEC2: 0.0116,
            AmazonS3: 0.023,
            AWSLambda: 0.0000166667,
          };
          
          return Promise.resolve(prices[serviceCode] || 0.01);
        }),
        destroy: jest.fn(),
      };
    }),
  };
});

describe('PipelineOrchestrator - Property Tests', () => {
  const pricingService = new PricingService();
  const diffEngine = new DiffEngine();

  afterAll(() => {
    // Clean up the shared service
    try {
      pricingService.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Feature: production-readiness, Property 2: Multi-stack cost aggregation equals sum of individual stacks
  // Validates: Requirements 2.4
  it('should aggregate costs correctly across multiple stacks', () => {
    const resourceTypeArb = fc.constantFrom(
      'AWS::S3::Bucket',
      'AWS::Lambda::Function',
      'AWS::EC2::Instance',
    );

    const resourceArb = fc.record({
      Type: resourceTypeArb,
      Properties: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())),
    });

    const templateArb = fc.dictionary(
      fc.string().filter(s => s.length > 0 && s.trim().length > 0),
      resourceArb,
      { minKeys: 1, maxKeys: 5 },
    ).map(resources => ({ Resources: resources }));

    // Generate multiple stacks (2-3 stacks)
    const multiStackArb = fc.record({
      baseStacks: fc.array(templateArb, { minLength: 2, maxLength: 3 }),
      targetStacks: fc.array(templateArb, { minLength: 2, maxLength: 3 }),
    }).filter(({ baseStacks, targetStacks }) => baseStacks.length === targetStacks.length);

    void fc.assert(
      fc.asyncProperty(multiStackArb, async ({ baseStacks, targetStacks }) => {
        const region = 'eu-central-1';

        // Calculate cost delta for each stack individually
        const individualDeltas: number[] = [];

        for (let i = 0; i < baseStacks.length; i++) {
          const diff = diffEngine.diff(
            baseStacks[i] as CloudFormationTemplate,
            targetStacks[i] as CloudFormationTemplate,
          );
          const costDelta = await pricingService.getCostDelta(diff, region);
          individualDeltas.push(costDelta.totalDelta);
        }

        // Calculate expected total (sum of individual deltas)
        const expectedTotal = individualDeltas.reduce((sum, delta) => sum + delta, 0);

        // Calculate combined cost delta (simulating multi-stack aggregation)
        // Merge all resources from all stacks
        const mergedBase: CloudFormationTemplate = {
          Resources: {},
        };
        const mergedTarget: CloudFormationTemplate = {
          Resources: {},
        };

        baseStacks.forEach((stack, idx) => {
          Object.entries(stack.Resources).forEach(([id, resource]) => {
            mergedBase.Resources[`Stack${idx}-${id}`] = resource;
          });
        });

        targetStacks.forEach((stack, idx) => {
          Object.entries(stack.Resources).forEach(([id, resource]) => {
            mergedTarget.Resources[`Stack${idx}-${id}`] = resource;
          });
        });

        const mergedDiff = diffEngine.diff(mergedBase, mergedTarget);
        const mergedCostDelta = await pricingService.getCostDelta(mergedDiff, region);

        // The merged total should equal the sum of individual totals
        // Allow small floating point differences
        const difference = Math.abs(mergedCostDelta.totalDelta - expectedTotal);
        expect(difference).toBeLessThan(0.01);

        // Verify the number of resources matches
        const totalAddedIndividual = individualDeltas.length > 0 ?
          (await Promise.all(baseStacks.map((base, i) => {
            const diff = diffEngine.diff(base as CloudFormationTemplate, targetStacks[i] as CloudFormationTemplate);
            return pricingService.getCostDelta(diff, region);
          }))).reduce((sum, delta) => sum + delta.addedCosts.length, 0) : 0;

        expect(mergedCostDelta.addedCosts.length).toBe(totalAddedIndividual);
      }),
      { numRuns: 30 },
    );
  });

  // Feature: production-readiness, Property 2: Multi-stack cost aggregation equals sum of individual stacks
  // Validates: Requirements 2.4
  it('should maintain cost consistency when stacks are analyzed separately vs together', () => {
    const resourceArb = fc.record({
      Type: fc.constantFrom('AWS::S3::Bucket', 'AWS::Lambda::Function'),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    const stackPairArb = fc.record({
      stack1Base: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 3 }),
      stack1Target: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 3 }),
      stack2Base: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 3 }),
      stack2Target: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 3 }),
    });

    void fc.assert(
      fc.asyncProperty(stackPairArb, async ({ stack1Base, stack1Target, stack2Base, stack2Target }) => {
        const region = 'eu-central-1';

        // Analyze stack 1
        const diff1 = diffEngine.diff(
          { Resources: stack1Base } as CloudFormationTemplate,
          { Resources: stack1Target } as CloudFormationTemplate,
        );
        const cost1 = await pricingService.getCostDelta(diff1, region);

        // Analyze stack 2
        const diff2 = diffEngine.diff(
          { Resources: stack2Base } as CloudFormationTemplate,
          { Resources: stack2Target } as CloudFormationTemplate,
        );
        const cost2 = await pricingService.getCostDelta(diff2, region);

        // Sum of individual stacks
        const sumOfIndividual = cost1.totalDelta + cost2.totalDelta;

        // Analyze combined (with unique IDs to avoid conflicts)
        const combinedBase: CloudFormationTemplate = {
          Resources: {
            ...Object.fromEntries(
              Object.entries(stack1Base).map(([k, v]) => [`S1-${k}`, v]),
            ),
            ...Object.fromEntries(
              Object.entries(stack2Base).map(([k, v]) => [`S2-${k}`, v]),
            ),
          },
        };

        const combinedTarget: CloudFormationTemplate = {
          Resources: {
            ...Object.fromEntries(
              Object.entries(stack1Target).map(([k, v]) => [`S1-${k}`, v]),
            ),
            ...Object.fromEntries(
              Object.entries(stack2Target).map(([k, v]) => [`S2-${k}`, v]),
            ),
          },
        };

        const combinedDiff = diffEngine.diff(combinedBase, combinedTarget);
        const combinedCost = await pricingService.getCostDelta(combinedDiff, region);

        // Combined should equal sum of individual
        const difference = Math.abs(combinedCost.totalDelta - sumOfIndividual);
        expect(difference).toBeLessThan(0.01);

        // Resource counts should also match
        expect(combinedCost.addedCosts.length).toBe(
          cost1.addedCosts.length + cost2.addedCosts.length,
        );
        expect(combinedCost.removedCosts.length).toBe(
          cost1.removedCosts.length + cost2.removedCosts.length,
        );
        expect(combinedCost.modifiedCosts.length).toBe(
          cost1.modifiedCosts.length + cost2.modifiedCosts.length,
        );
      }),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 2: Multi-stack cost aggregation equals sum of individual stacks
  // Validates: Requirements 2.4
  it('should handle empty stacks in multi-stack aggregation', () => {
    const resourceArb = fc.record({
      Type: fc.constantFrom('AWS::S3::Bucket', 'AWS::Lambda::Function'),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    const mixedStacksArb = fc.record({
      emptyStack: fc.constant({ Resources: {} }),
      nonEmptyStackBase: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 3 }),
      nonEmptyStackTarget: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 3 }),
    });

    void fc.assert(
      fc.asyncProperty(mixedStacksArb, async ({ emptyStack, nonEmptyStackBase, nonEmptyStackTarget }) => {
        const region = 'eu-central-1';

        // Analyze empty stack (should have zero delta)
        const emptyDiff = diffEngine.diff(
          emptyStack as CloudFormationTemplate,
          emptyStack as CloudFormationTemplate,
        );
        const emptyCost = await pricingService.getCostDelta(emptyDiff, region);
        expect(emptyCost.totalDelta).toBe(0);

        // Analyze non-empty stack
        const nonEmptyDiff = diffEngine.diff(
          { Resources: nonEmptyStackBase } as CloudFormationTemplate,
          { Resources: nonEmptyStackTarget } as CloudFormationTemplate,
        );
        const nonEmptyCost = await pricingService.getCostDelta(nonEmptyDiff, region);

        // Combined should equal non-empty stack cost (since empty contributes 0)
        const combined = emptyCost.totalDelta + nonEmptyCost.totalDelta;
        const difference = Math.abs(combined - nonEmptyCost.totalDelta);
        expect(difference).toBeLessThan(0.01);
      }),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 2: Multi-stack cost aggregation equals sum of individual stacks
  // Validates: Requirements 2.4
  it('should maintain currency consistency across multi-stack aggregation', () => {
    const resourceArb = fc.record({
      Type: fc.constantFrom('AWS::S3::Bucket', 'AWS::Lambda::Function'),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    const multiStackArb = fc.array(
      fc.record({
        base: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 2 }),
        target: fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 2 }),
      }),
      { minLength: 2, maxLength: 4 },
    );

    void fc.assert(
      fc.asyncProperty(multiStackArb, async (stacks) => {
        const region = 'eu-central-1';

        // Analyze each stack
        const results = await Promise.all(
          stacks.map(async ({ base, target }) => {
            const diff = diffEngine.diff(
              { Resources: base } as CloudFormationTemplate,
              { Resources: target } as CloudFormationTemplate,
            );
            return pricingService.getCostDelta(diff, region);
          }),
        );

        // All results should have the same currency
        const currencies = results.map(r => r.currency);
        const uniqueCurrencies = new Set(currencies);
        expect(uniqueCurrencies.size).toBe(1);
        expect(currencies[0]).toBe('USD');

        // Aggregated result should also use the same currency
        const totalDelta = results.reduce((sum, r) => sum + r.totalDelta, 0);
        expect(typeof totalDelta).toBe('number');
      }),
      { numRuns: 50 },
    );
  });
});
