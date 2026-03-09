import { CostDelta } from '../pricing/types';

/** Service breakdown entry for cost grouping */
export interface ServiceBreakdown {
  service: string;
  totalCost: number;
  resourceCount: number;
}

/**
 * Get trend indicator emoji based on cost change direction
 */
export function getTrendIndicator(amount: number): string {
  if (amount > 0) return '↗️';
  if (amount < 0) return '↘️';
  return '➡️';
}

/**
 * Calculate percentage change between old and new amounts
 */
export function getPercentageChange(oldAmount: number, newAmount: number): string {
  if (oldAmount === 0) {
    return newAmount > 0 ? '+∞%' : '0%';
  }
  const percentage = ((newAmount - oldAmount) / oldAmount) * 100;
  if (percentage === 0) return '0%';
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}

/**
 * Extract AWS service name from resource type (e.g., AWS::EC2::Instance -> EC2)
 */
export function extractServiceName(resourceType: string): string {
  const parts = resourceType.split('::');
  if (parts.length >= 2) {
    return parts[1];
  }
  return resourceType;
}

/**
 * Group costs by AWS service (e.g., EC2, S3, Lambda)
 */
export function groupCostsByService(costDelta: CostDelta): ServiceBreakdown[] {
  const serviceMap = new Map<string, { totalCost: number; resourceCount: number }>();

  for (const resource of costDelta.addedCosts) {
    const service = extractServiceName(resource.type);
    const existing = serviceMap.get(service) || { totalCost: 0, resourceCount: 0 };
    existing.totalCost += resource.monthlyCost.amount;
    existing.resourceCount += 1;
    serviceMap.set(service, existing);
  }

  for (const resource of costDelta.removedCosts) {
    const service = extractServiceName(resource.type);
    const existing = serviceMap.get(service) || { totalCost: 0, resourceCount: 0 };
    existing.totalCost -= resource.monthlyCost.amount;
    existing.resourceCount += 1;
    serviceMap.set(service, existing);
  }

  for (const resource of costDelta.modifiedCosts) {
    const service = extractServiceName(resource.type);
    const existing = serviceMap.get(service) || { totalCost: 0, resourceCount: 0 };
    existing.totalCost += resource.costDelta;
    existing.resourceCount += 1;
    serviceMap.set(service, existing);
  }

  return Array.from(serviceMap.entries())
    .map(([service, data]) => ({
      service,
      totalCost: data.totalCost,
      resourceCount: data.resourceCount,
    }))
    .sort((a, b) => Math.abs(b.totalCost) - Math.abs(a.totalCost));
}

/**
 * Calculate total costs before and after changes
 */
export function calculateTotalCosts(costDelta: CostDelta): { before: number; after: number } {
  let before = 0;
  let after = 0;

  for (const resource of costDelta.addedCosts) {
    after += resource.monthlyCost.amount;
  }

  for (const resource of costDelta.removedCosts) {
    before += resource.monthlyCost.amount;
  }

  for (const resource of costDelta.modifiedCosts) {
    before += resource.oldMonthlyCost.amount;
    after += resource.newMonthlyCost.amount;
  }

  return { before, after };
}
