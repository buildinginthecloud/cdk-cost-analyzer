import { SingleTemplateCostResult, SingleTemplateReportOptions } from '../api/single-template-types';
/**
 * Reporter for generating formatted output for single template cost analysis
 */
export declare class SingleTemplateReporter {
    /**
     * Generate a formatted report from single template analysis result
     *
     * @param result - The analysis result
     * @param format - Output format (text, json, or markdown)
     * @param options - Optional formatting preferences
     * @returns Formatted report string
     */
    generateReport(result: SingleTemplateCostResult, format: 'text' | 'json' | 'markdown', options?: SingleTemplateReportOptions): string;
    /**
     * Get trend indicator emoji based on cost value
     */
    getTrendIndicator(amount: number): string;
    /**
     * Extract AWS service name from resource type (e.g., AWS::EC2::Instance -> EC2)
     */
    extractServiceName(resourceType: string): string;
    /**
     * Generate JSON format report
     */
    private generateJsonReport;
    /**
     * Generate text format report
     */
    private generateTextReport;
    /**
     * Generate markdown format report
     */
    private generateMarkdownReport;
    /**
     * Sort resources based on specified criteria
     */
    private sortResources;
}
