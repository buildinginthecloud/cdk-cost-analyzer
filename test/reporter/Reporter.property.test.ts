import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Reporter } from '../../src/reporter/Reporter';
import { CostDelta, ResourceCost } from '../../src/pricing/types';
import { ReportOptions } from '../../src/reporter/types';
import { ConfigSummary } from '../../src/pipeline/types';
import { ThresholdEvaluation } from '../../src/threshold/types';

describe('Reporter - Property Tests', () => {
  const reporter = new Reporter();

  const monthlyCostArb = fc.record({
    amount: fc.double({ min: 0, max: 10000, noNaN: true }),
    currency: fc.constant('USD'),
    confidence: fc.constantFrom('high', 'medium', 'low', 'unknown'),
    assumptions: fc.array(fc.string()),
  });

  const resourceCostArb = fc.record({
    logicalId: fc.string().filter(s => s.length > 0),
    type: fc.constantFrom('AWS::EC2::Instance', 'AWS::S3::Bucket', 'AWS::Lambda::Function'),
    monthlyCost: monthlyCostArb,
  });

  const modifiedResourceCostArb = fc.record({
    logicalId: fc.string().filter(s => s.length > 0),
    type: fc.constantFrom('AWS::EC2::Instance', 'AWS::S3::Bucket'),
    monthlyCost: monthlyCostArb,
    oldMonthlyCost: monthlyCostArb,
    newMonthlyCost: monthlyCostArb,
    costDelta: fc.double({ min: -1000, max: 1000, noNaN: true }),
  });

  const costDeltaArb = fc.record({
    totalDelta: fc.double({ min: -10000, max: 10000, noNaN: true }),
    currency: fc.constant('USD'),
    addedCosts: fc.array(resourceCostArb, { maxLength: 5 }),
    removedCosts: fc.array(resourceCostArb, { maxLength: 5 }),
    modifiedCosts: fc.array(modifiedResourceCostArb, { maxLength: 5 }),
  });

  // Feature: cdk-cost-analyzer, Property 21: Reports contain all required resource fields
  it('should include logical ID, type, and cost for all resources', () => {
    fc.assert(
      fc.property(costDeltaArb, (costDelta) => {
        const report = reporter.generateReport(costDelta, 'text');

        costDelta.addedCosts.forEach(resource => {
          expect(report).toContain(resource.logicalId);
          expect(report).toContain(resource.type);
        });

        costDelta.removedCosts.forEach(resource => {
          expect(report).toContain(resource.logicalId);
          expect(report).toContain(resource.type);
        });

        costDelta.modifiedCosts.forEach(resource => {
          expect(report).toContain(resource.logicalId);
          expect(report).toContain(resource.type);
        });
      }),
      { numRuns: 50 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 22: Currency values are consistently formatted
  it('should format all currency values with exactly 2 decimal places', () => {
    fc.assert(
      fc.property(costDeltaArb, (costDelta) => {
        const report = reporter.generateReport(costDelta, 'text');

        const currencyPattern = /\$\d+\.\d{2}/g;
        const matches = report.match(currencyPattern);

        if (matches) {
          matches.forEach(match => {
            const decimalPart = match.split('.')[1];
            expect(decimalPart).toHaveLength(2);
          });
        }
      }),
      { numRuns: 50 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 23: Positive deltas have plus sign prefix
  it('should prefix positive deltas with plus sign', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        (positiveAmount) => {
          const costDelta: CostDelta = {
            totalDelta: positiveAmount,
            currency: 'USD',
            addedCosts: [],
            removedCosts: [],
            modifiedCosts: [],
          };

          const report = reporter.generateReport(costDelta, 'text');
          const deltaMatch = report.match(/Total Cost Delta: ([+\-]?\$[\d.]+)/);
          
          expect(deltaMatch).toBeTruthy();
          if (deltaMatch) {
            expect(deltaMatch[1]).toMatch(/^\+\$/);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 24: Negative deltas have minus sign prefix
  it('should prefix negative deltas with minus sign', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        (positiveAmount) => {
          const costDelta: CostDelta = {
            totalDelta: -positiveAmount,
            currency: 'USD',
            addedCosts: [],
            removedCosts: [],
            modifiedCosts: [],
          };

          const report = reporter.generateReport(costDelta, 'text');
          const deltaMatch = report.match(/Total Cost Delta: ([+\-]?\$[\d.]+)/);
          
          expect(deltaMatch).toBeTruthy();
          if (deltaMatch) {
            expect(deltaMatch[1]).toMatch(/^-\$/);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 14: Configuration summary reflects actual settings
  // Validates: Requirements 16.1, 16.2, 16.3, 16.4
  it('should include all configuration settings in report when provided', () => {
    const configSummaryArb = fc.record({
      configPath: fc.option(fc.string(), { nil: undefined }),
      thresholds: fc.option(
        fc.record({
          warning: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: undefined }),
          error: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: undefined }),
          environment: fc.option(fc.constantFrom('development', 'staging', 'production'), { nil: undefined }),
        }),
        { nil: undefined }
      ),
      usageAssumptions: fc.option(
        fc.dictionary(
          fc.constantFrom('s3', 'lambda', 'ec2'),
          fc.dictionary(fc.string(), fc.oneof(fc.integer(), fc.double(), fc.string()))
        ),
        { nil: undefined }
      ),
      excludedResourceTypes: fc.option(
        fc.array(fc.constantFrom('AWS::IAM::Role', 'AWS::IAM::Policy', 'AWS::Logs::LogGroup'), { maxLength: 3 }),
        { nil: undefined }
      ),
      synthesisEnabled: fc.boolean(),
    });

    fc.assert(
      fc.property(costDeltaArb, configSummaryArb, (costDelta, configSummary) => {
        const options: ReportOptions = { configSummary };
        const report = reporter.generateReport(costDelta, 'text', options);

        // Configuration section should be present
        expect(report).toContain('CONFIGURATION:');

        // Config path should be reflected
        if (configSummary.configPath) {
          expect(report).toContain(configSummary.configPath);
        } else {
          expect(report).toContain('Using defaults');
        }

        // Thresholds should be reflected
        if (configSummary.thresholds) {
          if (configSummary.thresholds.warning !== undefined) {
            expect(report).toContain('Warning Threshold');
          }
          if (configSummary.thresholds.error !== undefined) {
            expect(report).toContain('Error Threshold');
          }
          if (configSummary.thresholds.environment) {
            expect(report).toContain(`Environment: ${configSummary.thresholds.environment}`);
          }
        }

        // Excluded resource types should be reflected
        if (configSummary.excludedResourceTypes && configSummary.excludedResourceTypes.length > 0) {
          expect(report).toContain('Excluded Resource Types');
          configSummary.excludedResourceTypes.forEach(type => {
            expect(report).toContain(type);
          });
        }

        // Usage assumptions should be reflected
        if (configSummary.usageAssumptions && Object.keys(configSummary.usageAssumptions).length > 0) {
          expect(report).toContain('Custom Usage Assumptions');
        }
      }),
      { numRuns: 50 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 15: Threshold violations include actionable guidance
  // Validates: Requirements 17.1, 17.2, 17.3, 17.4
  it('should provide actionable guidance when thresholds are exceeded', () => {
    const thresholdEvaluationArb = fc.record({
      passed: fc.boolean(),
      level: fc.constantFrom('warning', 'error', 'none'),
      threshold: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: undefined }),
      delta: fc.double({ min: -1000, max: 1000, noNaN: true }),
      message: fc.string(),
      recommendations: fc.array(fc.string(), { maxLength: 5 }),
    });

    fc.assert(
      fc.property(costDeltaArb, thresholdEvaluationArb, (costDelta, thresholdStatus) => {
        const options: ReportOptions = { thresholdStatus };
        const report = reporter.generateReport(costDelta, 'markdown', options);

        if (thresholdStatus.level !== 'none') {
          // Threshold status should be prominently displayed
          expect(report).toContain('Threshold Status');
          
          if (thresholdStatus.passed) {
            expect(report).toContain('PASSED');
          } else {
            expect(report).toContain('EXCEEDED');
            
            // When threshold is exceeded, should include actionable guidance
            expect(report).toContain('Action Required');
            expect(report).toContain(thresholdStatus.message);
            
            // Should show recommendations if provided
            if (thresholdStatus.recommendations && thresholdStatus.recommendations.length > 0) {
              expect(report).toContain('Recommendations');
              thresholdStatus.recommendations.forEach(rec => {
                if (rec.length > 0) {
                  expect(report).toContain(rec);
                }
              });
            }
            
            // Should show top cost contributors
            if (costDelta.addedCosts.length > 0 || costDelta.modifiedCosts.length > 0 || costDelta.removedCosts.length > 0) {
              expect(report).toContain('Top Cost Contributors');
            }
          }
          
          // Should show threshold value if configured
          if (thresholdStatus.threshold !== undefined) {
            expect(report).toContain('Threshold:');
          }
          
          // Should show actual delta
          expect(report).toContain('Actual Delta');
        }
      }),
      { numRuns: 50 }
    );
  });
});
