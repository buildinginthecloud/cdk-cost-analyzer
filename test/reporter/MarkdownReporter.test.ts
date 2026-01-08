// Jest imports are global
import { CostDelta } from '../../src/pricing/types';
import { Reporter } from '../../src/reporter/Reporter';

describe('Markdown Reporter', () => {
  const reporter = new Reporter();

  describe('generateReport - markdown format', () => {
    it('should generate markdown report with added resources', () => {
      const costDelta: CostDelta = {
        totalDelta: 100.5,
        currency: 'USD',
        addedCosts: [
          {
            logicalId: 'MyInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 100.5,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
        ],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(costDelta, 'markdown');

      expect(report).toContain('# CDK Cost Analysis Report');
      expect(report).toContain('**Total Cost Delta:** +$100.50');
      expect(report).toContain('## Added Resources');
      expect(report).toContain('| Logical ID | Type | Monthly Cost |');
      expect(report).toContain('| MyInstance | AWS::EC2::Instance | $100.50 |');
    });

    it('should generate markdown report with removed resources', () => {
      const costDelta: CostDelta = {
        totalDelta: -50.25,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [
          {
            logicalId: 'OldBucket',
            type: 'AWS::S3::Bucket',
            monthlyCost: {
              amount: 50.25,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
          },
        ],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(costDelta, 'markdown');

      expect(report).toContain('**Total Cost Delta:** -$50.25');
      expect(report).toContain('## Removed Resources');
      expect(report).toContain('| OldBucket | AWS::S3::Bucket | $50.25 |');
    });

    it('should generate markdown report with modified resources', () => {
      const costDelta: CostDelta = {
        totalDelta: 25.0,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [
          {
            logicalId: 'MyFunction',
            type: 'AWS::Lambda::Function',
            monthlyCost: {
              amount: 75.0,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            oldMonthlyCost: {
              amount: 50.0,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            newMonthlyCost: {
              amount: 75.0,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            costDelta: 25.0,
          },
        ],
      };

      const report = reporter.generateReport(costDelta, 'markdown');

      expect(report).toContain('**Total Cost Delta:** +$25.00');
      expect(report).toContain('## Modified Resources');
      expect(report).toContain('| Logical ID | Type | Old Cost | New Cost | Delta |');
      expect(report).toContain('| MyFunction | AWS::Lambda::Function | $50.00 | $75.00 | +$25.00 |');
    });

    it('should generate markdown tables with proper formatting', () => {
      const costDelta: CostDelta = {
        totalDelta: 150.0,
        currency: 'USD',
        addedCosts: [
          {
            logicalId: 'Resource1',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 100.0,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
          {
            logicalId: 'Resource2',
            type: 'AWS::S3::Bucket',
            monthlyCost: {
              amount: 50.0,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
          },
        ],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(costDelta, 'markdown');

      expect(report).toContain('|------------|------|--------------|');
      expect(report.split('|').length).toBeGreaterThan(10);
    });

    it('should sort resources by cost in markdown report', () => {
      const costDelta: CostDelta = {
        totalDelta: 150.0,
        currency: 'USD',
        addedCosts: [
          {
            logicalId: 'Expensive',
            type: 'AWS::RDS::DBInstance',
            monthlyCost: {
              amount: 200.0,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
          {
            logicalId: 'Cheap',
            type: 'AWS::S3::Bucket',
            monthlyCost: {
              amount: 5.0,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
          },
          {
            logicalId: 'Medium',
            type: 'AWS::Lambda::Function',
            monthlyCost: {
              amount: 50.0,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
        ],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(costDelta, 'markdown');

      const expensiveIndex = report.indexOf('Expensive');
      const mediumIndex = report.indexOf('Medium');
      const cheapIndex = report.indexOf('Cheap');

      expect(expensiveIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(cheapIndex);
    });

    it('should handle zero cost delta', () => {
      const costDelta: CostDelta = {
        totalDelta: 0,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(costDelta, 'markdown');

      expect(report).toContain('# CDK Cost Analysis Report');
      expect(report).toContain('**Total Cost Delta:** $0.00');
    });

    it('should generate valid markdown structure', () => {
      const costDelta: CostDelta = {
        totalDelta: 100.0,
        currency: 'USD',
        addedCosts: [
          {
            logicalId: 'Resource',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 100.0,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
        ],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(costDelta, 'markdown');

      expect(report).toMatch(/^# /);
      expect(report).toContain('##');
      expect(report).toContain('**');
      expect(report).toContain('|');
    });
  });
});
