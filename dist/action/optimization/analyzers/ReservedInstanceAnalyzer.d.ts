import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import { OptimizationAnalyzer, OptimizationCategory, Recommendation } from '../types';
export declare class ReservedInstanceAnalyzer implements OptimizationAnalyzer {
    readonly category: OptimizationCategory;
    readonly name = "Reserved Instance";
    isApplicable(resources: ResourceWithId[]): boolean;
    analyze(resources: ResourceWithId[], resourceCosts: ResourceCost[], _region: string): Promise<Recommendation[]>;
    private createRecommendation;
    private getServiceLabel;
    private getInstanceInfo;
    private findCost;
}
