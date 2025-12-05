import { CostDelta, ResourceCost, ModifiedResourceCost } from '../pricing/types';
import { Reporter as IReporter, ReportFormat } from './types';

export class Reporter implements IReporter {
  generateReport(costDelta: CostDelta, format: ReportFormat): string {
    switch (format) {
      case 'text':
        return this.generateTextReport(costDelta);
      case 'json':
        return this.generateJsonReport(costDelta);
      case 'markdown':
        return this.generateMarkdownReport(costDelta);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  private generateTextReport(costDelta: CostDelta): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('CDK Cost Analysis Report');
    lines.push('='.repeat(60));
    lines.push('');

    lines.push(`Total Cost Delta: ${this.formatDelta(costDelta.totalDelta, costDelta.currency)}`);
    lines.push('');

    if (costDelta.addedCosts.length > 0) {
      lines.push('ADDED RESOURCES:');
      lines.push('-'.repeat(60));
      
      const sortedAdded = [...costDelta.addedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount
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
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount
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
        (a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta)
      );

      for (const resource of sortedModified) {
        lines.push(this.formatModifiedResourceLine(resource));
      }
      lines.push('');
    }

    if (costDelta.addedCosts.length === 0 && 
        costDelta.removedCosts.length === 0 && 
        costDelta.modifiedCosts.length === 0) {
      lines.push('No resource changes detected.');
      lines.push('');
    }

    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  private generateJsonReport(costDelta: CostDelta): string {
    return JSON.stringify(costDelta, null, 2);
  }

  private generateMarkdownReport(costDelta: CostDelta): string {
    const lines: string[] = [];

    lines.push('# CDK Cost Analysis Report');
    lines.push('');
    lines.push(`**Total Cost Delta:** ${this.formatDelta(costDelta.totalDelta, costDelta.currency)}`);
    lines.push('');

    if (costDelta.addedCosts.length > 0) {
      lines.push('## Added Resources');
      lines.push('');
      lines.push('| Logical ID | Type | Monthly Cost |');
      lines.push('|------------|------|--------------|');
      
      const sortedAdded = [...costDelta.addedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount
      );

      for (const resource of sortedAdded) {
        lines.push(`| ${resource.logicalId} | ${resource.type} | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`);
      }
      lines.push('');
    }

    if (costDelta.removedCosts.length > 0) {
      lines.push('## Removed Resources');
      lines.push('');
      lines.push('| Logical ID | Type | Monthly Cost |');
      lines.push('|------------|------|--------------|');
      
      const sortedRemoved = [...costDelta.removedCosts].sort(
        (a, b) => b.monthlyCost.amount - a.monthlyCost.amount
      );

      for (const resource of sortedRemoved) {
        lines.push(`| ${resource.logicalId} | ${resource.type} | ${this.formatCurrency(resource.monthlyCost.amount, costDelta.currency)} |`);
      }
      lines.push('');
    }

    if (costDelta.modifiedCosts.length > 0) {
      lines.push('## Modified Resources');
      lines.push('');
      lines.push('| Logical ID | Type | Old Cost | New Cost | Delta |');
      lines.push('|------------|------|----------|----------|-------|');
      
      const sortedModified = [...costDelta.modifiedCosts].sort(
        (a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta)
      );

      for (const resource of sortedModified) {
        lines.push(
          `| ${resource.logicalId} | ${resource.type} | ` +
          `${this.formatCurrency(resource.oldMonthlyCost.amount, costDelta.currency)} | ` +
          `${this.formatCurrency(resource.newMonthlyCost.amount, costDelta.currency)} | ` +
          `${this.formatDelta(resource.costDelta, costDelta.currency)} |`
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
}
