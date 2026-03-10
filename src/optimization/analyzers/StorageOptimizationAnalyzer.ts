import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationCategory,
  Recommendation,
} from '../types';

const GP2_TO_GP3_SAVINGS_PERCENT = 20;

export class StorageOptimizationAnalyzer implements OptimizationAnalyzer {
  readonly category: OptimizationCategory = 'storage-optimization';
  readonly name = 'Storage Optimization';

  isApplicable(resources: ResourceWithId[]): boolean {
    return resources.some(
      (r) =>
        r.type === 'AWS::S3::Bucket' ||
        r.type === 'AWS::EC2::Volume' ||
        r.type === 'AWS::EC2::LaunchTemplate',
    );
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    _region: string,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const resource of resources) {
      if (resource.type === 'AWS::S3::Bucket') {
        const rec = this.analyzeS3Bucket(resource);
        if (rec) recommendations.push(rec);
      }
      if (resource.type === 'AWS::EC2::Volume') {
        const rec = this.analyzeEBSVolume(resource, resourceCosts);
        if (rec) recommendations.push(rec);
      }
      if (resource.type === 'AWS::EC2::LaunchTemplate') {
        const recs = this.analyzeLaunchTemplate(resource, resourceCosts);
        recommendations.push(...recs);
      }
    }

    return recommendations;
  }

  private analyzeS3Bucket(resource: ResourceWithId): Recommendation | null {
    const props = resource.properties;
    const hasLifecycle = props.LifecycleConfiguration !== undefined;
    const hasIntelligentTiering = this.hasIntelligentTieringConfig(props);

    if (hasLifecycle && hasIntelligentTiering) return null;

    const actionItems: string[] = [];
    if (!hasIntelligentTiering) {
      actionItems.push(
        'Enable S3 Intelligent-Tiering to automatically optimize storage costs based on access patterns',
      );
    }
    if (!hasLifecycle) {
      actionItems.push(
        'Add lifecycle rules to transition infrequently accessed objects to cheaper storage classes',
        'Consider archiving objects older than 90 days to S3 Glacier',
      );
    }

    return {
      id: `s3-tiering-${resource.logicalId}`,
      title: `Optimize storage for ${resource.logicalId}`,
      description: `S3 bucket ${resource.logicalId} ${!hasLifecycle ? 'has no lifecycle rules' : 'lacks Intelligent-Tiering'}. Adding lifecycle policies and Intelligent-Tiering can reduce storage costs by 30-75% for infrequently accessed data.`,
      category: this.category,
      priority: 'medium',
      estimatedMonthlySavings: 0,
      estimatedSavingsPercent: 0,
      affectedResources: [resource.logicalId],
      actionItems,
      caveats: [
        'Savings depend on data access patterns and total storage volume',
        'Intelligent-Tiering has a small monitoring fee ($0.0025/1000 objects)',
        'Glacier retrieval takes minutes to hours depending on tier',
      ],
    };
  }

  private analyzeEBSVolume(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    const volumeType = (resource.properties.VolumeType as string) || 'gp2';

    if (volumeType !== 'gp2') return null;

    const cost = this.findCost(resource.logicalId, resourceCosts);
    const savings = cost * (GP2_TO_GP3_SAVINGS_PERCENT / 100);
    const sizeGB = (resource.properties.Size as number) || 0;

    return {
      id: `gp3-migration-${resource.logicalId}`,
      title: `Migrate ${resource.logicalId} from gp2 to gp3`,
      description: `EBS volume ${resource.logicalId} uses gp2${sizeGB ? ` (${sizeGB} GB)` : ''}. gp3 volumes are 20% cheaper with better baseline performance (3,000 IOPS vs 100 IOPS/GB for gp2).`,
      category: this.category,
      priority: savings >= 20 ? 'high' : 'medium',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: GP2_TO_GP3_SAVINGS_PERCENT,
      affectedResources: [resource.logicalId],
      actionItems: [
        'Change VolumeType from gp2 to gp3',
        'Set desired IOPS and throughput (gp3 baseline: 3,000 IOPS, 125 MB/s)',
        'No downtime required; modification is online',
      ],
      caveats: [
        'Online modification takes time to complete',
        'If workload requires >3,000 IOPS, additional IOPS provisioning costs apply',
        `Savings estimate of ${GP2_TO_GP3_SAVINGS_PERCENT}% is based on standard pricing`,
      ],
    };
  }

  private analyzeLaunchTemplate(
    resource: ResourceWithId,
    _resourceCosts: ResourceCost[],
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const launchData = resource.properties.LaunchTemplateData as
      | Record<string, unknown>
      | undefined;
    if (!launchData) return recommendations;

    const blockDevices = launchData.BlockDeviceMappings as
      | Array<Record<string, unknown>>
      | undefined;
    if (!blockDevices) return recommendations;

    for (const bdm of blockDevices) {
      const ebs = bdm.Ebs as Record<string, unknown> | undefined;
      if (!ebs) continue;

      const volumeType = (ebs.VolumeType as string) || 'gp2';
      if (volumeType !== 'gp2') continue;

      const deviceName = (bdm.DeviceName as string) || 'unknown';
      recommendations.push({
        id: `gp3-lt-${resource.logicalId}-${deviceName}`,
        title: `Migrate ${resource.logicalId} EBS (${deviceName}) to gp3`,
        description: `Launch template ${resource.logicalId} uses gp2 for ${deviceName}. Switching to gp3 saves ~20% with better baseline performance.`,
        category: this.category,
        priority: 'medium',
        estimatedMonthlySavings: 0,
        estimatedSavingsPercent: GP2_TO_GP3_SAVINGS_PERCENT,
        affectedResources: [resource.logicalId],
        actionItems: [
          `Change VolumeType from gp2 to gp3 for ${deviceName} in LaunchTemplateData`,
        ],
        caveats: [
          'New instances will use gp3; existing instances are unaffected',
          'Requires launching new instances or modifying existing volumes separately',
        ],
      });
    }

    return recommendations;
  }

  private hasIntelligentTieringConfig(
    props: Record<string, unknown>,
  ): boolean {
    const tiering = props.IntelligentTieringConfigurations;
    if (tiering) return true;

    const analytics = props.AnalyticsConfigurations as
      | Array<Record<string, unknown>>
      | undefined;
    if (analytics?.some((a) => a.StorageClassAnalysis)) return true;

    return false;
  }

  private findCost(logicalId: string, resourceCosts: ResourceCost[]): number {
    const cost = resourceCosts.find((c) => c.logicalId === logicalId);
    return cost?.monthlyCost.amount ?? 0;
  }
}
