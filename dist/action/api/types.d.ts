import { ResourceCost, ModifiedResourceCost } from '../pricing/types';
import { OptimizationResult } from '../optimization/types';
export interface AnalyzeOptions {
    baseTemplate: string;
    targetTemplate: string;
    region?: string;
    format?: 'text' | 'json' | 'markdown';
    recommendations?: boolean;
}
export interface CostAnalysisResult {
    totalDelta: number;
    currency: string;
    addedResources: ResourceCost[];
    removedResources: ResourceCost[];
    modifiedResources: ModifiedResourceCost[];
    summary: string;
    recommendations?: OptimizationResult;
}
