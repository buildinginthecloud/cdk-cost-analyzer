import { Reporter } from '../../src/reporter/Reporter';
import { SingleTemplateReporter } from '../../src/reporter/SingleTemplateReporter';
import { CostDelta } from '../../src/pricing/types';
import { SingleTemplateCostResult } from '../../src/api/single-template-types';

describe('Markdown Formatting', () => {
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

  describe('getTrendIndicator', () => {
    it('should return up arrow for positive amounts', () => {
      expect(reporter.getTrendIndicator(100)).toBe('↗️');
      expect(reporter.getTrendIndicator(0.01)).toBe('↗️');
    });

    it('should return down arrow for negative amounts', () => {
      expect(reporter.getTrendIndicator(-100)).toBe('↘️');
      expect(reporter.getTrendIndicator(-0.01)).toBe('↘️');
    });

    it('should return right arrow for zero', () => {
      expect(reporter.getTrendIndicator(0)).toBe('➡️');
    });
  });

  describe('getPercentageChange', () => {
    it('should calculate positive percentage change', () => {
      expect(reporter.getPercentageChange(100, 150)).toBe('+50.0%');
      expect(reporter.getPercentageChange(100, 200)).toBe('+100.0%');
    });

    it('should calculate negative percentage change', () => {
      expect(reporter.getPercentageChange(100, 50)).toBe('-50.0%');
      expect(reporter.getPercentageChange(200, 100)).toBe('-50.0%');
    });

    it('should return 0% for no change', () => {
      expect(reporter.getPercentageChange(100, 100)).toBe('+0.0%');
    });

    it('should handle zero old amount', () => {
      expect(reporter.getPercentageChange(0, 100)).toBe('+∞%');
      expect(reporter.getPercentageChange(0, 0)).toBe('0%');
    });
  });

  describe('extractServiceName', () => {
    it('should extract service name from AWS resource type', () => {
      expect(reporter.extractServiceName('AWS::EC2::Instance')).toBe('EC2');
      expect(reporter.extractServiceName('AWS::S3::Bucket')).toBe('S3');
      expect(reporter.extractServiceName('AWS::Lambda::Function')).toBe('Lambda');
      expect(reporter.extractServiceName('AWS::RDS::DBInstance')).toBe('RDS');
    });

    it('should return original string for non-standard format', () => {
      expect(reporter.extractServiceName('CustomResource')).toBe('CustomResource');
    });
  });

  describe('groupCostsByService', () => {
    it('should group costs by AWS service', () => {
      const breakdown = reporter.groupCostsByService(sampleCostDelta);

      expect(breakdown).toBeInstanceOf(Array);
      expect(breakdown.length).toBeGreaterThan(0);

      // EC2 should have the highest impact (100 + 50 = 150)
      const ec2 = breakdown.find(s => s.service === 'EC2');
      expect(ec2).toBeDefined();
      expect(ec2!.totalCost).toBe(150);
      expect(ec2!.resourceCount).toBe(2);

      // S3 should have 25
      const s3 = breakdown.find(s => s.service === 'S3');
      expect(s3).toBeDefined();
      expect(s3!.totalCost).toBe(25);
      expect(s3!.resourceCount).toBe(1);

      // Lambda should have negative cost (removed)
      const lambda = breakdown.find(s => s.service === 'Lambda');
      expect(lambda).toBeDefined();
      expect(lambda!.totalCost).toBe(-10);
      expect(lambda!.resourceCount).toBe(1);
    });

    it('should sort by absolute cost impact', () => {
      const breakdown = reporter.groupCostsByService(sampleCostDelta);

      // Should be sorted by absolute value of totalCost descending
      for (let i = 0; i < breakdown.length - 1; i++) {
        expect(Math.abs(breakdown[i].totalCost)).toBeGreaterThanOrEqual(
          Math.abs(breakdown[i + 1].totalCost)
        );
      }
    });

    it('should handle empty cost delta', () => {
      const emptyCostDelta: CostDelta = {
        totalDelta: 0,
        currency: 'USD',
        addedCosts: [],
        removedCosts: [],
        modifiedCosts: [],
      };

      const breakdown = reporter.groupCostsByService(emptyCostDelta);
      expect(breakdown).toEqual([]);
    });
  });

  describe('calculateTotalCosts', () => {
    it('should calculate before and after costs', () => {
      const totals = reporter.calculateTotalCosts(sampleCostDelta);

      // Before: OldFunction (10) + UpdatedInstance old cost (150) = 160
      expect(totals.before).toBe(160);

      // After: NewInstance (100) + NewBucket (25) + UpdatedInstance new cost (200) = 325
      expect(totals.after).toBe(325);
    });

    it('should handle only added resources', () => {
      const addedOnly: CostDelta = {
        totalDelta: 125,
        currency: 'USD',
        addedCosts: sampleCostDelta.addedCosts,
        removedCosts: [],
        modifiedCosts: [],
      };

      const totals = reporter.calculateTotalCosts(addedOnly);
      expect(totals.before).toBe(0);
      expect(totals.after).toBe(125);
    });

    it('should handle only removed resources', () => {
      const removedOnly: CostDelta = {
        totalDelta: -10,
        currency: 'USD',
        addedCosts: [],
        removedCosts: sampleCostDelta.removedCosts,
        modifiedCosts: [],
      };

      const totals = reporter.calculateTotalCosts(removedOnly);
      expect(totals.before).toBe(10);
      expect(totals.after).toBe(0);
    });
  });

  describe('Markdown Report Generation', () => {
    it('should include cost impact analysis header with emoji', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('# 💰 Cost Impact Analysis');
    });

    it('should include trend indicator in header', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('↗️'); // Positive delta should show up arrow
    });

    it('should include added resources section with emoji', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('## 📈 Added Resources');
    });

    it('should include modified resources section with emoji', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('## 🔄 Modified Resources');
    });

    it('should include removed resources section with emoji', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('## 📉 Removed Resources');
    });

    it('should include total monthly cost section with emoji', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('## 💵 Total Monthly Cost');
    });

    it('should include cost breakdown by service section with emoji', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('## 📊 Cost Breakdown by Service');
    });

    it('should include footer with powered by link', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('*Powered by [cdk-cost-analyzer]');
      expect(report).toContain('Configuration Reference');
    });

    it('should show No resources removed when none removed', () => {
      const noRemovedDelta: CostDelta = {
        ...sampleCostDelta,
        removedCosts: [],
      };

      const report = reporter.generateReport(noRemovedDelta, 'markdown');
      expect(report).toContain('No resources removed.');
    });

    it('should include percentage change in modified resources table', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      // UpdatedInstance: 150 -> 200 = +33.3%
      expect(report).toContain('+33.3%');
    });

    it('should format resource types as code', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('`AWS::EC2::Instance`');
      expect(report).toContain('`AWS::S3::Bucket`');
      expect(report).toContain('`AWS::Lambda::Function`');
    });

    it('should include before and after values in total cost table', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('| Before |');
      expect(report).toContain('| After |');
      expect(report).toContain('| Change |');
    });

    it('should include service breakdown table with trend indicators', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown');
      expect(report).toContain('| Service | Resources | Cost Impact | Trend |');
      expect(report).toContain('| EC2 |');
      expect(report).toContain('| S3 |');
      expect(report).toContain('| Lambda |');
    });
  });

  describe('Configuration Summary (Enhanced)', () => {
    const configOptions = {
      configSummary: {
        configPath: '.cdk-cost-analyzer.yml',
        thresholds: {
          warning: 50,
          error: 200,
          environment: 'production',
        },
        usageAssumptions: {
          s3: { storageGB: 500 },
        },
        excludedResourceTypes: ['AWS::IAM::Role'],
        synthesisEnabled: true,
      },
    };

    it('should include collapsible configuration section with emoji', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown', configOptions);
      expect(report).toContain('<details>');
      expect(report).toContain('📋 Configuration & Assumptions');
      expect(report).toContain('</details>');
    });

    it('should include warning and error emojis in thresholds', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown', configOptions);
      expect(report).toContain('⚠️ Warning:');
      expect(report).toContain('🚫 Error:');
    });
  });

  describe('Threshold Status (Enhanced)', () => {
    const thresholdExceededOptions = {
      thresholdStatus: {
        passed: false,
        level: 'error' as const,
        threshold: 100,
        delta: 150.50,
        message: 'Cost delta exceeds error threshold',
        recommendations: ['Review added resources'],
      },
    };

    it('should include emoji in threshold status header', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown', thresholdExceededOptions);
      expect(report).toContain('🚨 Threshold Status: EXCEEDED');
    });

    it('should include emoji in action required section', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown', thresholdExceededOptions);
      expect(report).toContain('### ⚠️ Action Required');
    });

    it('should include emoji in recommendations section', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown', thresholdExceededOptions);
      expect(report).toContain('### 💡 Recommendations');
    });

    it('should include emoji in top cost contributors section', () => {
      const report = reporter.generateReport(sampleCostDelta, 'markdown', thresholdExceededOptions);
      expect(report).toContain('### 🔝 Top Cost Contributors');
    });

    it('should show passed status with checkmark emoji', () => {
      const passedOptions = {
        thresholdStatus: {
          passed: true,
          level: 'warning' as const,
          threshold: 200,
          delta: 150.50,
          message: 'Within threshold',
          recommendations: [],
        },
      };

      const report = reporter.generateReport(sampleCostDelta, 'markdown', passedOptions);
      expect(report).toContain('✅ Threshold Status: PASSED');
    });
  });

  describe('Multi-Stack Report (Enhanced)', () => {
    const stack1Delta: CostDelta = {
      totalDelta: 100.00,
      currency: 'USD',
      addedCosts: [{
        logicalId: 'Stack1Instance',
        type: 'AWS::EC2::Instance',
        monthlyCost: { amount: 100, currency: 'USD', confidence: 'high', assumptions: [] },
      }],
      removedCosts: [],
      modifiedCosts: [],
    };

    const stack2Delta: CostDelta = {
      totalDelta: -25.00,
      currency: 'USD',
      addedCosts: [],
      removedCosts: [{
        logicalId: 'Stack2Function',
        type: 'AWS::Lambda::Function',
        monthlyCost: { amount: 25, currency: 'USD', confidence: 'medium', assumptions: [] },
      }],
      modifiedCosts: [],
    };

    const multiStackOptions = {
      multiStack: true,
      stacks: [
        { stackName: 'InfraStack', costDelta: stack1Delta },
        { stackName: 'AppStack', costDelta: stack2Delta },
      ],
    };

    it('should include trend column in per-stack breakdown', () => {
      const totalDelta: CostDelta = {
        totalDelta: 75,
        currency: 'USD',
        addedCosts: stack1Delta.addedCosts,
        removedCosts: stack2Delta.removedCosts,
        modifiedCosts: [],
      };

      const report = reporter.generateReport(totalDelta, 'markdown', multiStackOptions);
      expect(report).toContain('| Stack | Cost Delta | Trend |');
      expect(report).toContain('↗️'); // InfraStack is positive
      expect(report).toContain('↘️'); // AppStack is negative
    });

    it('should include emojis in detailed stack breakdowns', () => {
      const totalDelta: CostDelta = {
        totalDelta: 75,
        currency: 'USD',
        addedCosts: stack1Delta.addedCosts,
        removedCosts: stack2Delta.removedCosts,
        modifiedCosts: [],
      };

      const report = reporter.generateReport(totalDelta, 'markdown', multiStackOptions);
      expect(report).toContain('**📈 Added Resources:**');
      expect(report).toContain('**📉 Removed Resources:**');
    });
  });
});

