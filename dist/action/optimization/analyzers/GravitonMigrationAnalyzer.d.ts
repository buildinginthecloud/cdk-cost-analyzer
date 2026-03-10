import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import { OptimizationAnalyzer, OptimizationCategory, Recommendation } from '../types';
export declare class GravitonMigrationAnalyzer implements OptimizationAnalyzer {
    readonly category: OptimizationCategory;
    readonly name = "Graviton Migration";
    isApplicable(resources: ResourceWithId[]): boolean;
    analyze(resources: ResourceWithId[], resourceCosts: ResourceCost[], _region: string): Promise<Recommendation[]>;
    private analyzeResource;
    private analyzeEC2;
    private analyzeRDS;
    private analyzeElastiCache;
    private extractFamily;
    private extractRDSFamily;
    private extractElastiCacheFamily;
    private findCost;
}
