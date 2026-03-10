import { ResourceWithId } from '../diff/types';
import { ResourceCost } from '../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationConfig,
  OptimizationResult,
  Recommendation,
} from './types';

export class OptimizationEngine {
  private readonly analyzers: OptimizationAnalyzer[] = [];

  constructor(
    analyzers: OptimizationAnalyzer[],
    private readonly config: OptimizationConfig = {},
  ) {
    this.analyzers = this.filterAnalyzers(analyzers);
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    region: string,
  ): Promise<OptimizationResult> {
    const allRecommendations: Recommendation[] = [];

    for (const analyzer of this.analyzers) {
      if (!analyzer.isApplicable(resources)) {
        continue;
      }

      const recommendations = await analyzer.analyze(
        resources,
        resourceCosts,
        region,
      );
      allRecommendations.push(...recommendations);
    }

    const filtered = this.applyThreshold(allRecommendations);
    const sorted = filtered.sort(
      (a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings,
    );

    return {
      recommendations: sorted,
      totalEstimatedMonthlySavings: sorted.reduce(
        (sum, r) => sum + r.estimatedMonthlySavings,
        0,
      ),
      currency: 'USD',
      analyzedResourceCount: resources.length,
      analyzedAt: new Date().toISOString(),
    };
  }

  private filterAnalyzers(
    analyzers: OptimizationAnalyzer[],
  ): OptimizationAnalyzer[] {
    const { enabledCategories, disabledCategories } = this.config;

    return analyzers.filter((a) => {
      if (enabledCategories && !enabledCategories.includes(a.category)) {
        return false;
      }
      if (disabledCategories && disabledCategories.includes(a.category)) {
        return false;
      }
      return true;
    });
  }

  private applyThreshold(
    recommendations: Recommendation[],
  ): Recommendation[] {
    const threshold = this.config.minimumSavingsThreshold;
    if (!threshold) {
      return recommendations;
    }
    return recommendations.filter(
      (r) => r.estimatedMonthlySavings >= threshold,
    );
  }
}
