import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationCategory,
  Recommendation,
} from '../types';

/**
 * Mapping of x86 instance families to their Graviton equivalents.
 * Graviton instances typically offer 20-40% better price-performance.
 */
const GRAVITON_ALTERNATIVES: Record<string, string> = {
  m5: 'm7g',
  m5a: 'm7g',
  m5n: 'm7g',
  m6i: 'm7g',
  c5: 'c7g',
  c5a: 'c7g',
  c5n: 'c7g',
  c6i: 'c7g',
  r5: 'r7g',
  r5a: 'r7g',
  r5n: 'r7g',
  r6i: 'r7g',
  t3: 't4g',
  t3a: 't4g',
};

const RDS_GRAVITON_ALTERNATIVES: Record<string, string> = {
  'db.m5': 'db.m7g',
  'db.m6i': 'db.m7g',
  'db.r5': 'db.r7g',
  'db.r6i': 'db.r7g',
  'db.t3': 'db.t4g',
};

const ELASTICACHE_GRAVITON_ALTERNATIVES: Record<string, string> = {
  'cache.m5': 'cache.m7g',
  'cache.m6i': 'cache.m7g',
  'cache.r5': 'cache.r7g',
  'cache.r6i': 'cache.r7g',
  'cache.t3': 'cache.t4g',
};

const GRAVITON_SAVINGS_PERCENT = 20;

const EC2_TYPES = ['AWS::EC2::Instance', 'AWS::EC2::LaunchTemplate'];
const RDS_TYPES = ['AWS::RDS::DBInstance', 'AWS::RDS::DBCluster'];
const ELASTICACHE_TYPES = [
  'AWS::ElastiCache::CacheCluster',
  'AWS::ElastiCache::ReplicationGroup',
];

export class GravitonMigrationAnalyzer implements OptimizationAnalyzer {
  readonly category: OptimizationCategory = 'graviton-migration';
  readonly name = 'Graviton Migration';

