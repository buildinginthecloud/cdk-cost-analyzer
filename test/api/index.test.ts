// Jest imports are global
import {
  analyzeCosts,
  TemplateParseError,
  PricingAPIError,
  UnsupportedResourceError,
  AnalyzeOptions,
  CostAnalysisResult,
} from '../../src/api';

describe('analyzeCosts API', () => {
  const baseTemplate = JSON.stringify({
    Resources: {
      Bucket1: {
        Type: 'AWS::S3::Bucket',
        Properties: {},
      },
    },
  });

  const targetTemplate = JSON.stringify({
    Resources: {
      Bucket1: {
        Type: 'AWS::S3::Bucket',
        Properties: {},
      },
      Bucket2: {
        Type: 'AWS::S3::Bucket',
        Properties: {},
      },
    },
  });

  it('should return structured results for valid templates', async () => {
    const result = await analyzeCosts({
      baseTemplate,
      targetTemplate,
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
  });

  it('should use default region if not specified', async () => {
    const result = await analyzeCosts({
      baseTemplate,
      targetTemplate,
    });

    expect(result).toBeDefined();
  });

  it('should throw error for invalid base template', async () => {
    await expect(
      analyzeCosts({
        baseTemplate: 'invalid json',
        targetTemplate,
      }),
    ).rejects.toThrow();
  });

  it('should throw error for invalid target template', async () => {
    await expect(
      analyzeCosts({
        baseTemplate,
        targetTemplate: 'invalid json',
      }),
    ).rejects.toThrow();
  });

  it('should throw error for missing templates', async () => {
    await expect(
      analyzeCosts({
        baseTemplate: '',
        targetTemplate: '',
      }),
    ).rejects.toThrow();
  });

  it('should identify added resources', async () => {
    const result = await analyzeCosts({
      baseTemplate,
      targetTemplate,
    });

    expect(result.addedResources.length).toBeGreaterThan(0);
    expect(result.addedResources[0].logicalId).toBe('Bucket2');
  });

  it('should handle invalid region gracefully', async () => {
    // Invalid region should not cause a crash, but may result in pricing failures
    // The system should handle this gracefully and continue processing
    const result = await analyzeCosts({
      baseTemplate,
      targetTemplate,
      region: 'invalid-region-123',
    });

    // Should still return a valid result structure
    expect(result).toHaveProperty('totalDelta');
    expect(result).toHaveProperty('currency');
    expect(result).toHaveProperty('addedResources');
    expect(result).toHaveProperty('removedResources');
    expect(result).toHaveProperty('modifiedResources');
    expect(result).toHaveProperty('summary');
  });

  it('should support text output format', async () => {
    const result = await analyzeCosts({
      baseTemplate,
      targetTemplate,
      format: 'text',
    });

    expect(result.summary).toBeDefined();
    expect(typeof result.summary).toBe('string');
  });

  it('should support json output format', async () => {
    const result = await analyzeCosts({
      baseTemplate,
      targetTemplate,
      format: 'json',
    });

    expect(result.summary).toBeDefined();
    // JSON format should produce valid JSON string
    expect(() => JSON.parse(result.summary)).not.toThrow();
  });
});

describe('API Type Definitions', () => {
  it('should export AnalyzeOptions type', () => {
    const options: AnalyzeOptions = {
      baseTemplate: '{}',
      targetTemplate: '{}',
      region: 'us-east-1',
      format: 'text',
    };

    expect(options).toBeDefined();
    expect(options.baseTemplate).toBe('{}');
    expect(options.targetTemplate).toBe('{}');
    expect(options.region).toBe('us-east-1');
    expect(options.format).toBe('text');
  });

  it('should export CostAnalysisResult type', () => {
    const result: CostAnalysisResult = {
      totalDelta: 100,
      currency: 'USD',
      addedResources: [],
      removedResources: [],
      modifiedResources: [],
      summary: 'test summary',
    };

    expect(result).toBeDefined();
    expect(result.totalDelta).toBe(100);
    expect(result.currency).toBe('USD');
    expect(Array.isArray(result.addedResources)).toBe(true);
    expect(Array.isArray(result.removedResources)).toBe(true);
    expect(Array.isArray(result.modifiedResources)).toBe(true);
    expect(result.summary).toBe('test summary');
  });

  it('should export TemplateParseError', () => {
    const error = new TemplateParseError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TemplateParseError');
    expect(error.message).toBe('Test error');
  });

  it('should export PricingAPIError', () => {
    const error = new PricingAPIError('Test pricing error');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PricingAPIError');
    expect(error.message).toBe('Test pricing error');
  });

  it('should export UnsupportedResourceError', () => {
    const error = new UnsupportedResourceError('AWS::Custom::Resource');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('UnsupportedResourceError');
    expect(error.resourceType).toBe('AWS::Custom::Resource');
  });
});
