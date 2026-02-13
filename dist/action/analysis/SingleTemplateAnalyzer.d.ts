import { AnalysisConfig, SingleTemplateCostResult } from '../api/single-template-types';
/**
 * Service for analyzing costs in a single CloudFormation template
 */
export declare class SingleTemplateAnalyzer {
    /**
     * Analyze costs for all resources in a single template
     *
     * @param template - CloudFormation template content (JSON or YAML)
     * @param region - AWS region for pricing calculations
     * @param config - Optional configuration for analysis
     * @returns Promise resolving to detailed cost analysis result
     */
    analyzeCosts(template: string, region: string, config?: AnalysisConfig): Promise<SingleTemplateCostResult>;
    /**
     * Generate cost breakdown grouped by resource type and confidence level
     */
    private generateCostBreakdown;
    /**
     * Generate metadata about the analysis
     */
    private generateMetadata;
}
