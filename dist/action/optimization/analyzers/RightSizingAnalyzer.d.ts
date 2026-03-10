import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import { OptimizationAnalyzer, OptimizationCategory, Recommendation } from '../types';
export declare class RightSizingAnalyzer implements OptimizationAnalyzer {
    readonly category: OptimizationCategory;
    readonly name = "Right-Sizing";
    isApplicable(resources: ResourceWithId[]): boolean;
    analyze(resources: ResourceWithId[], resourceCosts: ResourceCost[], _region: string): Promise<Recommendation[]>;
    private analyzeResource;
    private getInstanceType;
    private extractSize;
    private findCost;
}
