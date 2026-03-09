import { Reporter as IReporter, ReportFormat, ReportOptions } from './types';
import { CostDelta } from '../pricing/types';
export { ServiceBreakdown } from './markdownUtils';
export declare class Reporter implements IReporter {
    generateReport(costDelta: CostDelta, format: ReportFormat, options?: ReportOptions): string;
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
