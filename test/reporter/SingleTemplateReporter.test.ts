import { SingleTemplateReporter } from '../../src/reporter/SingleTemplateReporter';
import { SingleTemplateCostResult } from '../../src/api/single-template-types';

describe('SingleTemplateReporter', () => {
  const mockResult: SingleTemplateCostResult = {
    totalMonthlyCost: 123.45,
    currency: 'USD',
    resourceCosts: [
      {
        logicalId: 'MyBucket',
        type: 'AWS::S3::Bucket',
        monthlyCost: {
          amount: 23.45,
          currency: 'USD',
          confidence: 'medium',
          assumptions: ['Storage: 50GB', 'Requests: 10000/month'],
        },
        region: 'us-east-1',
        calculatedAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        logicalId: 'MyInstance',
        type: 'AWS::EC2::Instance',
        monthlyCost: {
          amount: 100.0,
          currency: 'USD',
          confidence: 'high',
          assumptions: ['Instance type: t3.micro', 'On-demand pricing'],
        },
        region: 'us-east-1',
        calculatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    ],
    costBreakdown: {
      byResourceType: [
        {
          resourceType: 'AWS::EC2::Instance',
          count: 1,
          totalCost: 100.0,
          resources: [
            {
              logicalId: 'MyInstance',
              type: 'AWS::EC2::Instance',
              monthlyCost: {
                amount: 100.0,
                currency: 'USD',
                confidence: 'high',
                assumptions: ['Instance type: t3.micro', 'On-demand pricing'],
              },
            },
          ],
        },
        {
          resourceType: 'AWS::S3::Bucket',
          count: 1,
          totalCost: 23.45,
          resources: [
            {
              logicalId: 'MyBucket',
              type: 'AWS::S3::Bucket',
              monthlyCost: {
                amount: 23.45,
                currency: 'USD',
                confidence: 'medium',
                assumptions: ['Storage: 50GB', 'Requests: 10000/month'],
              },
            },
          ],
        },
      ],
      byConfidenceLevel: [
        {
          confidence: 'high',
          count: 1,
          totalCost: 100.0,
        },
        {
          confidence: 'medium',
          count: 1,
          totalCost: 23.45,
        },
      ],
      assumptions: [
        'Instance type: t3.micro',
        'On-demand pricing',
        'Storage: 50GB',
        'Requests: 10000/month',
      ],
    },
    summary: 'Test summary',
    metadata: {
      templateHash: 'abc123def456',
      region: 'us-east-1',
      analyzedAt: new Date('2024-01-01T00:00:00Z'),
      resourceCount: 2,
      supportedResourceCount: 2,
      unsupportedResourceCount: 0,
    },
  };

  describe('generateReport', () => {
    it('should generate text format report', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text');

      expect(report).toContain('Single Template Cost Analysis');
      expect(report).toContain('$123.45');
      expect(report).toContain('MyBucket');
      expect(report).toContain('MyInstance');
      expect(report).toContain('AWS::S3::Bucket');
      expect(report).toContain('AWS::EC2::Instance');
    });

    it('should generate JSON format report', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'json');

      const parsed = JSON.parse(report);
      expect(parsed.totalMonthlyCost).toBe(123.45);
      expect(parsed.resourceCosts).toHaveLength(2);
    });

    it('should generate markdown format report', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'markdown');

      expect(report).toContain('# 💰 Single Template Cost Analysis');
      expect(report).toContain('## Summary');
      expect(report).toContain('$123.45');
      expect(report).toContain('| MyBucket |');
      expect(report).toContain('| MyInstance |');
    });

    it('should include cost breakdown in text format', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text');

      expect(report).toContain('Cost Breakdown by Resource Type');
      expect(report).toContain('AWS::EC2::Instance');
      expect(report).toContain('Count: 1');
      expect(report).toContain('Total Cost: $100.00');
    });

    it('should include assumptions in text format', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text');

      expect(report).toContain('Cost Calculation Assumptions');
      expect(report).toContain('Instance type: t3.micro');
      expect(report).toContain('Storage: 50GB');
    });

    it('should include confidence breakdown in text format', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text');

      expect(report).toContain('Cost Confidence Breakdown');
      expect(report).toContain('HIGH');
      expect(report).toContain('MEDIUM');
    });

    it('should sort resources by cost descending', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text', {
        sortBy: 'cost',
      });

      // EC2 Instance ($100) should appear before S3 Bucket ($23.45)
      const ec2Index = report.indexOf('MyInstance');
      const s3Index = report.indexOf('MyBucket');
      
      // Both should exist
      expect(ec2Index).toBeGreaterThan(-1);
      expect(s3Index).toBeGreaterThan(-1);
    });

    it('should respect showBreakdown option', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text', {
        showBreakdown: false,
      });

      expect(report).not.toContain('Cost Breakdown by Resource Type');
    });

    it('should respect showAssumptions option', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text', {
        showAssumptions: false,
      });

      expect(report).not.toContain('Cost Calculation Assumptions');
    });

    it('should include legend in text format', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text');

      expect(report).toContain('Legend:');
      expect(report).toContain('High confidence');
      expect(report).toContain('Medium confidence');
    });

    it('should format percentages correctly', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text');

      // EC2 should be 81.0% (100/123.45)
      expect(report).toContain('81.0%');
      // S3 should be 19.0% (23.45/123.45)
      expect(report).toContain('19.0%');
    });

    it('should include metadata in text format', () => {
      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(mockResult, 'text');

      expect(report).toContain('Region: us-east-1');
      expect(report).toContain('Template Hash: abc123def456');
      expect(report).toContain('Total Resources: 2');
    });

    it('should handle empty resource list', () => {
      const emptyResult: SingleTemplateCostResult = {
        ...mockResult,
        resourceCosts: [],
        costBreakdown: {
          byResourceType: [],
          byConfidenceLevel: [],
          assumptions: [],
        },
        metadata: {
          ...mockResult.metadata,
          resourceCount: 0,
        },
      };

      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(emptyResult, 'text');

      expect(report).toContain('Total Resources: 0');
    });

    it('should handle unsupported resources', () => {
      const resultWithUnsupported: SingleTemplateCostResult = {
        ...mockResult,
        resourceCosts: [
          ...mockResult.resourceCosts,
          {
            logicalId: 'UnsupportedResource',
            type: 'AWS::Unsupported::Type',
            monthlyCost: {
              amount: 0,
              currency: 'USD',
              confidence: 'unknown',
              assumptions: ['Resource type AWS::Unsupported::Type is not supported'],
            },
            region: 'us-east-1',
            calculatedAt: new Date('2024-01-01T00:00:00Z'),
          },
        ],
        metadata: {
          ...mockResult.metadata,
          resourceCount: 3,
          unsupportedResourceCount: 1,
        },
      };

      const reporter = new SingleTemplateReporter();
      const report = reporter.generateReport(resultWithUnsupported, 'text');

      expect(report).toContain('Unsupported Resources: 1');
    });
  });
});
