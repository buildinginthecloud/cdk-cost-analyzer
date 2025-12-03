import { describe, it, expect, vi } from 'vitest';
import { analyzeCosts, TemplateParseError } from '../../src/api';

vi.mock('@aws-sdk/client-pricing', () => ({
  PricingClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  GetProductsCommand: vi.fn(),
}));

describe('analyzeCosts API', () => {
  const baseTemplate = JSON.stringify({
    Resources: {
      Bucket1: {
        Type: 'AWS::S3::Bucket',
        Properties: {}
      }
    }
  });

  const targetTemplate = JSON.stringify({
    Resources: {
      Bucket1: {
        Type: 'AWS::S3::Bucket',
        Properties: {}
      },
      Bucket2: {
        Type: 'AWS::S3::Bucket',
        Properties: {}
      }
    }
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
      })
    ).rejects.toThrow();
  });

  it('should throw error for invalid target template', async () => {
    await expect(
      analyzeCosts({
        baseTemplate,
        targetTemplate: 'invalid json',
      })
    ).rejects.toThrow();
  });

  it('should throw error for missing templates', async () => {
    await expect(
      analyzeCosts({
        baseTemplate: '',
        targetTemplate: '',
      })
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
});
