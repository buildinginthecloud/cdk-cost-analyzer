import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { analyzeCosts } from '../../src/api';

vi.mock('@aws-sdk/client-pricing', () => ({
  PricingClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  GetProductsCommand: vi.fn(),
}));

describe('analyzeCosts API - Property Tests', () => {
  const resourceTypeArb = fc.constantFrom(
    'AWS::S3::Bucket',
    'AWS::EC2::Instance',
    'AWS::Lambda::Function'
  );

  const resourceArb = fc.record({
    Type: resourceTypeArb,
    Properties: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())),
  });

  const templateArb = fc.dictionary(
    fc.string().filter(s => s.length > 0),
    resourceArb,
    { minKeys: 1, maxKeys: 3 }
  ).map(resources => ({
    Resources: resources
  }));

  // Feature: cdk-cost-analyzer, Property 15: API returns structured results
  it('should return structured results for any valid template pair', () => {
    fc.assert(
      fc.asyncProperty(templateArb, templateArb, async (base, target) => {
        const result = await analyzeCosts({
          baseTemplate: JSON.stringify(base),
          targetTemplate: JSON.stringify(target),
          region: 'eu-central-1',
        });

        expect(result).toHaveProperty('totalDelta');
        expect(result).toHaveProperty('currency');
        expect(result).toHaveProperty('addedResources');
        expect(result).toHaveProperty('removedResources');
        expect(result).toHaveProperty('modifiedResources');
        expect(result).toHaveProperty('summary');

        expect(typeof result.totalDelta).toBe('number');
        expect(typeof result.currency).toBe('string');
        expect(Array.isArray(result.addedResources)).toBe(true);
        expect(Array.isArray(result.removedResources)).toBe(true);
        expect(Array.isArray(result.modifiedResources)).toBe(true);
        expect(typeof result.summary).toBe('string');
      }),
      { numRuns: 30 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 16: API throws errors for invalid inputs
  it('should throw descriptive errors for invalid templates', () => {
    const invalidTemplates = [
      'invalid json',
      '{ "no resources": "here" }',
      '',
      'null',
    ];

    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...invalidTemplates),
        async (invalidTemplate) => {
          await expect(
            analyzeCosts({
              baseTemplate: invalidTemplate,
              targetTemplate: JSON.stringify({ Resources: {} }),
            })
          ).rejects.toThrow();
        }
      ),
      { numRuns: invalidTemplates.length }
    );
  });
});
