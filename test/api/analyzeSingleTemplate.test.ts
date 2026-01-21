import { analyzeSingleTemplate } from '../../src/api';

describe('analyzeSingleTemplate API', () => {
  it('should analyze a simple template', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
      region: 'us-east-1',
      format: 'text',
    });

    expect(result).toBeDefined();
    expect(result.totalMonthlyCost).toBeGreaterThanOrEqual(0);
    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('should throw error when template is missing', async () => {
    await expect(
      analyzeSingleTemplate({
        template: '',
      }),
    ).rejects.toThrow('Template content is required');
  });

  it('should use default region when not specified', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
    });

    expect(result.metadata.region).toBe('eu-central-1');
  });

  it('should generate text format summary by default', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
    });

    expect(result.summary).toContain('Single Template Cost Analysis');
    expect(result.summary).toContain('Total Monthly Cost');
  });

  it('should generate JSON format summary when requested', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
      format: 'json',
    });

    // Summary should be valid JSON
    expect(() => JSON.parse(result.summary)).not.toThrow();
  });

  it('should generate markdown format summary when requested', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
      format: 'markdown',
    });

    expect(result.summary).toContain('# Single Template Cost Analysis');
    expect(result.summary).toContain('## Summary');
  });

  it('should apply configuration when provided', async () => {
    const template = JSON.stringify({
      Resources: {
        MyFunction: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            Runtime: 'nodejs20.x',
            MemorySize: 128,
          },
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
      region: 'us-east-1',
      config: {
        usageAssumptions: {
          lambda: {
            invocationsPerMonth: 10000000,
            averageDurationMs: 1000,
          },
        },
      },
    });

    expect(result).toBeDefined();
    expect(result.totalMonthlyCost).toBeGreaterThan(0);
  });

  it('should handle invalid JSON templates', async () => {
    const invalidTemplate = '{ invalid json }';

    await expect(
      analyzeSingleTemplate({
        template: invalidTemplate,
      }),
    ).rejects.toThrow();
  });

  it('should handle YAML templates', async () => {
    const yamlTemplate = `
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties: {}
`;

    const result = await analyzeSingleTemplate({
      template: yamlTemplate,
      region: 'us-east-1',
    });

    expect(result).toBeDefined();
    expect(result.resourceCosts).toHaveLength(1);
  });

  it('should include resource costs in result', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
        MyTable: {
          Type: 'AWS::DynamoDB::Table',
          Properties: {
            BillingMode: 'PAY_PER_REQUEST',
          },
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
      region: 'us-east-1',
    });

    expect(result.resourceCosts).toHaveLength(2);
    expect(result.resourceCosts[0]).toHaveProperty('logicalId');
    expect(result.resourceCosts[0]).toHaveProperty('type');
    expect(result.resourceCosts[0]).toHaveProperty('monthlyCost');
    expect(result.resourceCosts[0]).toHaveProperty('region');
    expect(result.resourceCosts[0]).toHaveProperty('calculatedAt');
  });

  it('should include cost breakdown in result', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
      region: 'us-east-1',
    });

    expect(result.costBreakdown).toBeDefined();
    expect(result.costBreakdown.byResourceType).toBeDefined();
    expect(result.costBreakdown.byConfidenceLevel).toBeDefined();
    expect(result.costBreakdown.assumptions).toBeDefined();
  });

  it('should include metadata in result', async () => {
    const template = JSON.stringify({
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    });

    const result = await analyzeSingleTemplate({
      template,
      region: 'us-east-1',
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata.templateHash).toBeDefined();
    expect(result.metadata.region).toBe('us-east-1');
    expect(result.metadata.analyzedAt).toBeInstanceOf(Date);
    expect(result.metadata.resourceCount).toBe(1);
  });
});
