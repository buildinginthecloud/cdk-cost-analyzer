import {
  formatRecommendationsText,
  formatRecommendationsMarkdown,
} from '../../src/reporter/RecommendationReporter';
import { OptimizationResult, Recommendation } from '../../src/optimization/types';

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'test-1',
    title: 'Test Recommendation',
    description: 'This is a test recommendation.',
    category: 'graviton-migration',
    priority: 'medium',
    estimatedMonthlySavings: 50,
    estimatedSavingsPercent: 20,
    affectedResources: ['WebServer'],
    actionItems: ['Change instance type', 'Test in staging'],
    caveats: ['Requires ARM64 support'],
    ...overrides,
  };
}

function makeResult(recs: Recommendation[]): OptimizationResult {
  return {
    recommendations: recs,
    totalEstimatedMonthlySavings: recs.reduce(
      (sum, r) => sum + r.estimatedMonthlySavings,
      0,
    ),
    currency: 'USD',
    analyzedResourceCount: 5,
    analyzedAt: new Date().toISOString(),
  };
}

describe('RecommendationReporter', () => {
  describe('formatRecommendationsText', () => {
    it('should return empty string for no recommendations', () => {
      const result = makeResult([]);
      expect(formatRecommendationsText(result)).toBe('');
    });

    it('should format a single recommendation', () => {
      const result = makeResult([makeRec()]);
      const output = formatRecommendationsText(result);

      expect(output).toContain('Cost Optimization Recommendations');
      expect(output).toContain('Test Recommendation');
      expect(output).toContain('$50.00/month');
      expect(output).toContain('20%');
      expect(output).toContain('Change instance type');
      expect(output).toContain('Requires ARM64 support');
    });

    it('should show total savings', () => {
      const result = makeResult([
        makeRec({ estimatedMonthlySavings: 100 }),
        makeRec({ id: 'test-2', estimatedMonthlySavings: 50 }),
      ]);
      const output = formatRecommendationsText(result);

      expect(output).toContain('$150.00/month');
      expect(output).toContain('$1800.00/year');
    });

    it('should show priority indicators', () => {
      const result = makeResult([
        makeRec({ priority: 'high' }),
      ]);
      const output = formatRecommendationsText(result);
      expect(output).toContain('[!!!]');
    });

    it('should filter by minimum savings', () => {
      const result = makeResult([
        makeRec({ id: 'a', title: 'Big Saving', estimatedMonthlySavings: 100 }),
        makeRec({ id: 'b', title: 'Small Saving', estimatedMonthlySavings: 10 }),
      ]);
      const output = formatRecommendationsText(result, 50);

      expect(output).toContain('Big Saving');
      expect(output).not.toContain('Small Saving');
    });

    it('should format category labels', () => {
      const result = makeResult([
        makeRec({ category: 'nat-gateway-optimization' }),
      ]);
      const output = formatRecommendationsText(result);
      expect(output).toContain('Nat Gateway Optimization');
    });
  });

  describe('formatRecommendationsMarkdown', () => {
    it('should return empty string for no recommendations', () => {
      const result = makeResult([]);
      expect(formatRecommendationsMarkdown(result)).toBe('');
    });

    it('should format markdown with summary table', () => {
      const result = makeResult([makeRec()]);
      const output = formatRecommendationsMarkdown(result);

      expect(output).toContain('## 💡 Cost Optimization Recommendations');
      expect(output).toContain('| # | Priority | Recommendation | Est. Savings |');
      expect(output).toContain('Test Recommendation');
      expect(output).toContain('$50.00/mo');
    });

    it('should include collapsible details', () => {
      const result = makeResult([makeRec()]);
      const output = formatRecommendationsMarkdown(result);

      expect(output).toContain('<details>');
      expect(output).toContain('</details>');
      expect(output).toContain('View detailed recommendations');
    });

    it('should format action items as checkboxes', () => {
      const result = makeResult([makeRec()]);
      const output = formatRecommendationsMarkdown(result);

      expect(output).toContain('- [ ] Change instance type');
      expect(output).toContain('- [ ] Test in staging');
    });

    it('should show affected resources as code', () => {
      const result = makeResult([makeRec({ affectedResources: ['Web', 'API'] })]);
      const output = formatRecommendationsMarkdown(result);

      expect(output).toContain('`Web`');
      expect(output).toContain('`API`');
    });

    it('should show priority emojis', () => {
      const recs = [
        makeRec({ id: 'a', priority: 'high' }),
        makeRec({ id: 'b', priority: 'medium' }),
        makeRec({ id: 'c', priority: 'low' }),
      ];
      const output = formatRecommendationsMarkdown(makeResult(recs));

      expect(output).toContain('🔴 high');
      expect(output).toContain('🟡 medium');
      expect(output).toContain('🟢 low');
    });

    it('should show total potential savings', () => {
      const result = makeResult([
        makeRec({ estimatedMonthlySavings: 200 }),
      ]);
      const output = formatRecommendationsMarkdown(result);

      expect(output).toContain('**Total Potential Savings:**');
      expect(output).toContain('$200.00/month');
      expect(output).toContain('$2400.00/year');
    });

    it('should filter by minimum savings', () => {
      const result = makeResult([
        makeRec({ id: 'a', title: 'Keep', estimatedMonthlySavings: 100 }),
        makeRec({ id: 'b', title: 'Remove', estimatedMonthlySavings: 5 }),
      ]);
      const output = formatRecommendationsMarkdown(result, 50);

      expect(output).toContain('Keep');
      expect(output).not.toContain('Remove');
    });

    it('should show "Varies" for zero savings', () => {
      const result = makeResult([
        makeRec({ estimatedMonthlySavings: 0 }),
      ]);
      const output = formatRecommendationsMarkdown(result);
      expect(output).toContain('Varies');
    });
  });
});
