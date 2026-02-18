import { Reporter as IReporter, ReportFormat, ReportOptions } from './types';
import {
  CostDelta,
  ResourceCost,
  ModifiedResourceCost,
} from '../pricing/types';

/** Service breakdown entry for cost grouping */
export interface ServiceBreakdown {
  service: string;
  totalCost: number;
  resourceCount: number;
}

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

  /**
   * Get trend indicator emoji based on cost change direction
   */
  getTrendIndicator(amount: number): string {
    if (amount > 0) return '↗️';
    if (amount < 0) return '↘️';
    return '➡️';
  }

  /**
   * Calculate percentage change between old and new amounts
   */
  getPercentageChange(oldAmount: number, newAmount: number): string {
    if (oldAmount === 0) {
      return newAmount > 0 ? '+∞%' : '0%';
    }
    const percentage = ((newAmount - oldAmount) / oldAmount) * 100;
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  }

  /**
   * Group costs by AWS service (e.g., EC2, S3, Lambda)
   */
  groupCostsByService(costDelta: CostDelta): ServiceBreakdown[] {
    const serviceMap = new Map<string, { totalCost: number; resourceCount: number }>();

    // Process added costs
    for (const resource of costDelta.addedCosts) {
      const service = this.extractServiceName(resource.type);
      const existing = serviceMap.get(service) || { totalCost: 0, resourceCount: 0 };
      existing.totalCost += resource.monthlyCost.amount;
      existing.resourceCount += 1;
      serviceMap.set(service, existing);
    }

    // Process removed costs (negative impact)
    for (const resource of costDelta.removedCosts) {
      const service = this.extractServiceName(resource.type);
      const existing = serviceMap.get(service) || { totalCost: 0, resourceCount: 0 };
      existing.totalCost -= resource.monthlyCost.amount;
      existing.resourceCount += 1;
      serviceMap.set(service, existing);
    }

    // Process modified costs
    for (const resource of costDelta.modifiedCosts) {
      const service = this.extractServiceName(resource.type);
      const existing = serviceMap.get(service) || { totalCost: 0, resourceCount: 0 };
      existing.totalCost += resource.costDelta;
      existing.resourceCount += 1;
      serviceMap.set(service, existing);
    }

    // Convert to array and sort by absolute cost impact
    return Array.from(serviceMap.entries())
      .map(([service, data]) => ({
        service,
        totalCost: data.totalCost,
        resourceCount: data.resourceCount,
      }))
      .sort((a, b) => Math.abs(b.totalCost) - Math.abs(a.totalCost));
  }

  /**
   * Extract AWS service name from resource type (e.g., AWS::EC2::Instance -> EC2)
   */
  extractServiceName(resourceType: string): string {
    const parts = resourceType.split('::');
    if (parts.length >= 2) {
      return parts[1];
    }
    return resourceType;
  }

  /**
   * Calculate total costs before and after changes
   */
  calculateTotalCosts(costDelta: CostDelta): { before: number; after: number } {
    let before = 0;
    let after = 0;

    // Added resources: before=0, after=cost
    for (const resource of costDelta.addedCosts) {
      after += resource.monthlyCost.amount;
    }

    // Removed resources: before=cost, after=0
    for (const resource of costDelta.removedCosts) {
      before += resource.monthlyCost.amount;
    }

    // Modified resources
    for (const resource of costDelta.modifiedCosts) {
      before += resource.oldMonthlyCost.amount;
      after += resource.newMonthlyCost.amount;
    }

    return { before, after };
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

    // Header with cost impact summary
    const totalCosts = this.calculateTotalCosts(costDelta);
    const trendIndicator = this.getTrendIndicator(costDelta.totalDelta);
    
    lines.push('# 💰 Cost Impact Analysis');
    lines.push('');
    lines.push(`**Monthly Cost Change:** ${this.formatDelta(costDelta.totalDelta, costDelta.currency)} ${trendIndicator}`);
    lines.push('');

    // If multi-stack, show per-stack breakdowns
    if (options?.multiStack && options?.stacks && options.stacks.length > 1) {
      lines.push('## Per-Stack Cost Breakdown');
      lines.push('');
      lines.push('| Stack | Cost Delta | Trend |');
      lines.push('|-------|------------|-------|');
      for (const stack of options.stacks) {
        const stackTrend = this.getTrendIndicator(stack.costDelta.totalDelta);
        lines.push(
          `| ${stack.stackName} | ${this.formatDelta(stack.costDelta.totalDelta, stack.costDelta.currency)} | ${stackTrend} |`,
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

    // Added Resources Section
    if (costDelta.addedCosts.length > 0) {
      lines.push('## 📈 Added Resources');
      lines.push('');
      lines.push('| Resource | Type | Monthly Cost |');
      lines.push('|----------|------|--------------|');

      const sortedAdded = [...costDelta.addedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedAdded) {
        lines.push(
          `| ${resource.logicalId} | \`${resource.type}\` | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    // Modified Resources Section
    if (costDelta.modifiedCosts.length > 0) {
      lines.push('## 🔄 Modified Resources');
      lines.push('');
      lines.push('| Resource | Type | Before | After | Change |');
      lines.push('|----------|------|--------|-------|--------|');

      const sortedModified = [...costDelta.modifiedCosts].sort(
        (a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta),
      );

      for (const resource of sortedModified) {
        const trend = this.getTrendIndicator(resource.costDelta);
        const percentChange = this.getPercentageChange(
          resource.oldMonthlyCost.amount,
          resource.newMonthlyCost.amount,
        );
        lines.push(
          `| ${resource.logicalId} | \`${resource.type}\` | ` +
            `${this.formatCurrency(resource.oldMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatCurrency(resource.newMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatDelta(resource.costDelta, costDelta.currency)} (${percentChange}) ${trend} |`,
        );
      }
      lines.push('');
    }

    // Removed Resources Section
    lines.push('## 📉 Removed Resources');
    lines.push('');
    if (costDelta.removedCosts.length > 0) {
      lines.push('| Resource | Type | Monthly Savings |');
      lines.push('|----------|------|-----------------|');

      const sortedRemoved = [...costDelta.removedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedRemoved) {
        lines.push(
          `| ${resource.logicalId} | \`${resource.type}\` | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    } else {
      lines.push('No resources removed.');
      lines.push('');
    }

    // Total Monthly Cost Section
    lines.push('## 💵 Total Monthly Cost');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Before | ${this.formatCurrency(totalCosts.before, costDelta.currency)} |`);
    lines.push(`| After | ${this.formatCurrency(totalCosts.after, costDelta.currency)} |`);
    lines.push(`| Change | ${this.formatDelta(costDelta.totalDelta, costDelta.currency)} ${trendIndicator} |`);
    lines.push('');

    // Cost Breakdown by Service
    const serviceBreakdown = this.groupCostsByService(costDelta);
    if (serviceBreakdown.length > 0) {
      lines.push('## 📊 Cost Breakdown by Service');
      lines.push('');
      lines.push('| Service | Resources | Cost Impact | Trend |');
      lines.push('|---------|-----------|-------------|-------|');

      for (const service of serviceBreakdown) {
        const serviceTrend = this.getTrendIndicator(service.totalCost);
        lines.push(
          `| ${service.service} | ${service.resourceCount} | ${this.formatDelta(service.totalCost, costDelta.currency)} | ${serviceTrend} |`,
        );
      }
      lines.push('');
    }

    // Configuration & Assumptions Section (collapsible)
    if (options?.configSummary) {
      lines.push(...this.formatConfigSummaryMarkdownEnhanced(options.configSummary));
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*Powered by [cdk-cost-analyzer](https://github.com/buildinginthecloud/cdk-cost-analyzer) | [Configuration Reference](https://github.com/buildinginthecloud/cdk-cost-analyzer/blob/main/docs/CONFIGURATION.md)*');

    return lines.join('\n');
  }

  private formatConfigSummaryMarkdownEnhanced(config: any): string[] {
    const lines: string[] = [];
    lines.push('<details>');
    lines.push('<summary><strong>📋 Configuration & Assumptions</strong></summary>');
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
        lines.push(`- ⚠️ Warning: $${config.thresholds.warning.toFixed(2)}/month`);
      }
      if (config.thresholds.error !== undefined) {
        lines.push(`- 🚫 Error: $${config.thresholds.error.toFixed(2)}/month`);
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
    const statusEmoji = passed ? '✅' : '🚨';
    const status = passed ? 'PASSED' : 'EXCEEDED';

    lines.push(`## ${statusEmoji} Threshold Status: ${status}`);
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
      lines.push('### ⚠️ Action Required');
      lines.push('');
      lines.push(threshold.message);
      lines.push('');

      if (threshold.recommendations && threshold.recommendations.length > 0) {
        lines.push('### 💡 Recommendations');
        lines.push('');
        for (const rec of threshold.recommendations) {
          lines.push(`- ${rec}`);
        }
        lines.push('');
      }

      // Show top cost contributors
      const topContributors = this.getTopCostContributors(costDelta, 5);
      if (topContributors.length > 0) {
        lines.push('### 🔝 Top Cost Contributors');
        lines.push('');
        lines.push('| Resource | Type | Impact | Trend |');
        lines.push('|----------|------|--------|-------|');
        for (const contributor of topContributors) {
          const trend = this.getTrendIndicator(contributor.impact);
          lines.push(
            `| ${contributor.logicalId} | \`${contributor.type}\` | ${this.formatDelta(contributor.impact, costDelta.currency)} | ${trend} |`,
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
      lines.push('**📈 Added Resources:**');
      lines.push('');
      lines.push('| Resource | Type | Monthly Cost |');
      lines.push('|----------|------|--------------|');

      const sortedAdded = [...costDelta.addedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedAdded) {
        lines.push(
          `| ${resource.logicalId} | \`${resource.type}\` | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    if (costDelta.removedCosts.length > 0) {
      lines.push('**📉 Removed Resources:**');
      lines.push('');
      lines.push('| Resource | Type | Monthly Savings |');
      lines.push('|----------|------|-----------------|');

      const sortedRemoved = [...costDelta.removedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount,
      );

      for (const resource of sortedRemoved) {
        lines.push(
          `| ${resource.logicalId} | \`${resource.type}\` | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`,
        );
      }
      lines.push('');
    }

    if (costDelta.modifiedCosts.length > 0) {
      lines.push('**🔄 Modified Resources:**');
      lines.push('');
      lines.push('| Resource | Type | Before | After | Change |');
      lines.push('|----------|------|--------|-------|--------|');

      const sortedModified = [...costDelta.modifiedCosts].sort(
        (a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta),
      );

      for (const resource of sortedModified) {
        const trend = this.getTrendIndicator(resource.costDelta);
        const percentChange = this.getPercentageChange(
          resource.oldMonthlyCost.amount,
          resource.newMonthlyCost.amount,
        );
        lines.push(
          `| ${resource.logicalId} | \`${resource.type}\` | ` +
            `${this.formatCurrency(resource.oldMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatCurrency(resource.newMonthlyCost.amount, costDelta.currency)} | ` +
            `${this.formatDelta(resource.costDelta, costDelta.currency)} (${percentChange}) ${trend} |`,
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
