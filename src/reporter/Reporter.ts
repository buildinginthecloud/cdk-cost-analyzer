import { Reporter as IReporter, ReportFormat, ReportOptions } from './types';
import {
  CostDelta,
  ResourceCost,
  ModifiedResourceCost,
} from '../pricing/types';

export class Reporter implements IReporter {
  generateReport(
    costDelta: CostDelta,
    format: ReportFormat,
    options?: ReportOptions,
  ): string {
    switch (format) {
      case 'text':
        return this.generateTextReport(costDelta, options);
      case 'json':
        return this.generateJsonReport(costDelta, options);
      case 'markdown':
        return this.generateMarkdownReport(costDelta, options);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  private generateTextReport(
    costDelta: CostDelta,
    options?: ReportOptions,
  ): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('CDK Cost Analysis Report');
    lines.push('='.repeat(60));
    lines.push('');

    // Add configuration summary if provided
    if (options?.configSummary) {
      lines.push(...this.formatConfigSummaryText(options.configSummary));
      lines.push('');
    }

    // Add threshold status if provided
    if (options?.thresholdStatus) {
      lines.push(...this.formatThresholdStatusText(options.thresholdStatus));
      lines.push('');
    }

    lines.push(
      `Total Cost Delta: ${this.formatDelta(costDelta.totalDelta, costDelta.currency)}`,
    );
    lines.push('');

    if (costDelta.addedCosts.length > 0) {
      lines.push('ADDED RESOURCES:');
      lines.push('-'.repeat(60));

      const sortedAdded = [...costDelta.addedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedAdded) {
        lines.push(this.formatResourceLine(resource));
      }
      lines.push('');
    }

    if (costDelta.removedCosts.length > 0) {
      lines.push('REMOVED RESOURCES:');
      lines.push('-'.repeat(60));

      const sortedRemoved = [...costDelta.removedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedRemoved) {
        lines.push(this.formatResourceLine(resource));
      }
      lines.push('');
    }

    if (costDelta.modifiedCosts.length > 0) {
      lines.push('MODIFIED RESOURCES:');
      lines.push('-'.repeat(60));

      const sortedModified = [...costDelta.modifiedCosts].sort(
        (a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta),
      );

      for (const resource of sortedModified) {
        lines.push(this.formatModifiedResourceLine(resource));
      }
      lines.push('');
    }

    if (
      costDelta.addedCosts.length === 0 &&
      costDelta.removedCosts.length === 0 &&
      costDelta.modifiedCosts.length === 0
    ) {
      lines.push('No resource changes detected.');
      lines.push('');
    }

    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  private generateJsonReport(
    costDelta: CostDelta,
    options?: ReportOptions,
  ): string {
    const report: any = {
      ...costDelta,
    };

    if (options?.configSummary) {
      report.configSummary = options.configSummary;
    }

    if (options?.thresholdStatus) {
      report.thresholdStatus = options.thresholdStatus;
    }

    if (options?.stackName) {
      report.stackName = options.stackName;
    }

    return JSON.stringify(report, null, 2);
  }

  private generateMarkdownReport(
    costDelta: CostDelta,
    options?: ReportOptions,
  ): string {
    const lines: string[] = [];

    lines.push('# CDK Cost Analysis Report');
    lines.push('');

    // Add configuration summary if provided
    if (options?.configSummary) {
      lines.push(...this.formatConfigSummaryMarkdown(options.configSummary));
      lines.push('');
    }

    // Add threshold status if provided
    if (options?.thresholdStatus) {
      lines.push(
        ...this.formatThresholdStatusMarkdown(
          options.thresholdStatus,
          costDelta,
        ),
      );
      lines.push('');
    }

    // Show total cost delta
    lines.push(
      `**Total Cost Delta:** ${this.formatDelta(costDelta.totalDelta, costDelta.currency)}`,
    );
    lines.push('');

    // If multi-stack, show per-stack breakdowns
    if (options?.multiStack && options?.stacks && options.stacks.length > 1) {
      lines.push('## Per-Stack Cost Breakdown');
      lines.push('');
      lines.push('| Stack | Cost Delta |');
      lines.push('|-------|------------|');
      for (const stack of options.stacks) {
        lines.push(
          `| ${stack.stackName} | ${this.formatDelta(stack.costDelta.totalDelta, stack.costDelta.currency)} |`,
        );
      }
      lines.push('');
      lines.push('<details>');
      lines.push(
        '<summary><strong>View Detailed Stack Breakdowns</strong></summary>',
      );
      lines.push('');
      for (const stack of options.stacks) {
        lines.push(`### ${stack.stackName}`);
        lines.push('');
        lines.push(...this.formatStackDetailsMarkdown(stack.costDelta));
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }

    if (costDelta.addedCosts.length > 0) {
      lines.push('## Added Resources');
      lines.push('');
      lines.push('| Logical ID | Type | Monthly Cost |');
      lines.push('|------------|------|--------------|');

      const sortedAdded = [...costDelta.addedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedAdded) {
        lines.push(
          `| ${resource.logicalId} | ${resource.type} | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    if (costDelta.removedCosts.length > 0) {
      lines.push('## Removed Resources');
      lines.push('');
      lines.push('| Logical ID | Type | Monthly Cost |');
      lines.push('|------------|------|--------------|');

      const sortedRemoved = [...costDelta.removedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedRemoved) {
        lines.push(
          `| ${resource.logicalId} | ${resource.type} | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    if (costDelta.modifiedCosts.length > 0) {
      lines.push('## Modified Resources');
      lines.push('');
      lines.push('| Logical ID | Type | Old Cost | New Cost | Delta |');
      lines.push('|------------|------|----------|----------|-------|');

      const sortedModified = [...costDelta.modifiedCosts].sort(
        (a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta),
      );

      for (const resource of sortedModified) {
        lines.push(
          `| ${resource.logicalId} | ${resource.type} | ` +
            `${this.formatCurrency(resource.oldMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatCurrency(resource.newMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatDelta(resource.costDelta, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatResourceLine(resource: ResourceCost): string {
    const cost = this.formatCurrency(resource.monthlyCost.amount, 'USD');
    const confidence = resource.monthlyCost.confidence;
    return `  • ${resource.logicalId} (${resource.type}): ${cost} [${confidence}]`;
  }

  private formatModifiedResourceLine(resource: ModifiedResourceCost): string {
    const oldCost = this.formatCurrency(resource.oldMonthlyCost.amount, 'USD');
    const newCost = this.formatCurrency(resource.newMonthlyCost.amount, 'USD');
    const delta = this.formatDelta(resource.costDelta, 'USD');
    return `  • ${resource.logicalId} (${resource.type}): ${oldCost} → ${newCost} (${delta})`;
  }

  private formatCurrency(amount: number, currency: string): string {
    const symbol = currency === 'USD' ? '$' : currency;
    return `${symbol}${amount.toFixed(2)}`;
  }

  private formatDelta(amount: number, currency: string): string {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
    const absAmount = Math.abs(amount);
    const formatted = this.formatCurrency(absAmount, currency);
    return amount === 0 ? formatted : `${sign}${formatted}`;
  }

  private formatConfigSummaryText(config: any): string[] {
    const lines: string[] = [];
    lines.push('CONFIGURATION:');
    lines.push('-'.repeat(60));

    if (config.configPath) {
      lines.push(`  Configuration File: ${config.configPath}`);
    } else {
      lines.push('  Configuration File: Using defaults');
    }

    if (config.thresholds) {
      if (config.thresholds.environment) {
        lines.push(`  Environment: ${config.thresholds.environment}`);
      }
      if (config.thresholds.warning !== undefined) {
        lines.push(
          `  Warning Threshold: $${config.thresholds.warning.toFixed(2)}/month`,
        );
      }
      if (config.thresholds.error !== undefined) {
        lines.push(
          `  Error Threshold: $${config.thresholds.error.toFixed(2)}/month`,
        );
      }
    }

    if (
      config.excludedResourceTypes &&
      config.excludedResourceTypes.length > 0
    ) {
      lines.push(
        `  Excluded Resource Types: ${config.excludedResourceTypes.join(', ')}`,
      );
    }

    if (
      config.usageAssumptions &&
      Object.keys(config.usageAssumptions).length > 0
    ) {
      lines.push('  Custom Usage Assumptions:');
      for (const [resourceType, assumptions] of Object.entries(
        config.usageAssumptions,
      )) {
        lines.push(`    - ${resourceType}: ${JSON.stringify(assumptions)}`);
      }
    }

    return lines;
  }

  private formatThresholdStatusText(threshold: any): string[] {
    const lines: string[] = [];
    lines.push('THRESHOLD STATUS:');
    lines.push('-'.repeat(60));

    if (threshold.level === 'none') {
      lines.push('  No thresholds configured');
    } else {
      const status = threshold.passed ? 'PASSED' : 'EXCEEDED';
      lines.push(`  Status: ${status}`);

      if (threshold.threshold !== undefined) {
        lines.push(
          `  Threshold: $${threshold.threshold.toFixed(2)}/month (${threshold.level})`,
        );
      }
      lines.push(
        `  Actual Delta: $${Math.abs(threshold.delta).toFixed(2)}/month`,
      );

      if (
        !threshold.passed &&
        threshold.recommendations &&
        threshold.recommendations.length > 0
      ) {
        lines.push('  Recommendations:');
        for (const rec of threshold.recommendations) {
          lines.push(`    - ${rec}`);
        }
      }
    }

    return lines;
  }

  private formatConfigSummaryMarkdown(config: any): string[] {
    const lines: string[] = [];
    lines.push('<details>');
    lines.push('<summary><strong>Configuration Summary</strong></summary>');
    lines.push('');

    if (config.configPath) {
      lines.push(`**Configuration File:** \`${config.configPath}\``);
    } else {
      lines.push('**Configuration File:** Using defaults');
    }
    lines.push('');

    if (config.thresholds) {
      lines.push('**Thresholds:**');
      if (config.thresholds.environment) {
        lines.push(`- Environment: ${config.thresholds.environment}`);
      }
      if (config.thresholds.warning !== undefined) {
        lines.push(`- Warning: $${config.thresholds.warning.toFixed(2)}/month`);
      }
      if (config.thresholds.error !== undefined) {
        lines.push(`- Error: $${config.thresholds.error.toFixed(2)}/month`);
      }
      lines.push('');
    }

    if (
      config.excludedResourceTypes &&
      config.excludedResourceTypes.length > 0
    ) {
      lines.push('**Excluded Resource Types:**');
      for (const type of config.excludedResourceTypes) {
        lines.push(`- \`${type}\``);
      }
      lines.push('');
    }

    if (
      config.usageAssumptions &&
      Object.keys(config.usageAssumptions).length > 0
    ) {
      lines.push('**Custom Usage Assumptions:**');
      for (const [resourceType, assumptions] of Object.entries(
        config.usageAssumptions,
      )) {
        lines.push(`- **${resourceType}:**`);
        const assumptionObj = assumptions as Record<string, any>;
        for (const [key, value] of Object.entries(assumptionObj)) {
          lines.push(`  - ${key}: ${value}`);
        }
      }
      lines.push('');
    }

    lines.push('</details>');
    lines.push('');

    return lines;
  }

  private formatThresholdStatusMarkdown(
    threshold: any,
    costDelta: CostDelta,
  ): string[] {
    const lines: string[] = [];

    if (threshold.level === 'none') {
      return lines;
    }

    const passed = threshold.passed;
    const status = passed ? 'PASSED' : 'EXCEEDED';

    lines.push(`## Threshold Status: ${status}`);
    lines.push('');

    if (threshold.threshold !== undefined) {
      lines.push(
        `**Threshold:** $${threshold.threshold.toFixed(2)}/month (${threshold.level})`,
      );
    }
    lines.push(
      `**Actual Delta:** ${this.formatDelta(threshold.delta, costDelta.currency)}/month`,
    );
    lines.push('');

    if (!passed) {
      lines.push('### Action Required');
      lines.push('');
      lines.push(threshold.message);
      lines.push('');

      if (threshold.recommendations && threshold.recommendations.length > 0) {
        lines.push('### Recommendations');
        lines.push('');
        for (const rec of threshold.recommendations) {
          lines.push(`- ${rec}`);
        }
        lines.push('');
      }

      // Show top cost contributors
      const topContributors = this.getTopCostContributors(costDelta, 5);
      if (topContributors.length > 0) {
        lines.push('### Top Cost Contributors');
        lines.push('');
        lines.push('| Resource | Type | Impact |');
        lines.push('|----------|------|--------|');
        for (const contributor of topContributors) {
          lines.push(
            `| ${contributor.logicalId} | ${contributor.type} | ${this.formatDelta(contributor.impact, costDelta.currency)} |`,
          );
        }
        lines.push('');
      }
    }

    return lines;
  }

  private getTopCostContributors(
    costDelta: CostDelta,
    limit: number,
  ): Array<{ logicalId: string; type: string; impact: number }> {
    const contributors: Array<{
      logicalId: string;
      type: string;
      impact: number;
    }> = [];

    // Add added resources
    for (const resource of costDelta.addedCosts) {
      contributors.push({
        logicalId: resource.logicalId,
        type: resource.type,
        impact: resource.monthlyCost.amount,
      });
    }

    // Add removed resources (negative impact)
    for (const resource of costDelta.removedCosts) {
      contributors.push({
        logicalId: resource.logicalId,
        type: resource.type,
        impact: -resource.monthlyCost.amount,
      });
    }

    // Add modified resources
    for (const resource of costDelta.modifiedCosts) {
      contributors.push({
        logicalId: resource.logicalId,
        type: resource.type,
        impact: resource.costDelta,
      });
    }

    // Sort by absolute impact (descending)
    contributors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return contributors.slice(0, limit);
  }

  private formatStackDetailsMarkdown(costDelta: CostDelta): string[] {
    const lines: string[] = [];

    if (costDelta.addedCosts.length > 0) {
      lines.push('**Added Resources:**');
      lines.push('');
      lines.push('| Logical ID | Type | Monthly Cost |');
      lines.push('|------------|------|--------------|');

      const sortedAdded = [...costDelta.addedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedAdded) {
        lines.push(
          `| ${resource.logicalId} | ${resource.type} | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    if (costDelta.removedCosts.length > 0) {
      lines.push('**Removed Resources:**');
      lines.push('');
      lines.push('| Logical ID | Type | Monthly Cost |');
      lines.push('|------------|------|--------------|');

      const sortedRemoved = [...costDelta.removedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedRemoved) {
        lines.push(
          `| ${resource.logicalId} | ${resource.type} | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    if (costDelta.modifiedCosts.length > 0) {
      lines.push('**Modified Resources:**');
      lines.push('');
      lines.push('| Logical ID | Type | Old Cost | New Cost | Delta |');
      lines.push('|------------|------|----------|----------|-------|');

      const sortedModified = [...costDelta.modifiedCosts].sort(
        (a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta),
      );

      for (const resource of sortedModified) {
        lines.push(
          `| ${resource.logicalId} | ${resource.type} | ` +
            `${this.formatCurrency(resource.oldMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatCurrency(resource.newMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatDelta(resource.costDelta, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    if (
      costDelta.addedCosts.length === 0 &&
      costDelta.removedCosts.length === 0 &&
      costDelta.modifiedCosts.length === 0
    ) {
      lines.push('No resource changes detected.');
      lines.push('');
    }

    return lines;
  }
}
