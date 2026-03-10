import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import { OptimizationAnalyzer, OptimizationCategory, Recommendation } from '../types';
export declare class SavingsPlansAnalyzer implements OptimizationAnalyzer {
    readonly category: OptimizationCategory;
    readonly name = "Savings Plans";
    isApplicable(resources: ResourceWithId[]): boolean;
    analyze(resources: ResourceWithId[], resourceCosts: ResourceCost[], _region: string): Promise<Recommendation[]>;
    private hasMultipleComputeTypes;
    private findCost;
}