describe('SingleTemplateReporter Markdown Formatting', () => {
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
          assumptions: ['Storage: 50GB'],
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
          assumptions: ['Instance type: t3.micro'],
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
          resources: [{
            logicalId: 'MyInstance',
            type: 'AWS::EC2::Instance',
            monthlyCost: { amount: 100.0, currency: 'USD', confidence: 'high', assumptions: [] },
          }],
        },
        {
          resourceType: 'AWS::S3::Bucket',
          count: 1,
          totalCost: 23.45,
          resources: [{
            logicalId: 'MyBucket',
            type: 'AWS::S3::Bucket',
            monthlyCost: { amount: 23.45, currency: 'USD', confidence: 'medium', assumptions: [] },
          }],
        },
      ],
      byConfidenceLevel: [
        { confidence: 'high', count: 1, totalCost: 100.0 },
        { confidence: 'medium', count: 1, totalCost: 23.45 },
      ],
      assumptions: ['Instance type: t3.micro', 'Storage: 50GB'],
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

  const reporter = new SingleTemplateReporter();

  describe('getTrendIndicator', () => {
    it('should return correct trend indicators', () => {
      expect(reporter.getTrendIndicator(100)).toBe('↗️');
      expect(reporter.getTrendIndicator(-50)).toBe('↘️');
      expect(reporter.getTrendIndicator(0)).toBe('➡️');
    });
  });

  describe('extractServiceName', () => {
    it('should extract service name from resource type', () => {
      expect(reporter.extractServiceName('AWS::EC2::Instance')).toBe('EC2');
      expect(reporter.extractServiceName('AWS::S3::Bucket')).toBe('S3');
    });
  });

  describe('Markdown Report', () => {
    it('should include cost impact analysis header with emoji', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('# 💰 Single Template Cost Analysis');
    });

    it('should include resource overview with emoji', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('## 📊 Resource Overview');
    });

    it('should include confidence breakdown with emojis', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('## 🎯 Cost Confidence Breakdown');
      expect(report).toContain('✅ high');
      expect(report).toContain('⚠️ medium');
    });

    it('should include cost breakdown by service with emoji', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('## 📈 Cost Breakdown by Service');
    });

    it('should include trend indicators in service breakdown', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('| Service | Cost | Percentage | Trend |');
      expect(report).toContain('↗️');
    });

    it('should include collapsible assumptions section', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('<details>');
      expect(report).toContain('📋 Cost Calculation Assumptions');
      expect(report).toContain('</details>');
    });

    it('should include footer with powered by link', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('*Powered by [cdk-cost-analyzer]');
    });

    it('should include summary table with metrics', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('| Metric | Value |');
      expect(report).toContain('| Analysis Date |');
      expect(report).toContain('| Region |');
      expect(report).toContain('| Template Hash |');
    });

    it('should include resource count table', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('| Category | Count |');
      expect(report).toContain('| Total Resources |');
      expect(report).toContain('| Supported Resources |');
      expect(report).toContain('| Unsupported Resources |');
    });

    it('should format resource types as code in detailed breakdown', () => {
      const report = reporter.generateReport(mockResult, 'markdown');
      expect(report).toContain('`AWS::EC2::Instance`');
      expect(report).toContain('`AWS::S3::Bucket`');
    });
  });
});
