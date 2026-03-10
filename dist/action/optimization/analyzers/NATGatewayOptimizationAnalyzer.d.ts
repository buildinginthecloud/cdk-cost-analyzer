import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import { OptimizationAnalyzer, OptimizationCategory, Recommendation } from '../types';
export declare class NATGatewayOptimizationAnalyzer implements OptimizationAnalyzer {
    readonly category: OptimizationCategory;
    readonly name = "NAT Gateway Optimization";
    isApplicable(resources: ResourceWithId[]): boolean;
    analyze(resources: ResourceWithId[], resourceCosts: ResourceCost[], _region: string): Promise<Recommendation[]>;
    private suggestNATInstanceForDev;
    private suggestVPCEndpoints;
    private suggestConsolidation;
    private findCost;
}
