import { CostDelta } from '../pricing/types';
/**
 * Format cost delta for GitHub Action PR comments with trend indicators.
 */
export declare class GitHubActionReporter {
    /**
     * Generate a formatted markdown report for GitHub PR comments.
     */
    generateReport(costDelta: CostDelta, baseCost?: number, targetCost?: number): string;
    /**
     * Generate cost impact summary with percentage change.
     */
    private generateCostSummary;
    /**
     * Format added resources table.
     */
    private formatAddedResources;
    /**
     * Format modified resources table.
     */
    private formatModifiedResources;
    /**
     * Format removed resources table.
     */
    private formatRemovedResources;
    /**
     * Get trend indicator emoji based on cost delta.
     */
    private getTrendIndicator;
    /**
     * Format currency value.
     */
    private formatCurrency;
    /**
     * Format cost delta with sign.
     */
    private formatDelta;
    /**
     * Format percentage with sign.
     */
    private formatPercentage;
}