  isApplicable(resources: ResourceWithId[]): boolean {
    return resources.some(
      (r) =>
        EC2_TYPES.includes(r.type) ||
        RDS_TYPES.includes(r.type) ||
        ELASTICACHE_TYPES.includes(r.type),
    );
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    _region: string,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const resource of resources) {
      const recommendation = this.analyzeResource(resource, resourceCosts);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  private analyzeResource(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    if (EC2_TYPES.includes(resource.type)) {
      return this.analyzeEC2(resource, resourceCosts);
    }
    if (RDS_TYPES.includes(resource.type)) {
      return this.analyzeRDS(resource, resourceCosts);
    }
    if (ELASTICACHE_TYPES.includes(resource.type)) {
      return this.analyzeElastiCache(resource, resourceCosts);
    }
    return null;
  }

  private analyzeEC2(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    const props = resource.properties;
    let instanceType: string | undefined;

    if (resource.type === 'AWS::EC2::LaunchTemplate') {
      const launchData = props.LaunchTemplateData as
        | Record<string, unknown>
        | undefined;
      instanceType = launchData?.InstanceType as string | undefined;
    } else {
      instanceType = props.InstanceType as string | undefined;
    }

    if (!instanceType) return null;

    const family = this.extractFamily(instanceType);
    const gravitonFamily = GRAVITON_ALTERNATIVES[family];
    if (!gravitonFamily) return null;

    const gravitonType = instanceType.replace(family, gravitonFamily);
    const cost = this.findCost(resource.logicalId, resourceCosts);
    const savings = cost * (GRAVITON_SAVINGS_PERCENT / 100);

    return {
      id: `graviton-${resource.logicalId}`,
      title: `Migrate ${resource.logicalId} to Graviton (${gravitonType})`,
      description: `${instanceType} can be replaced with ${gravitonType} for ~${GRAVITON_SAVINGS_PERCENT}% cost reduction. AWS Graviton processors deliver better price-performance for most workloads.`,
      category: this.category,
      priority: savings >= 50 ? 'high' : savings >= 20 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: GRAVITON_SAVINGS_PERCENT,
      affectedResources: [resource.logicalId],
      actionItems: [
        `Change instance type from ${instanceType} to ${gravitonType}`,
        'Test application compatibility with ARM64 architecture',
        'Verify all dependencies support ARM64',
        'Deploy to staging first and monitor for 24 hours',
      ],
      caveats: [
        'Requires ARM64-compatible AMI and software',
        'Some x86-specific workloads may not be compatible',
        `Savings estimate of ${GRAVITON_SAVINGS_PERCENT}% is approximate`,
      ],
    };
  }

  private analyzeRDS(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    const props = resource.properties;
    const instanceClass = props.DBInstanceClass as string | undefined;
    if (!instanceClass) return null;

    const family = this.extractRDSFamily(instanceClass);
    const gravitonFamily = RDS_GRAVITON_ALTERNATIVES[family];
    if (!gravitonFamily) return null;

    const gravitonClass = instanceClass.replace(family, gravitonFamily);
    const cost = this.findCost(resource.logicalId, resourceCosts);
    const savings = cost * (GRAVITON_SAVINGS_PERCENT / 100);

    return {
      id: `graviton-${resource.logicalId}`,
      title: `Migrate ${resource.logicalId} to Graviton (${gravitonClass})`,
      description: `${instanceClass} can be replaced with ${gravitonClass} for ~${GRAVITON_SAVINGS_PERCENT}% cost reduction. RDS on Graviton offers the same functionality at lower cost.`,
      category: this.category,
      priority: savings >= 50 ? 'high' : savings >= 20 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: GRAVITON_SAVINGS_PERCENT,
      affectedResources: [resource.logicalId],
      actionItems: [
        `Change DB instance class from ${instanceClass} to ${gravitonClass}`,
        'Schedule a maintenance window for the instance class change',
        'Test database performance after migration',
      ],
      caveats: [
        'Requires a short downtime during instance class modification',
        'Verify database engine version supports Graviton',
        `Savings estimate of ${GRAVITON_SAVINGS_PERCENT}% is approximate`,
      ],
    };
  }

  private analyzeElastiCache(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    const props = resource.properties;
    const nodeType = (props.CacheNodeType as string) ||
      (props.CacheNodeType as string);
    if (!nodeType) return null;

    const family = this.extractElastiCacheFamily(nodeType);
    const gravitonFamily = ELASTICACHE_GRAVITON_ALTERNATIVES[family];
    if (!gravitonFamily) return null;

    const gravitonNodeType = nodeType.replace(family, gravitonFamily);
    const cost = this.findCost(resource.logicalId, resourceCosts);
    const savings = cost * (GRAVITON_SAVINGS_PERCENT / 100);

    return {
      id: `graviton-${resource.logicalId}`,
      title: `Migrate ${resource.logicalId} to Graviton (${gravitonNodeType})`,
      description: `${nodeType} can be replaced with ${gravitonNodeType} for ~${GRAVITON_SAVINGS_PERCENT}% cost reduction.`,
      category: this.category,
      priority: savings >= 50 ? 'high' : savings >= 20 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: GRAVITON_SAVINGS_PERCENT,
      affectedResources: [resource.logicalId],
      actionItems: [
        `Change node type from ${nodeType} to ${gravitonNodeType}`,
        'Schedule maintenance window for node type change',
        'Monitor cache performance after migration',
      ],
      caveats: [
        'Requires a brief failover during node type modification',
        `Savings estimate of ${GRAVITON_SAVINGS_PERCENT}% is approximate`,
      ],
    };
  }

  private extractFamily(instanceType: string): string {
    // e.g., "m5.xlarge" -> "m5", "c5a.2xlarge" -> "c5a"
    const parts = instanceType.split('.');
    return parts[0] || '';
  }

  private extractRDSFamily(instanceClass: string): string {
    // e.g., "db.m5.large" -> "db.m5"
    const parts = instanceClass.split('.');
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}`;
    }
    return '';
  }

  private extractElastiCacheFamily(nodeType: string): string {
    // e.g., "cache.m5.large" -> "cache.m5"
    const parts = nodeType.split('.');
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}`;
    }
    return '';
  }

  private findCost(logicalId: string, resourceCosts: ResourceCost[]): number {
    const cost = resourceCosts.find((c) => c.logicalId === logicalId);
    return cost?.monthlyCost.amount ?? 0;
  }
}
