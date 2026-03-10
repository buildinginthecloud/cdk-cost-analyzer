import { ResourceWithId } from '../../src/diff/types';
import { ResourceCost } from '../../src/pricing/types';
import { OptimizationEngine } from '../../src/optimization/OptimizationEngine';
import { OptimizationAnalyzer, Recommendation } from '../../src/optimization/types';

function createMockAnalyzer(
  category: string,
  applicable: boolean,
  recommendations: Recommendation[],
): OptimizationAnalyzer {
  return {
    category: category as any,
    name: `Mock ${category}`,
    isApplicable: jest.fn().mockReturnValue(applicable),
    analyze: jest.fn().mockResolvedValue(recommendations),
  };
}

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'test-1',
    title: 'Test',
    description: 'Test recommendation',
    category: 'graviton-migration',
    priority: 'medium',
    estimatedMonthlySavings: 50,
    estimatedSavingsPercent: 20,
    affectedResources: ['Res1'],
    actionItems: ['Do something'],
    caveats: ['Something to consider'],
    ...overrides,
  };
}

const resources: ResourceWithId[] = [
  { logicalId: 'Res1', type: 'AWS::EC2::Instance', properties: {} },
];
const costs: ResourceCost[] = [];

describe('OptimizationEngine', () => {
  it('should run applicable analyzers and return sorted recommendations', async () => {
    const rec1 = makeRec({ id: 'a', estimatedMonthlySavings: 30 });
    const rec2 = makeRec({ id: 'b', estimatedMonthlySavings: 100 });
    const analyzer1 = createMockAnalyzer('graviton-migration', true, [rec1]);
    const analyzer2 = createMockAnalyzer('reserved-instance', true, [rec2]);

    const engine = new OptimizationEngine([analyzer1, analyzer2]);
    const result = await engine.analyze(resources, costs, 'us-east-1');

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].id).toBe('b');
    expect(result.recommendations[1].id).toBe('a');
    expect(result.totalEstimatedMonthlySavings).toBe(130);
    expect(result.currency).toBe('USD');
    expect(result.analyzedResourceCount).toBe(1);
  });

  it('should skip non-applicable analyzers', async () => {
    const analyzer = createMockAnalyzer('graviton-migration', false, [makeRec()]);
    const engine = new OptimizationEngine([analyzer]);
    const result = await engine.analyze(resources, costs, 'us-east-1');

    expect(result.recommendations).toHaveLength(0);
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it('should filter by enabled categories', async () => {
    const analyzer1 = createMockAnalyzer('graviton-migration', true, [makeRec()]);
    const analyzer2 = createMockAnalyzer('reserved-instance', true, [makeRec()]);

    const engine = new OptimizationEngine([analyzer1, analyzer2], {
      enabledCategories: ['graviton-migration'],
    });
    const result = await engine.analyze(resources, costs, 'us-east-1');

    expect(result.recommendations).toHaveLength(1);
    expect(analyzer2.analyze).not.toHaveBeenCalled();
  });

  it('should filter by disabled categories', async () => {
    const analyzer1 = createMockAnalyzer('graviton-migration', true, [makeRec()]);
    const analyzer2 = createMockAnalyzer('reserved-instance', true, [makeRec()]);

    const engine = new OptimizationEngine([analyzer1, analyzer2], {
      disabledCategories: ['graviton-migration'],
    });
    const result = await engine.analyze(resources, costs, 'us-east-1');

    expect(result.recommendations).toHaveLength(1);
  });

  it('should apply minimum savings threshold', async () => {
    const rec1 = makeRec({ id: 'a', estimatedMonthlySavings: 10 });
    const rec2 = makeRec({ id: 'b', estimatedMonthlySavings: 100 });
    const analyzer = createMockAnalyzer('graviton-migration', true, [rec1, rec2]);

    const engine = new OptimizationEngine([analyzer], {
      minimumSavingsThreshold: 50,
    });
    const result = await engine.analyze(resources, costs, 'us-east-1');

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].id).toBe('b');
    expect(result.totalEstimatedMonthlySavings).toBe(100);
  });

  it('should return empty results when no resources', async () => {
    const analyzer = createMockAnalyzer('graviton-migration', false, []);
    const engine = new OptimizationEngine([analyzer]);
    const result = await engine.analyze([], [], 'us-east-1');

    expect(result.recommendations).toHaveLength(0);
    expect(result.totalEstimatedMonthlySavings).toBe(0);
    expect(result.analyzedResourceCount).toBe(0);
  });

  it('should include analyzedAt timestamp', async () => {
    const engine = new OptimizationEngine([]);
    const result = await engine.analyze([], [], 'us-east-1');

    expect(result.analyzedAt).toBeDefined();
    expect(new Date(result.analyzedAt).getTime()).not.toBeNaN();
  });
});
