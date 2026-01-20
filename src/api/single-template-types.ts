import { ResourceCost, MonthlyCost } from '../pricing/types';
import { UsageAssumptionsConfig, CacheConfig } from '../config/types';

/**
 * Configuration options for single template analysis
 */
export interface AnalysisConfig {
  usageAssumptions?: UsageAssumptionsConfig;
  excludedResourceTypes?: string[];
  cacheConfig?: CacheConfig;
}

/**
 * Metadata about the analysis
 */
export interface AnalysisMetadata {
  templateHash: string;
  region: string;
  analyzedAt: Date;
  resourceCount: number;
  supportedResourceCount: number;
  unsupportedResourceCount: number;
}

/**
 * Cost information grouped by resource type
 */
export interface ResourceTypeCost {
  resourceType: string;
  count: number;
  totalCost: number;
  resources: ResourceCost[];
}

/**
 * Cost information grouped by confidence level
 */
export interface ConfidenceLevelCost {
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  count: number;
  totalCost: number;
}

/**
 * Detailed cost breakdown for a template
 */
export interface CostBreakdown {
  byResourceType: ResourceTypeCost[];
  byConfidenceLevel: ConfidenceLevelCost[];
  assumptions: string[];
}

/**
 * Enhanced resource cost with additional metadata
 */
export interface EnhancedResourceCost extends ResourceCost {
  properties?: Record<string, any>;
  region: string;
  calculatedAt: Date;
}

/**
 * Result of single template cost analysis
 */
export interface SingleTemplateCostResult {
  totalMonthlyCost: number;
  currency: string;
  resourceCosts: EnhancedResourceCost[];
  costBreakdown: CostBreakdown;
  summary: string;
  metadata: AnalysisMetadata;
}

/**
 * Options for analyzing a single template
 */
export interface AnalyzeSingleTemplateOptions {
  template: string;
  region?: string;
  format?: 'text' | 'json' | 'markdown';
  config?: AnalysisConfig;
}

/**
 * Options for generating single template reports
 */
export interface SingleTemplateReportOptions {
  showBreakdown?: boolean;
  showAssumptions?: boolean;
  groupByType?: boolean;
  sortBy?: 'cost' | 'name' | 'type';
}
