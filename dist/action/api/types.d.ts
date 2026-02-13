import { ResourceCost, ModifiedResourceCost } from '../pricing/types';
export interface AnalyzeOptions {
    baseTemplate: string;
    targetTemplate: string;
    region?: string;
    format?: 'text' | 'json' | 'markdown';
}
export interface CostAnalysisResult {
    totalDelta: number;
    currency: string;
    addedResources: ResourceCost[];
    removedResources: ResourceCost[];
    modifiedResources: ModifiedResourceCost[];
    summary: string;
}
