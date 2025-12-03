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

    it('should sort resources by cost impact', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      
      const newInstanceIndex = report.indexOf('NewInstance');
      const newBucketIndex = report.indexOf('NewBucket');
      
      expect(newInstanceIndex).toBeLessThan(newBucketIndex);
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

    it('should format currency with 2 decimal places', () => {
      const report = reporter.generateReport(sampleCostDelta, 'text');
      expect(report).toContain('$100.00');
      expect(report).toContain('$25.00');
      expect(report).toContain('$10.00');
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
