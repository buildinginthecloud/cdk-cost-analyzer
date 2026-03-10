import { ResourceWithId } from '../diff/types';
import { ResourceCost } from '../pricing/types';
import { OptimizationAnalyzer, OptimizationConfig, OptimizationResult } from './types';
export declare class OptimizationEngine {
    private readonly config;
    private readonly analyzers;
    constructor(analyzers: OptimizationAnalyzer[], config?: OptimizationConfig);
    analyze(resources: ResourceWithId[], resourceCosts: ResourceCost[], region: string): Promise<OptimizationResult>;
    private filterAnalyzers;
    private applyThreshold;
}
