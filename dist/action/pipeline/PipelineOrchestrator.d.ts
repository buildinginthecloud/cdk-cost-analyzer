import { PipelineOptions, PipelineResult } from './types';
export declare class PipelineOrchestrator {
    private configManager;
    private synthesisOrchestrator;
    private thresholdEnforcer;
    constructor();
    /**
     * Run complete pipeline analysis
     */
    runPipelineAnalysis(options: PipelineOptions): Promise<PipelineResult>;
    /**
     * Synthesize both base and target branches
     */
    private synthesizeBothBranches;
    /**
     * Analyze costs between two templates
     */
    private analyzeCosts;
    /**
     * Build configuration summary
     */
    private buildConfigSummary;
}
