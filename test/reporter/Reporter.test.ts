import { describe, it, expect } from 'vitest';
import { ConfigSummary } from '../../src/pipeline/types';
import { CostDelta } from '../../src/pricing/types';
import { Reporter } from '../../src/reporter/Reporter';
import { ReportOptions } from '../../src/reporter/types';
import { ThresholdEvaluation } from '../../src/threshold/types';

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

  describe('configuration summary', () => {
    const configSummary: ConfigSummary = {
      configPath: '.cdk-cost-analyzer.yml',
      thresholds: {
        warning: 50,
        error: 200,
        environment: 'production',
      },
      usageAssumptions: {
        s3: {
          storageGB: 500,
          getRequests: 100000,
        },
        lambda: {
          invocationsPerMonth: 5000000,
        },
      },
      excludedResourceTypes: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      synthesisEnabled: true,
    };

    const options: ReportOptions = {
      configSummary,
    };

    describe('text format', () => {
      it('should include configuration summary in text report', () => {
        const report = reporter.generateReport(sampleCostDelta, 'text', options);

        expect(report).toContain('CONFIGURATION:');
        expect(report).toContain('Configuration File: .cdk-cost-analyzer.yml');
        expect(report).toContain('Environment: production');
        expect(report).toContain('Warning Threshold: $50.00/month');
        expect(report).toContain('Error Threshold: $200.00/month');
      });

      it('should show excluded resource types', () => {
        const report = reporter.generateReport(sampleCostDelta, 'text', options);

        expect(report).toContain('Excluded Resource Types: AWS::IAM::Role, AWS::IAM::Policy');
      });

      it('should show custom usage assumptions', () => {
        const report = reporter.generateReport(sampleCostDelta, 'text', options);

        expect(report).toContain('Custom Usage Assumptions:');
        expect(report).toContain('s3:');
        expect(report).toContain('lambda:');
      });

      it('should show default configuration when no config file', () => {
        const defaultOptions: ReportOptions = {
          configSummary: {
            synthesisEnabled: false,
          },
        };

        const report = reporter.generateReport(sampleCostDelta, 'text', defaultOptions);

        expect(report).toContain('Configuration File: Using defaults');
      });
    });

    describe('json format', () => {
      it('should include configuration summary in json report', () => {
        const report = reporter.generateReport(sampleCostDelta, 'json', options);
        const parsed = JSON.parse(report);

        expect(parsed.configSummary).toBeDefined();
        expect(parsed.configSummary.configPath).toBe('.cdk-cost-analyzer.yml');
        expect(parsed.configSummary.thresholds.warning).toBe(50);
        expect(parsed.configSummary.thresholds.error).toBe(200);
        expect(parsed.configSummary.thresholds.environment).toBe('production');
      });

      it('should include usage assumptions in json report', () => {
        const report = reporter.generateReport(sampleCostDelta, 'json', options);
        const parsed = JSON.parse(report);

        expect(parsed.configSummary.usageAssumptions).toBeDefined();
        expect(parsed.configSummary.usageAssumptions.s3).toBeDefined();
        expect(parsed.configSummary.usageAssumptions.lambda).toBeDefined();
      });

      it('should include excluded resource types in json report', () => {
        const report = reporter.generateReport(sampleCostDelta, 'json', options);
        const parsed = JSON.parse(report);

        expect(parsed.configSummary.excludedResourceTypes).toEqual([
          'AWS::IAM::Role',
          'AWS::IAM::Policy',
        ]);
      });
    });

    describe('markdown format', () => {
      it('should include configuration summary as collapsible section', () => {
        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('<details>');
        expect(report).toContain('<summary><strong>Configuration Summary</strong></summary>');
        expect(report).toContain('</details>');
      });

      it('should show configuration file path', () => {
        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('**Configuration File:** `.cdk-cost-analyzer.yml`');
      });

      it('should show thresholds', () => {
        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('**Thresholds:**');
        expect(report).toContain('Environment: production');
        expect(report).toContain('Warning: $50.00/month');
        expect(report).toContain('Error: $200.00/month');
      });

      it('should show excluded resource types', () => {
        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('**Excluded Resource Types:**');
        expect(report).toContain('`AWS::IAM::Role`');
        expect(report).toContain('`AWS::IAM::Policy`');
      });

      it('should show custom usage assumptions', () => {
        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('**Custom Usage Assumptions:**');
        expect(report).toContain('**s3:**');
        expect(report).toContain('storageGB: 500');
        expect(report).toContain('getRequests: 100000');
        expect(report).toContain('**lambda:**');
        expect(report).toContain('invocationsPerMonth: 5000000');
      });
    });
  });

  describe('threshold status', () => {
    const thresholdPassed: ThresholdEvaluation = {
      passed: true,
      level: 'warning',
      threshold: 200,
      delta: 150.50,
      message: 'Cost delta is within threshold',
      recommendations: [],
    };

    const thresholdExceeded: ThresholdEvaluation = {
      passed: false,
      level: 'error',
      threshold: 100,
      delta: 150.50,
      message: 'Cost delta exceeds error threshold',
      recommendations: [
        'Review the added resources for optimization opportunities',
        'Consider using reserved instances for EC2',
        'Request threshold override approval if changes are necessary',
      ],
    };

    describe('text format', () => {
      it('should show passed threshold status', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdPassed,
        };

        const report = reporter.generateReport(sampleCostDelta, 'text', options);

        expect(report).toContain('THRESHOLD STATUS:');
        expect(report).toContain('Status: PASSED');
        expect(report).toContain('Threshold: $200.00/month (warning)');
        expect(report).toContain('Actual Delta: $150.50/month');
      });

      it('should show exceeded threshold status with recommendations', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdExceeded,
        };

        const report = reporter.generateReport(sampleCostDelta, 'text', options);

        expect(report).toContain('Status: EXCEEDED');
        expect(report).toContain('Threshold: $100.00/month (error)');
        expect(report).toContain('Recommendations:');
        expect(report).toContain('Review the added resources for optimization opportunities');
        expect(report).toContain('Consider using reserved instances for EC2');
      });

      it('should show no thresholds configured', () => {
        const noThreshold: ThresholdEvaluation = {
          passed: true,
          level: 'none',
          delta: 150.50,
          message: 'No thresholds configured',
          recommendations: [],
        };

        const options: ReportOptions = {
          thresholdStatus: noThreshold,
        };

        const report = reporter.generateReport(sampleCostDelta, 'text', options);

        expect(report).toContain('No thresholds configured');
      });
    });

    describe('json format', () => {
      it('should include threshold status in json report', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdPassed,
        };

        const report = reporter.generateReport(sampleCostDelta, 'json', options);
        const parsed = JSON.parse(report);

        expect(parsed.thresholdStatus).toBeDefined();
        expect(parsed.thresholdStatus.passed).toBe(true);
        expect(parsed.thresholdStatus.level).toBe('warning');
        expect(parsed.thresholdStatus.threshold).toBe(200);
        expect(parsed.thresholdStatus.delta).toBe(150.50);
      });

      it('should include recommendations when threshold exceeded', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdExceeded,
        };

        const report = reporter.generateReport(sampleCostDelta, 'json', options);
        const parsed = JSON.parse(report);

        expect(parsed.thresholdStatus.passed).toBe(false);
        expect(parsed.thresholdStatus.recommendations).toHaveLength(3);
      });
    });

    describe('markdown format', () => {
      it('should show passed threshold status prominently', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdPassed,
        };

        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('## Threshold Status: PASSED');
        expect(report).toContain('**Threshold:** $200.00/month (warning)');
        expect(report).toContain('**Actual Delta:** +$150.50/month');
      });

      it('should show exceeded threshold with action required section', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdExceeded,
        };

        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('## Threshold Status: EXCEEDED');
        expect(report).toContain('### Action Required');
        expect(report).toContain('Cost delta exceeds error threshold');
      });

      it('should show recommendations when threshold exceeded', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdExceeded,
        };

        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('### Recommendations');
        expect(report).toContain('- Review the added resources for optimization opportunities');
        expect(report).toContain('- Consider using reserved instances for EC2');
        expect(report).toContain('- Request threshold override approval if changes are necessary');
      });

      it('should show top cost contributors when threshold exceeded', () => {
        const options: ReportOptions = {
          thresholdStatus: thresholdExceeded,
        };

        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).toContain('### Top Cost Contributors');
        expect(report).toContain('| Resource | Type | Impact |');
        expect(report).toContain('NewInstance');
        expect(report).toContain('AWS::EC2::Instance');
      });

      it('should not show threshold section when level is none', () => {
        const noThreshold: ThresholdEvaluation = {
          passed: true,
          level: 'none',
          delta: 150.50,
          message: 'No thresholds configured',
          recommendations: [],
        };

        const options: ReportOptions = {
          thresholdStatus: noThreshold,
        };

        const report = reporter.generateReport(sampleCostDelta, 'markdown', options);

        expect(report).not.toContain('Threshold Status');
      });
    });
  });

  describe('multi-stack reporting', () => {
    const stack1Delta: CostDelta = {
      totalDelta: 100.00,
      currency: 'USD',
      addedCosts: [
        {
          logicalId: 'Stack1Instance',
          type: 'AWS::EC2::Instance',
          monthlyCost: {
            amount: 100.00,
            currency: 'USD',
            confidence: 'high',
            assumptions: [],
          },
        },
      ],
      removedCosts: [],
      modifiedCosts: [],
    };

    const stack2Delta: CostDelta = {
      totalDelta: 50.00,
      currency: 'USD',
      addedCosts: [
        {
          logicalId: 'Stack2Bucket',
          type: 'AWS::S3::Bucket',
          monthlyCost: {
            amount: 50.00,
            currency: 'USD',
            confidence: 'medium',
            assumptions: [],
          },
        },
      ],
      removedCosts: [],
      modifiedCosts: [],
    };

    const totalDelta: CostDelta = {
      totalDelta: 150.00,
      currency: 'USD',
      addedCosts: [
        {
          logicalId: 'Stack1Instance',
          type: 'AWS::EC2::Instance',
          monthlyCost: {
            amount: 100.00,
            currency: 'USD',
            confidence: 'high',
            assumptions: [],
          },
        },
        {
          logicalId: 'Stack2Bucket',
          type: 'AWS::S3::Bucket',
          monthlyCost: {
            amount: 50.00,
            currency: 'USD',
            confidence: 'medium',
            assumptions: [],
          },
        },
      ],
      removedCosts: [],
      modifiedCosts: [],
    };

    describe('markdown format', () => {
      it('should show per-stack breakdown table', () => {
        const options: ReportOptions = {
          multiStack: true,
          stacks: [
            { stackName: 'InfraStack', costDelta: stack1Delta },
            { stackName: 'AppStack', costDelta: stack2Delta },
          ],
        };

        const report = reporter.generateReport(totalDelta, 'markdown', options);

        expect(report).toContain('## Per-Stack Cost Breakdown');
        expect(report).toContain('| Stack | Cost Delta |');
        expect(report).toContain('| InfraStack | +$100.00 |');
        expect(report).toContain('| AppStack | +$50.00 |');
      });

      it('should show detailed stack breakdowns in collapsible section', () => {
        const options: ReportOptions = {
          multiStack: true,
          stacks: [
            { stackName: 'InfraStack', costDelta: stack1Delta },
            { stackName: 'AppStack', costDelta: stack2Delta },
          ],
        };

        const report = reporter.generateReport(totalDelta, 'markdown', options);

        expect(report).toContain('<details>');
        expect(report).toContain('<summary><strong>View Detailed Stack Breakdowns</strong></summary>');
        expect(report).toContain('### InfraStack');
        expect(report).toContain('### AppStack');
        expect(report).toContain('</details>');
      });

      it('should show resources for each stack', () => {
        const options: ReportOptions = {
          multiStack: true,
          stacks: [
            { stackName: 'InfraStack', costDelta: stack1Delta },
            { stackName: 'AppStack', costDelta: stack2Delta },
          ],
        };

        const report = reporter.generateReport(totalDelta, 'markdown', options);

        expect(report).toContain('Stack1Instance');
        expect(report).toContain('AWS::EC2::Instance');
        expect(report).toContain('Stack2Bucket');
        expect(report).toContain('AWS::S3::Bucket');
      });

      it('should not show per-stack breakdown for single stack', () => {
        const options: ReportOptions = {
          multiStack: true,
          stacks: [
            { stackName: 'SingleStack', costDelta: stack1Delta },
          ],
        };

        const report = reporter.generateReport(stack1Delta, 'markdown', options);

        expect(report).not.toContain('## Per-Stack Cost Breakdown');
      });

      it('should not show per-stack breakdown when multiStack is false', () => {
        const options: ReportOptions = {
          multiStack: false,
          stacks: [
            { stackName: 'InfraStack', costDelta: stack1Delta },
            { stackName: 'AppStack', costDelta: stack2Delta },
          ],
        };

        const report = reporter.generateReport(totalDelta, 'markdown', options);

        expect(report).not.toContain('## Per-Stack Cost Breakdown');
      });

      it('should handle stacks with removed resources', () => {
        const stackWithRemoved: CostDelta = {
          totalDelta: -50.00,
          currency: 'USD',
          addedCosts: [],
          removedCosts: [
            {
              logicalId: 'OldFunction',
              type: 'AWS::Lambda::Function',
              monthlyCost: {
                amount: 50.00,
                currency: 'USD',
                confidence: 'medium',
                assumptions: [],
              },
            },
          ],
          modifiedCosts: [],
        };

        const totalWithRemoved: CostDelta = {
          totalDelta: -50.00,
          currency: 'USD',
          addedCosts: [],
          removedCosts: [
            {
              logicalId: 'OldFunction',
              type: 'AWS::Lambda::Function',
              monthlyCost: {
                amount: 50.00,
                currency: 'USD',
                confidence: 'medium',
                assumptions: [],
              },
            },
          ],
          modifiedCosts: [],
        };

        const options: ReportOptions = {
          multiStack: true,
          stacks: [
            { stackName: 'CleanupStack', costDelta: stackWithRemoved },
            { stackName: 'AppStack', costDelta: stack2Delta },
          ],
        };

        const report = reporter.generateReport(totalWithRemoved, 'markdown', options);

        expect(report).toContain('**Removed Resources:**');
        expect(report).toContain('OldFunction');
      });

      it('should handle stacks with modified resources', () => {
        const stackWithModified: CostDelta = {
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

        const totalWithModified: CostDelta = {
          totalDelta: 100.00,
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

        const options: ReportOptions = {
          multiStack: true,
          stacks: [
            { stackName: 'UpdateStack', costDelta: stackWithModified },
            { stackName: 'AppStack', costDelta: stack2Delta },
          ],
        };

        const report = reporter.generateReport(totalWithModified, 'markdown', options);

        expect(report).toContain('**Modified Resources:**');
        expect(report).toContain('UpdatedInstance');
        expect(report).toContain('$150.00');
        expect(report).toContain('$200.00');
      });

      it('should handle stacks with no changes', () => {
        const emptyStack: CostDelta = {
          totalDelta: 0,
          currency: 'USD',
          addedCosts: [],
          removedCosts: [],
          modifiedCosts: [],
        };

        const options: ReportOptions = {
          multiStack: true,
          stacks: [
            { stackName: 'EmptyStack', costDelta: emptyStack },
            { stackName: 'AppStack', costDelta: stack2Delta },
          ],
        };

        const combinedDelta: CostDelta = {
          ...stack2Delta,
        };

        const report = reporter.generateReport(combinedDelta, 'markdown', options);

        expect(report).toContain('### EmptyStack');
        expect(report).toContain('No resource changes detected');
      });
    });
  });
});
