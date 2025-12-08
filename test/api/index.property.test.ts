import * as fc from 'fast-check';
import { describe, it, expect, vi } from 'vitest';
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
    'AWS::Lambda::Function',
  );

  const resourceArb = fc.record({
    Type: resourceTypeArb,
    Properties: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())),
  });

  const templateArb = fc.dictionary(
    fc.string().filter(s => s.length > 0),
    resourceArb,
    { minKeys: 1, maxKeys: 3 },
  ).map(resources => ({
    Resources: resources,
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
      { numRuns: 100 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 16: API throws errors for invalid inputs
  it('should throw descriptive errors for malformed JSON templates', () => {
    const invalidJsonArb = fc.constantFrom(
      'invalid json',
      '{ incomplete',
      '{ "key": }',
      '[1, 2, 3',
      'not json at all',
      '{"key": undefined}',
    );

    fc.assert(
      fc.asyncProperty(
        invalidJsonArb,
        fc.constantFrom('base', 'target'),
        async (invalidJson, templateType) => {
          const validTemplate = JSON.stringify({ Resources: { Bucket: { Type: 'AWS::S3::Bucket', Properties: {} } } });

          const options = templateType === 'base'
            ? { baseTemplate: invalidJson, targetTemplate: validTemplate }
            : { baseTemplate: validTemplate, targetTemplate: invalidJson };

          await expect(analyzeCosts(options)).rejects.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should throw descriptive errors for templates without Resources section', () => {
    const invalidStructureArb = fc.constantFrom(
      '{}',
      '{ "Parameters": {} }',
      '{ "Outputs": {} }',
      '{ "Description": "test" }',
      '{ "AWSTemplateFormatVersion": "2010-09-09" }',
      '{ "Metadata": {} }',
    );

    fc.assert(
      fc.asyncProperty(
        invalidStructureArb,
        fc.constantFrom('base', 'target'),
        async (invalidStructure, templateType) => {
          const validTemplate = JSON.stringify({ Resources: { Bucket: { Type: 'AWS::S3::Bucket', Properties: {} } } });

          const options = templateType === 'base'
            ? { baseTemplate: invalidStructure, targetTemplate: validTemplate }
            : { baseTemplate: validTemplate, targetTemplate: invalidStructure };

          await expect(analyzeCosts(options)).rejects.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should throw descriptive errors for empty templates', () => {
    const emptyTemplateArb = fc.constantFrom(
      '',
      '   ',
      '\n',
      '\t',
      '  \n  \t  ',
    );

    fc.assert(
      fc.asyncProperty(
        emptyTemplateArb,
        fc.constantFrom('base', 'target'),
        async (emptyTemplate, templateType) => {
          const validTemplate = JSON.stringify({ Resources: { Bucket: { Type: 'AWS::S3::Bucket', Properties: {} } } });

          const options = templateType === 'base'
            ? { baseTemplate: emptyTemplate, targetTemplate: validTemplate }
            : { baseTemplate: validTemplate, targetTemplate: emptyTemplate };

          await expect(analyzeCosts(options)).rejects.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should throw descriptive errors for missing required parameters', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { baseTemplate: '', targetTemplate: '' },
          { baseTemplate: '', targetTemplate: JSON.stringify({ Resources: {} }) },
          { baseTemplate: JSON.stringify({ Resources: {} }), targetTemplate: '' },
        ),
        async (options) => {
          await expect(analyzeCosts(options)).rejects.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should throw descriptive errors for templates with invalid Resources type', () => {
    const invalidResourcesArb = fc.constantFrom(
      '{ "Resources": "string" }',
      '{ "Resources": 123 }',
      '{ "Resources": null }',
      '{ "Resources": [] }',
      '{ "Resources": true }',
    );

    fc.assert(
      fc.asyncProperty(
        invalidResourcesArb,
        fc.constantFrom('base', 'target'),
        async (invalidTemplate, templateType) => {
          const validTemplate = JSON.stringify({ Resources: { Bucket: { Type: 'AWS::S3::Bucket', Properties: {} } } });

          const options = templateType === 'base'
            ? { baseTemplate: invalidTemplate, targetTemplate: validTemplate }
            : { baseTemplate: validTemplate, targetTemplate: invalidTemplate };

          await expect(analyzeCosts(options)).rejects.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
