import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Reporter } from '../../src/reporter/Reporter';
import { CostDelta, ResourceCost } from '../../src/pricing/types';

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
});
