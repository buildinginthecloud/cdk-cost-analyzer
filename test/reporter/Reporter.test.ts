import { describe, it, expect } from 'vitest';
import { Reporter } from '../../src/reporter/Reporter';
import { CostDelta } from '../../src/pricing/types';

describe('Reporter', () => {
  const reporter = new Reporter();

  const sampleCostDelta: CostDelta = {
    totalDelta: 150.50,
    currency: 'USD',
    addedCosts: [
      {
        logicalId: 'NewInstance',
        type: 'AWS::EC2::Instance',
        monthlyCost: {
          amount: 100.00,
          currency: 'USD',
          confidence: 'high',
          assumptions: [],
        },
      },
      {
        logicalId: 'NewBucket',
        type: 'AWS::S3::Bucket',
        monthlyCost: {
          amount: 25.00,
          currency: 'USD',
          confidence: 'medium',
          assumptions: [],
        },
      },
    ],
    removedCosts: [
      {
        logicalId: 'OldFunction',
        type: 'AWS::Lambda::Function',
        monthlyCost: {
          amount: 10.00,
          currency: 'USD',
          confidence: 'medium',
          assumptions: [],
        },
      },
    ],
    modifiedCosts: [
      {
        logicalId: 'UpdatedInstance',
        type: 'AWS::EC2::Instance',
        monthlyCost: {
          amount: 200.00,
          currency: 'USD',
          confidence: 'high',
          assumptions: [],
        },
        oldMonthlyCost: {
          amount: 150.00,
          currency: 'USD',
          confidence: 'high',
          assumptions: [],
        },
        newMonthlyCost: {
          amount: 200.00,
          currency: 'USD',
          confidence: 'high',
          assumptions: [],
        },
        costDelta: 50.00,
      },
    ],
  };

  describe('text report', () => {
    it('should generate text report with all sections', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');

      expect(report).toContain('CDK Cost Analysis Report');
      expect(report).toContain('Total Cost Delta: +$150.50');
      expect(report).toContain('ADDED RESOURCES:');
      expect(report).toContain('REMOVED RESOURCES:');
      expect(report).toContain('MODIFIED RESOURCES:');
      expect(report).toContain('NewInstance');
      expect(report).toContain('NewBucket');
      expect(report).toContain('OldFunction');
      expect(report).toContain('UpdatedInstance');
    });

    it('should generate report with only added resources', () => {
      const addedOnlyDelta: CostDelta = {
        totalDelta: 125.00,
        currency: 'USD',
        addedCosts: [
          {
            logicalId: 'NewInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 100.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
          {
            logicalId: 'NewBucket',
            type: 'AWS::S3::Bucket',
            monthlyCost: {
              amount: 25.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
          },
        ],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(addedOnlyDelta, 'text');
      
      expect(report).toContain('ADDED RESOURCES:');
      expect(report).not.toContain('REMOVED RESOURCES:');
      expect(report).not.toContain('MODIFIED RESOURCES:');
      expect(report).toContain('NewInstance');
      expect(report).toContain('AWS::EC2::Instance');
      expect(report).toContain('$100.00');
      expect(report).toContain('[high]');
    });

    it('should generate report with only removed resources', () => {
      const removedOnlyDelta: CostDelta = {
        totalDelta: -75.00,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [
          {
            logicalId: 'OldInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 50.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
          {
            logicalId: 'OldFunction',
            type: 'AWS::Lambda::Function',
            monthlyCost: {
              amount: 25.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
          },
        ],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(removedOnlyDelta, 'text');
      
      expect(report).not.toContain('ADDED RESOURCES:');
      expect(report).toContain('REMOVED RESOURCES:');
      expect(report).not.toContain('MODIFIED RESOURCES:');
      expect(report).toContain('OldInstance');
      expect(report).toContain('AWS::Lambda::Function');
      expect(report).toContain('$50.00');
    });

    it('should generate report with only modified resources', () => {
      const modifiedOnlyDelta: CostDelta = {
        totalDelta: 50.00,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [
          {
            logicalId: 'UpdatedInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 200.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            oldMonthlyCost: {
              amount: 150.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            newMonthlyCost: {
              amount: 200.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            costDelta: 50.00,
          },
        ],
      };

      const report = reporter.generateReport(modifiedOnlyDelta, 'text');
      
      expect(report).not.toContain('ADDED RESOURCES:');
      expect(report).not.toContain('REMOVED RESOURCES:');
      expect(report).toContain('MODIFIED RESOURCES:');
      expect(report).toContain('UpdatedInstance');
      expect(report).toContain('$150.00 → $200.00');
      expect(report).toContain('(+$50.00)');
    });

    it('should sort added resources by cost impact (descending)', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      
      const newInstanceIndex = report.indexOf('NewInstance');
      const newBucketIndex = report.indexOf('NewBucket');
      
      expect(newInstanceIndex).toBeLessThan(newBucketIndex);
    });

    it('should sort removed resources by cost impact (descending)', () => {
      const multipleRemovedDelta: CostDelta = {
        totalDelta: -150.00,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [
          {
            logicalId: 'SmallFunction',
            type: 'AWS::Lambda::Function',
            monthlyCost: {
              amount: 10.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
          },
          {
            logicalId: 'LargeInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 140.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
        ],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(multipleRemovedDelta, 'text');
      
      const largeInstanceIndex = report.indexOf('LargeInstance');
      const smallFunctionIndex = report.indexOf('SmallFunction');
      
      expect(largeInstanceIndex).toBeLessThan(smallFunctionIndex);
    });

    it('should sort modified resources by absolute cost delta (descending)', () => {
      const multipleModifiedDelta: CostDelta = {
        totalDelta: 0,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [
          {
            logicalId: 'SmallChange',
            type: 'AWS::Lambda::Function',
            monthlyCost: {
              amount: 15.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
            oldMonthlyCost: {
              amount: 10.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
            newMonthlyCost: {
              amount: 15.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
            costDelta: 5.00,
          },
          {
            logicalId: 'LargeChange',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 250.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            oldMonthlyCost: {
              amount: 150.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            newMonthlyCost: {
              amount: 250.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            costDelta: 100.00,
          },
        ],
      };

      const report = reporter.generateReport(multipleModifiedDelta, 'text');
      
      const largeChangeIndex = report.indexOf('LargeChange');
      const smallChangeIndex = report.indexOf('SmallChange');
      
      expect(largeChangeIndex).toBeLessThan(smallChangeIndex);
    });

    it('should format positive delta with plus sign', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('+$150.50');
    });

    it('should format negative delta with minus sign', () => {
      const negativeDelta: CostDelta = {
        ...sampleCostDelta,
        totalDelta: -50.00,
      };

      const report = reporter.generateReport(negativeDelta, 'text');
      expect(report).toContain('-$50.00');
    });

    it('should format zero delta without sign', () => {
      const zeroDelta: CostDelta = {
        totalDelta: 0,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(zeroDelta, 'text');
      expect(report).toContain('Total Cost Delta: $0.00');
      expect(report).not.toContain('+$0.00');
      expect(report).not.toContain('-$0.00');
    });

    it('should format currency with exactly 2 decimal places', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('$100.00');
      expect(report).toContain('$25.00');
      expect(report).toContain('$10.00');
      expect(report).toContain('$150.50');
    });

    it('should format currency with dollar symbol for USD', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toMatch(/\$\d+\.\d{2}/);
    });

    it('should include resource logical ID in report', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('NewInstance');
      expect(report).toContain('NewBucket');
      expect(report).toContain('OldFunction');
      expect(report).toContain('UpdatedInstance');
    });

    it('should include resource type in report', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('AWS::EC2::Instance');
      expect(report).toContain('AWS::S3::Bucket');
      expect(report).toContain('AWS::Lambda::Function');
    });

    it('should include confidence level for resources', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('[high]');
      expect(report).toContain('[medium]');
    });

    it('should handle empty cost delta', () => {
      const emptyCostDelta: CostDelta = {
        totalDelta: 0,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(emptyCostDelta, 'text');
      expect(report).toContain('No resource changes detected');
    });

    it('should display modified resource with old and new costs', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('$150.00 → $200.00');
    });

    it('should display modified resource delta in parentheses', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('(+$50.00)');
    });
  });

  describe('json report', () => {
    it('should generate valid JSON', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      
      const parsed = JSON.parse(report);
      expect(parsed).toBeDefined();
      expect(parsed.totalDelta).toBe(150.50);
      expect(parsed.currency).toBe('USD');
    });

    it('should include all required fields', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed).toHaveProperty('totalDelta');
      expect(parsed).toHaveProperty('currency');
      expect(parsed).toHaveProperty('addedCosts');
      expect(parsed).toHaveProperty('removedCosts');
      expect(parsed).toHaveProperty('modifiedCosts');
    });

    it('should match expected schema structure', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(typeof parsed.totalDelta).toBe('number');
      expect(typeof parsed.currency).toBe('string');
      expect(Array.isArray(parsed.addedCosts)).toBe(true);
      expect(Array.isArray(parsed.removedCosts)).toBe(true);
      expect(Array.isArray(parsed.modifiedCosts)).toBe(true);
    });

    it('should include complete resource data in addedCosts', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.addedCosts).toHaveLength(2);
      
      const firstResource = parsed.addedCosts[0];
      expect(firstResource).toHaveProperty('logicalId');
      expect(firstResource).toHaveProperty('type');
      expect(firstResource).toHaveProperty('monthlyCost');
      expect(firstResource.monthlyCost).toHaveProperty('amount');
      expect(firstResource.monthlyCost).toHaveProperty('currency');
      expect(firstResource.monthlyCost).toHaveProperty('confidence');
      expect(firstResource.monthlyCost).toHaveProperty('assumptions');
    });

    it('should include complete resource data in removedCosts', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.removedCosts).toHaveLength(1);
      
      const firstResource = parsed.removedCosts[0];
      expect(firstResource).toHaveProperty('logicalId');
      expect(firstResource).toHaveProperty('type');
      expect(firstResource).toHaveProperty('monthlyCost');
      expect(firstResource.monthlyCost).toHaveProperty('amount');
      expect(firstResource.monthlyCost).toHaveProperty('currency');
      expect(firstResource.monthlyCost).toHaveProperty('confidence');
      expect(firstResource.monthlyCost).toHaveProperty('assumptions');
    });

    it('should include complete resource data in modifiedCosts', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.modifiedCosts).toHaveLength(1);
      
      const firstResource = parsed.modifiedCosts[0];
      expect(firstResource).toHaveProperty('logicalId');
      expect(firstResource).toHaveProperty('type');
      expect(firstResource).toHaveProperty('monthlyCost');
      expect(firstResource).toHaveProperty('oldMonthlyCost');
      expect(firstResource).toHaveProperty('newMonthlyCost');
      expect(firstResource).toHaveProperty('costDelta');
      
      expect(firstResource.oldMonthlyCost).toHaveProperty('amount');
      expect(firstResource.oldMonthlyCost).toHaveProperty('currency');
      expect(firstResource.oldMonthlyCost).toHaveProperty('confidence');
      expect(firstResource.newMonthlyCost).toHaveProperty('amount');
      expect(firstResource.newMonthlyCost).toHaveProperty('currency');
      expect(firstResource.newMonthlyCost).toHaveProperty('confidence');
    });

    it('should preserve exact numeric values', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.totalDelta).toBe(150.50);
      expect(parsed.addedCosts[0].monthlyCost.amount).toBe(100.00);
      expect(parsed.addedCosts[1].monthlyCost.amount).toBe(25.00);
      expect(parsed.removedCosts[0].monthlyCost.amount).toBe(10.00);
      expect(parsed.modifiedCosts[0].costDelta).toBe(50.00);
    });

    it('should preserve string values correctly', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.currency).toBe('USD');
      expect(parsed.addedCosts[0].logicalId).toBe('NewInstance');
      expect(parsed.addedCosts[0].type).toBe('AWS::EC2::Instance');
      expect(parsed.addedCosts[0].monthlyCost.confidence).toBe('high');
    });

    it('should handle empty cost delta', () => {
      const emptyCostDelta: CostDelta = {
        totalDelta: 0,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(emptyCostDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.totalDelta).toBe(0);
      expect(parsed.addedCosts).toHaveLength(0);
      expect(parsed.removedCosts).toHaveLength(0);
      expect(parsed.modifiedCosts).toHaveLength(0);
    });

    it('should be parseable by JSON.parse without errors', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      
      expect(() => JSON.parse(report)).not.toThrow();
    });

    it('should produce well-formatted JSON with proper indentation', () => {
      const report = reporter.generateReport(sampleCostDelta, 'json');
      
      expect(report).toContain('\n');
      expect(report).toContain('  ');
      
      const parsed = JSON.parse(report);
      const reformatted = JSON.stringify(parsed, null, 2);
      expect(report).toBe(reformatted);
    });

    it('should handle resources with assumptions', () => {
      const deltaWithAssumptions: CostDelta = {
        totalDelta: 50.00,
        currency: 'USD',
        addedCosts: [
          {
            logicalId: 'NewBucket',
            type: 'AWS::S3::Bucket',
            monthlyCost: {
              amount: 50.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: ['100 GB standard storage', '10,000 GET requests/month'],
            },
          },
        ],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(deltaWithAssumptions, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.addedCosts[0].monthlyCost.assumptions).toHaveLength(2);
      expect(parsed.addedCosts[0].monthlyCost.assumptions[0]).toBe('100 GB standard storage');
      expect(parsed.addedCosts[0].monthlyCost.assumptions[1]).toBe('10,000 GET requests/month');
    });

    it('should handle all confidence levels', () => {
      const deltaWithConfidenceLevels: CostDelta = {
        totalDelta: 100.00,
        currency: 'USD',
        addedCosts: [
          {
            logicalId: 'HighConfidence',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 25.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
          {
            logicalId: 'MediumConfidence',
            type: 'AWS::S3::Bucket',
            monthlyCost: {
              amount: 25.00,
              currency: 'USD',
              confidence: 'medium',
              assumptions: [],
            },
          },
          {
            logicalId: 'LowConfidence',
            type: 'AWS::Lambda::Function',
            monthlyCost: {
              amount: 25.00,
              currency: 'USD',
              confidence: 'low',
              assumptions: [],
            },
          },
          {
            logicalId: 'UnknownConfidence',
            type: 'AWS::Custom::Resource',
            monthlyCost: {
              amount: 25.00,
              currency: 'USD',
              confidence: 'unknown',
              assumptions: [],
            },
          },
        ],
        removedCosts: [],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(deltaWithConfidenceLevels, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.addedCosts[0].monthlyCost.confidence).toBe('high');
      expect(parsed.addedCosts[1].monthlyCost.confidence).toBe('medium');
      expect(parsed.addedCosts[2].monthlyCost.confidence).toBe('low');
      expect(parsed.addedCosts[3].monthlyCost.confidence).toBe('unknown');
    });

    it('should handle negative total delta', () => {
      const negativeDelta: CostDelta = {
        totalDelta: -75.00,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [
          {
            logicalId: 'OldInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 75.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
          },
        ],
        modifiedCosts: [],
      };

      const report = reporter.generateReport(negativeDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.totalDelta).toBe(-75.00);
    });

    it('should handle modified resources with negative cost delta', () => {
      const modifiedWithNegativeDelta: CostDelta = {
        totalDelta: -50.00,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [
          {
            logicalId: 'DownsizedInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: {
              amount: 100.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            oldMonthlyCost: {
              amount: 150.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            newMonthlyCost: {
              amount: 100.00,
              currency: 'USD',
              confidence: 'high',
              assumptions: [],
            },
            costDelta: -50.00,
          },
        ],
      };

      const report = reporter.generateReport(modifiedWithNegativeDelta, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.modifiedCosts[0].costDelta).toBe(-50.00);
    });
  });

  describe('markdown report', () => {
    it('should generate markdown with tables', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');

      expect(report).toContain('# CDK Cost Analysis Report');
      expect(report).toContain('## Added Resources');
      expect(report).toContain('| Logical ID | Type | Monthly Cost |');
      expect(report).toContain('NewInstance');
    });
  });
});
