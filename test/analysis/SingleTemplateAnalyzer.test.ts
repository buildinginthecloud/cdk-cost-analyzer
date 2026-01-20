import { SingleTemplateAnalyzer } from '../../src/analysis/SingleTemplateAnalyzer';

describe('SingleTemplateAnalyzer', () => {
  describe('analyzeCosts', () => {
    it('should analyze a simple template with S3 bucket', async () => {
      const template = JSON.stringify({
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
        },
      });

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1');

      expect(result).toBeDefined();
      expect(result.totalMonthlyCost).toBeGreaterThanOrEqual(0);
      expect(result.currency).toBe('USD');
      expect(result.resourceCosts).toHaveLength(1);
      expect(result.resourceCosts[0].logicalId).toBe('MyBucket');
      expect(result.resourceCosts[0].type).toBe('AWS::S3::Bucket');
      expect(result.metadata.resourceCount).toBe(1);
    });

    it('should handle templates with multiple resources', async () => {
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

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1');

      expect(result.resourceCosts).toHaveLength(2);
      expect(result.metadata.resourceCount).toBe(2);
      expect(result.costBreakdown.byResourceType.length).toBeGreaterThan(0);
    });

    it('should handle unsupported resource types', async () => {
      const template = JSON.stringify({
        Resources: {
          UnsupportedResource: {
            Type: 'AWS::SomeUnsupported::Resource',
            Properties: {},
          },
        },
      });

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1');

      expect(result.resourceCosts).toHaveLength(1);
      expect(result.resourceCosts[0].monthlyCost.amount).toBe(0);
      expect(result.resourceCosts[0].monthlyCost.confidence).toBe('unknown');
      expect(result.metadata.unsupportedResourceCount).toBe(1);
    });

    it('should group resources by type in cost breakdown', async () => {
      const template = JSON.stringify({
        Resources: {
          Bucket1: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
          Bucket2: {
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

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1');

      expect(result.costBreakdown.byResourceType.length).toBeGreaterThan(0);
      
      // Find S3 bucket group
      const s3Group = result.costBreakdown.byResourceType.find(
        (g) => g.resourceType === 'AWS::S3::Bucket',
      );
      expect(s3Group).toBeDefined();
      expect(s3Group?.count).toBe(2);
      expect(s3Group?.resources).toHaveLength(2);
    });

    it('should sort resources by cost in descending order', async () => {
      const template = JSON.stringify({
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
          MyInstance: {
            Type: 'AWS::EC2::Instance',
            Properties: {
              InstanceType: 't3.micro',
            },
          },
        },
      });

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1');

      // Cost breakdown should be sorted by total cost descending
      for (let i = 0; i < result.costBreakdown.byResourceType.length - 1; i++) {
        expect(result.costBreakdown.byResourceType[i].totalCost).toBeGreaterThanOrEqual(
          result.costBreakdown.byResourceType[i + 1].totalCost,
        );
      }
    });

    it('should include metadata with template hash', async () => {
      const template = JSON.stringify({
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
        },
      });

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1');

      expect(result.metadata.templateHash).toBeDefined();
      expect(result.metadata.templateHash.length).toBe(16);
      expect(result.metadata.region).toBe('us-east-1');
      expect(result.metadata.analyzedAt).toBeInstanceOf(Date);
    });

    it('should collect all unique assumptions', async () => {
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

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1');

      expect(result.costBreakdown.assumptions).toBeDefined();
      expect(Array.isArray(result.costBreakdown.assumptions)).toBe(true);
    });

    it('should apply usage assumptions from config', async () => {
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

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1', {
        usageAssumptions: {
          lambda: {
            invocationsPerMonth: 5000000,
            averageDurationMs: 500,
          },
        },
      });

      expect(result).toBeDefined();
      // The Lambda cost should reflect the usage assumptions
      expect(result.totalMonthlyCost).toBeGreaterThan(0);
    });

    it('should exclude configured resource types', async () => {
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

      const analyzer = new SingleTemplateAnalyzer();
      const result = await analyzer.analyzeCosts(template, 'us-east-1', {
        excludedResourceTypes: ['AWS::S3::Bucket'],
      });

      // S3 bucket should have zero cost
      const s3Resource = result.resourceCosts.find(
        (rc) => rc.type === 'AWS::S3::Bucket',
      );
      expect(s3Resource?.monthlyCost.amount).toBe(0);
      expect(s3Resource?.monthlyCost.assumptions).toContain(
        'Resource type AWS::S3::Bucket is excluded from cost analysis',
      );
    });
  });
});
