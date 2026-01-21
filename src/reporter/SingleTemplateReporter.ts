import {
  SingleTemplateCostResult,
  SingleTemplateReportOptions,
} from '../api/single-template-types';

/**
 * Reporter for generating formatted output for single template cost analysis
 */
export class SingleTemplateReporter {
  /**
   * Generate a formatted report from single template analysis result
   * 
   * @param result - The analysis result
   * @param format - Output format (text, json, or markdown)
   * @param options - Optional formatting preferences
   * @returns Formatted report string
   */
  generateReport(
    result: SingleTemplateCostResult,
    format: 'text' | 'json' | 'markdown',
    options?: SingleTemplateReportOptions,
  ): string {
    const opts = {
      showBreakdown: true,
      showAssumptions: true,
      groupByType: true,
      sortBy: 'cost' as 'cost' | 'name' | 'type',
      ...options,
    };

    switch (format) {
      case 'json':
        return this.generateJsonReport(result);
      case 'markdown':
        return this.generateMarkdownReport(result, opts);
      case 'text':
      default:
        return this.generateTextReport(result, opts);
    }
  }

  /**
   * Generate JSON format report
   */
  private generateJsonReport(result: SingleTemplateCostResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Generate text format report
   */
  private generateTextReport(
    result: SingleTemplateCostResult,
    options: Required<SingleTemplateReportOptions>,
  ): string {
    let report = '';

    // Header
    report += '='.repeat(80) + '\n';
    report += 'Single Template Cost Analysis\n';
    report += '='.repeat(80) + '\n\n';

    // Summary
    report += `Total Monthly Cost: $${result.totalMonthlyCost.toFixed(2)} ${result.currency}\n`;
    report += `Analysis Date: ${result.metadata.analyzedAt.toISOString()}\n`;
    report += `Region: ${result.metadata.region}\n`;
    report += `Template Hash: ${result.metadata.templateHash}\n\n`;

    // Resource counts
    report += `Total Resources: ${result.metadata.resourceCount}\n`;
    report += `Supported Resources: ${result.metadata.supportedResourceCount}\n`;
    report += `Unsupported Resources: ${result.metadata.unsupportedResourceCount}\n\n`;

    // Cost breakdown by confidence
    if (result.costBreakdown.byConfidenceLevel.length > 0) {
      report += '-'.repeat(80) + '\n';
      report += 'Cost Confidence Breakdown\n';
      report += '-'.repeat(80) + '\n\n';

      for (const conf of result.costBreakdown.byConfidenceLevel) {
        const percentage = ((conf.totalCost / result.totalMonthlyCost) * 100).toFixed(1);
        report += `${conf.confidence.toUpperCase().padEnd(10)} ${conf.count} resources  $${conf.totalCost.toFixed(2)} (${percentage}%)\n`;
      }
      report += '\n';
    }

    // Resource breakdown
    if (options.showBreakdown && options.groupByType) {
      report += '-'.repeat(80) + '\n';
      report += 'Cost Breakdown by Resource Type\n';
      report += '-'.repeat(80) + '\n\n';

      for (const typeGroup of result.costBreakdown.byResourceType) {
        const percentage = ((typeGroup.totalCost / result.totalMonthlyCost) * 100).toFixed(1);
        report += `${typeGroup.resourceType}\n`;
        report += `  Count: ${typeGroup.count}\n`;
        report += `  Total Cost: $${typeGroup.totalCost.toFixed(2)} (${percentage}%)\n`;

        // Show individual resources
        const sortedResources = this.sortResources(typeGroup.resources, options.sortBy);
        for (const resource of sortedResources) {
          const conf = resource.monthlyCost.confidence;
          const confIndicator = conf === 'high' ? '✓' : conf === 'medium' ? '~' : conf === 'low' ? '?' : '✗';
          report += `    ${confIndicator} ${resource.logicalId.padEnd(40)} $${resource.monthlyCost.amount.toFixed(2)}\n`;
        }
        report += '\n';
      }
    }

    // Assumptions
    if (options.showAssumptions && result.costBreakdown.assumptions.length > 0) {
      report += '-'.repeat(80) + '\n';
      report += 'Cost Calculation Assumptions\n';
      report += '-'.repeat(80) + '\n\n';

      for (const assumption of result.costBreakdown.assumptions) {
        report += `  • ${assumption}\n`;
      }
      report += '\n';
    }

    // Legend
    report += '-'.repeat(80) + '\n';
    report += 'Legend: ✓ High confidence  ~ Medium confidence  ? Low confidence  ✗ Unknown/Unsupported\n';
    report += '='.repeat(80) + '\n';

    return report;
  }

  /**
   * Generate markdown format report
   */
  private generateMarkdownReport(
    result: SingleTemplateCostResult,
    options: Required<SingleTemplateReportOptions>,
  ): string {
    let report = '';

    // Header
    report += '# Single Template Cost Analysis\n\n';

    // Summary
    report += '## Summary\n\n';
    report += `**Total Monthly Cost:** $${result.totalMonthlyCost.toFixed(2)} ${result.currency}\n\n`;
    report += `- **Analysis Date:** ${result.metadata.analyzedAt.toISOString()}\n`;
    report += `- **Region:** ${result.metadata.region}\n`;
    report += `- **Template Hash:** ${result.metadata.templateHash}\n\n`;

    // Resource counts
    report += '## Resource Overview\n\n';
    report += `- **Total Resources:** ${result.metadata.resourceCount}\n`;
    report += `- **Supported Resources:** ${result.metadata.supportedResourceCount}\n`;
    report += `- **Unsupported Resources:** ${result.metadata.unsupportedResourceCount}\n\n`;

    // Cost breakdown by confidence
    if (result.costBreakdown.byConfidenceLevel.length > 0) {
      report += '## Cost Confidence Breakdown\n\n';
      report += '| Confidence | Resources | Cost | Percentage |\n';
      report += '|------------|-----------|------|------------|\n';

      for (const conf of result.costBreakdown.byConfidenceLevel) {
        const percentage = ((conf.totalCost / result.totalMonthlyCost) * 100).toFixed(1);
        report += `| ${conf.confidence} | ${conf.count} | $${conf.totalCost.toFixed(2)} | ${percentage}% |\n`;
      }
      report += '\n';
    }

    // Resource breakdown by type
    if (options.showBreakdown && options.groupByType) {
      report += '## Cost Breakdown by Resource Type\n\n';

      for (const typeGroup of result.costBreakdown.byResourceType) {
        const percentage = ((typeGroup.totalCost / result.totalMonthlyCost) * 100).toFixed(1);
        report += `### ${typeGroup.resourceType}\n\n`;
        report += `- **Count:** ${typeGroup.count}\n`;
        report += `- **Total Cost:** $${typeGroup.totalCost.toFixed(2)} (${percentage}%)\n\n`;

        // Show individual resources in table
        report += '| Resource | Cost | Confidence |\n';
        report += '|----------|------|------------|\n';

        const sortedResources = this.sortResources(typeGroup.resources, options.sortBy);
        for (const resource of sortedResources) {
          const conf = resource.monthlyCost.confidence;
          report += `| ${resource.logicalId} | $${resource.monthlyCost.amount.toFixed(2)} | ${conf} |\n`;
        }
        report += '\n';
      }
    }

    // Assumptions
    if (options.showAssumptions && result.costBreakdown.assumptions.length > 0) {
      report += '## Cost Calculation Assumptions\n\n';
      for (const assumption of result.costBreakdown.assumptions) {
        report += `- ${assumption}\n`;
      }
      report += '\n';
    }

    // Legend
    report += '---\n\n';
    report += '*Confidence levels: high (✓), medium (~), low (?), unknown/unsupported (✗)*\n';

    return report;
  }

  /**
   * Sort resources based on specified criteria
   */
  private sortResources(
    resources: Array<{ logicalId: string; type: string; monthlyCost: any }>,
    sortBy: 'cost' | 'name' | 'type',
  ): Array<{ logicalId: string; type: string; monthlyCost: any }> {
    const sorted = [...resources];

    switch (sortBy) {
      case 'cost':
        sorted.sort((a, b) => b.monthlyCost.amount - a.monthlyCost.amount);
        break;
      case 'name':
        sorted.sort((a, b) => a.logicalId.localeCompare(b.logicalId));
        break;
      case 'type':
        sorted.sort((a, b) => a.type.localeCompare(b.type));
        break;
    }

    return sorted;
  }
}
