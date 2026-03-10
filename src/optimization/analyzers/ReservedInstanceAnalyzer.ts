import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationCategory,
  Recommendation,
} from '../types';

/**
 * Approximate RI discount percentages by term and payment option.
 * These vary by instance type and region but provide reasonable estimates.
 */
const RI_DISCOUNTS: Record<string, number> = {
  '1yr-no-upfront': 30,
  '1yr-partial-upfront': 35,
  '1yr-all-upfront': 40,
  '3yr-no-upfront': 45,
  '3yr-partial-upfront': 50,
  '3yr-all-upfront': 60,
};

const DEFAULT_DISCOUNT_KEY = '1yr-no-upfront';

const RI_ELIGIBLE_TYPES = [
  'AWS::EC2::Instance',
  'AWS::RDS::DBInstance',
  'AWS::RDS::DBCluster',
  'AWS::ElastiCache::CacheCluster',
  'AWS::ElastiCache::ReplicationGroup',
  'AWS::Redshift::Cluster',
  'AWS::OpenSearchService::Domain',
  'AWS::Elasticsearch::Domain',
];

const MINIMUM_MONTHLY_COST = 50;

export class ReservedInstanceAnalyzer implements OptimizationAnalyzer {
  readonly category: OptimizationCategory = 'reserved-instance';
  readonly name = 'Reserved Instance';

  isApplicable(resources: ResourceWithId[]): boolean {
    return resources.some((r) => RI_ELIGIBLE_TYPES.includes(r.type));
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    _region: string,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const resource of resources) {
      if (!RI_ELIGIBLE_TYPES.includes(resource.type)) continue;

      const cost = this.findCost(resource.logicalId, resourceCosts);
      if (cost < MINIMUM_MONTHLY_COST) continue;

      recommendations.push(this.createRecommendation(resource, cost));
    }

    return recommendations;
  }

  private createRecommendation(
    resource: ResourceWithId,
    currentCost: number,
  ): Recommendation {
    const discountPercent = RI_DISCOUNTS[DEFAULT_DISCOUNT_KEY];
    const savings = currentCost * (discountPercent / 100);
    const newCost = currentCost - savings;
    const serviceLabel = this.getServiceLabel(resource.type);
    const instanceInfo = this.getInstanceInfo(resource);

    return {
      id: `ri-${resource.logicalId}`,
      title: `Purchase Reserved Instance for ${resource.logicalId}`,
      description: `${serviceLabel} ${resource.logicalId}${instanceInfo} costs $${currentCost.toFixed(2)}/month on-demand. A 1-year No Upfront RI would reduce this to ~$${newCost.toFixed(2)}/month, saving ${discountPercent}%.`,
      category: this.category,
      priority: savings >= 100 ? 'high' : savings >= 50 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: discountPercent,
      affectedResources: [resource.logicalId],
      actionItems: [
        `Purchase a 1-year No Upfront Reserved Instance for ${serviceLabel}`,
        'Evaluate if 3-year term or partial/all upfront payment yields better savings',
        'Consider Convertible RIs for flexibility to change instance types',
      ],
      caveats: [
        '1-year commitment; early termination may result in charges',
        'Savings percentages are approximate and vary by region and instance type',
        'Ensure workload will run for the full term to realize savings',
        `Based on ${DEFAULT_DISCOUNT_KEY.replace(/-/g, ' ')} pricing`,
      ],
    };
  }

  private getServiceLabel(resourceType: string): string {
    if (resourceType.startsWith('AWS::EC2::')) return 'EC2 instance';
    if (resourceType.startsWith('AWS::RDS::')) return 'RDS instance';
    if (resourceType.startsWith('AWS::ElastiCache::')) return 'ElastiCache node';
    if (resourceType.startsWith('AWS::Redshift::')) return 'Redshift cluster';
    if (resourceType.includes('OpenSearch') || resourceType.includes('Elasticsearch')) {
      return 'OpenSearch domain';
    }
    return 'Resource';
  }

  private getInstanceInfo(resource: ResourceWithId): string {
    const props = resource.properties;
    const instanceType =
      (props.InstanceType as string) ||
      (props.DBInstanceClass as string) ||
      (props.CacheNodeType as string) ||
      (props.NodeType as string);
    return instanceType ? ` (${instanceType})` : '';
  }

  private findCost(logicalId: string, resourceCosts: ResourceCost[]): number {
    const cost = resourceCosts.find((c) => c.logicalId === logicalId);
    return cost?.monthlyCost.amount ?? 0;
  }
}
