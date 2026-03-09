import { Reporter as IReporter, ReportFormat, ReportOptions } from './types';
import { CostDelta } from '../pricing/types';
/** Service breakdown entry for cost grouping */
export interface ServiceBreakdown {
    service: string;
    totalCost: number;
    resourceCount: number;
}
export declare class Reporter implements IReporter {
    generateReport(costDelta: CostDelta, format: ReportFormat, options?: ReportOptions): string;
    /**
     * Get trend indicator emoji based on cost change direction
     */
    getTrendIndicator(amount: number): string;
    /**
     * Calculate percentage change between old and new amounts
     */
    getPercentageChange(oldAmount: number, newAmount: number): string;
    /**
     * Group costs by AWS service (e.g., EC2, S3, Lambda)
     */
    groupCostsByService(costDelta: CostDelta): ServiceBreakdown[];
    /**
     * Extract AWS service name from resource type (e.g., AWS::EC2::Instance -> EC2)
     */
    extractServiceName(resourceType: string): string;
    /**
     * Calculate total costs before and after changes
     */
    calculateTotalCosts(costDelta: CostDelta): {
        before: number;
        after: number;
    };
    private generateTextReport;
    private generateJsonReport;
    private generateMarkdownReport;
    private formatConfigSummaryMarkdownEnhanced;
    private formatResourceLine;
    private formatModifiedResourceLine;
    private formatCurrency;
    private formatDelta;
    private formatConfigSummaryText;
    private formatThresholdStatusText;
    private formatThresholdStatusMarkdown;
    private getTopCostContributors;
    private formatStackDetailsMarkdown;
}
