import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationCategory,
  Recommendation,
} from '../types';

/**
 * Instance sizes ordered from smallest to largest.
 * Used to suggest one size down for right-sizing.
 */
const EC2_SIZES = [
  'nano',
  'micro',
  'small',
  'medium',
  'large',
  'xlarge',
  '2xlarge',
  '4xlarge',
  '8xlarge',
  '12xlarge',
  '16xlarge',
  '24xlarge',
  '32xlarge',
  '48xlarge',
  'metal',
];

/**
 * Instance sizes considered "large" enough to warrant right-sizing review.
 * We only suggest downsizing for 2xlarge and above.
 */
const REVIEW_THRESHOLD_INDEX = EC2_SIZES.indexOf('2xlarge');

export class RightSizingAnalyzer implements OptimizationAnalyzer {
  readonly category: OptimizationCategory = 'right-sizing';
  readonly name = 'Right-Sizing';

  isApplicable(resources: ResourceWithId[]): boolean {
    return resources.some(
      (r) =>
        r.type === 'AWS::EC2::Instance' ||
        r.type === 'AWS::RDS::DBInstance' ||
        r.type === 'AWS::ElastiCache::CacheCluster',
    );
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    _region: string,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const resource of resources) {
      const rec = this.analyzeResource(resource, resourceCosts);
      if (rec) recommendations.push(rec);
    }

    return recommendations;
  }

  private analyzeResource(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    const instanceType = this.getInstanceType(resource);
    if (!instanceType) return null;

    const size = this.extractSize(instanceType);
    const sizeIndex = EC2_SIZES.indexOf(size);
    if (sizeIndex < REVIEW_THRESHOLD_INDEX) return null;

    const smallerSize = EC2_SIZES[sizeIndex - 1];
    const family = instanceType.substring(
      0,
      instanceType.length - size.length,
    );
    const smallerType = `${family}${smallerSize}`;

    const cost = this.findCost(resource.logicalId, resourceCosts);
    // Downsizing by one step typically halves cost for compute instances
    const savingsPercent = 50;
    const savings = cost * (savingsPercent / 100);

    return {
      id: `rightsize-${resource.logicalId}`,
      title: `Review sizing of ${resource.logicalId} (${instanceType})`,
      description: `${resource.logicalId} uses ${instanceType}. Consider downsizing to ${smallerType} if utilization is consistently below 40%. This could save ~$${savings.toFixed(2)}/month.`,
      category: this.category,
      priority: savings >= 100 ? 'high' : savings >= 40 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: savingsPercent,
      affectedResources: [resource.logicalId],
      actionItems: [
        `Check CloudWatch metrics for CPU, memory, and network utilization`,
        `If avg utilization < 40%, downsize from ${instanceType} to ${smallerType}`,
        'Test in staging before applying to production',
        'Monitor performance for at least 1 week after change',
      ],
      caveats: [
        'Requires CloudWatch data to validate; this is a template-based estimate',
        'Memory utilization requires CloudWatch Agent (not available by default)',
        'Peak usage patterns may differ from average',
        'Consider using AWS Compute Optimizer for data-driven recommendations',
      ],
    };
  }

  private getInstanceType(resource: ResourceWithId): string | null {
    const props = resource.properties;
    switch (resource.type) {
      case 'AWS::EC2::Instance':
        return (props.InstanceType as string) || null;
      case 'AWS::RDS::DBInstance':
        return (props.DBInstanceClass as string) || null;
      case 'AWS::ElastiCache::CacheCluster':
        return (props.CacheNodeType as string) || null;
      default:
        return null;
    }
  }

  private extractSize(instanceType: string): string {
    // "m5.2xlarge" -> "2xlarge", "db.r5.large" -> "large"
    const parts = instanceType.split('.');
    return parts[parts.length - 1] || '';
  }

  private findCost(logicalId: string, resourceCosts: ResourceCost[]): number {
    const cost = resourceCosts.find((c) => c.logicalId === logicalId);
    return cost?.monthlyCost.amount ?? 0;
  }
}
