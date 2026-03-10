import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import { OptimizationAnalyzer, OptimizationCategory, Recommendation } from '../types';
export declare class StorageOptimizationAnalyzer implements OptimizationAnalyzer {
    readonly category: OptimizationCategory;
    readonly name = "Storage Optimization";
    isApplicable(resources: ResourceWithId[]): boolean;
    analyze(resources: ResourceWithId[], resourceCosts: ResourceCost[], _region: string): Promise<Recommendation[]>;
    private analyzeS3Bucket;
    private analyzeEBSVolume;
    private analyzeLaunchTemplate;
    private hasIntelligentTieringConfig;
    private findCost;
}
