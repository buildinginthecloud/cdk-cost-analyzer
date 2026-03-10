import { ResourceWithId } from '../diff/types';
import { ResourceCost } from '../pricing/types';

export type RecommendationPriority = 'high' | 'medium' | 'low';

export type OptimizationCategory =
  | 'reserved-instance'
  | 'savings-plan'
  | 'right-sizing'
  | 'graviton-migration'
  | 'storage-optimization'
  | 'spot-instance'
  | 'nat-gateway-optimization';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: OptimizationCategory;
  priority: RecommendationPriority;
  estimatedMonthlySavings: number;
  estimatedSavingsPercent: number;
  affectedResources: string[];
  actionItems: string[];
  caveats: string[];
}

export interface OptimizationResult {
  recommendations: Recommendation[];
  totalEstimatedMonthlySavings: number;
  currency: string;
  analyzedResourceCount: number;
  analyzedAt: string;
}

export interface OptimizationAnalyzer {
  readonly category: OptimizationCategory;
  readonly name: string;
  isApplicable(resources: ResourceWithId[]): boolean;
  analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    region: string,
  ): Promise<Recommendation[]>;
}

export interface OptimizationConfig {
  enabled?: boolean;
  minimumSavingsThreshold?: number;
  enabledCategories?: OptimizationCategory[];
  disabledCategories?: OptimizationCategory[];
}
