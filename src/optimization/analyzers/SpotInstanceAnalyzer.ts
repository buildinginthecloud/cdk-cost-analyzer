import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationCategory,
  Recommendation,
} from '../types';

const SPOT_SAVINGS_PERCENT = 60;

export class SpotInstanceAnalyzer implements OptimizationAnalyzer {
  readonly category: OptimizationCategory = 'spot-instance';
  readonly name = 'Spot Instances';

  isApplicable(resources: ResourceWithId[]): boolean {
    return resources.some(
      (r) =>
        r.type === 'AWS::AutoScaling::AutoScalingGroup' ||
        r.type === 'AWS::ECS::Service',
    );
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    _region: string,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const resource of resources) {
      if (resource.type === 'AWS::AutoScaling::AutoScalingGroup') {
        const rec = this.analyzeASG(resource, resourceCosts);
        if (rec) recommendations.push(rec);
      }
      if (resource.type === 'AWS::ECS::Service') {
        const rec = this.analyzeECSService(resource, resourceCosts);
        if (rec) recommendations.push(rec);
      }
    }

    return recommendations;
  }

  private analyzeASG(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    const props = resource.properties;

    // Skip if already using mixed instances / spot
    const mixedPolicy = props.MixedInstancesPolicy as
      | Record<string, unknown>
      | undefined;
    if (mixedPolicy) {
      const instancesDistribution = mixedPolicy.InstancesDistribution as
        | Record<string, unknown>
        | undefined;
      const spotPercent =
        instancesDistribution?.OnDemandPercentageAboveBaseCapacity;
      if (spotPercent !== undefined && (spotPercent as number) < 100) {
        return null;
      }
    }

    const cost = this.findCost(resource.logicalId, resourceCosts);
    // Suggest using 50% spot for a balanced approach
    const spotPercentage = 50;
    const savings = cost * (spotPercentage / 100) * (SPOT_SAVINGS_PERCENT / 100);

    return {
      id: `spot-${resource.logicalId}`,
      title: `Use Spot Instances in ${resource.logicalId}`,
      description: `ASG ${resource.logicalId} uses only on-demand instances. A mixed instances policy with ${spotPercentage}% Spot capacity can save ~$${savings.toFixed(2)}/month. Spot Instances are up to ${SPOT_SAVINGS_PERCENT}% cheaper than on-demand.`,
      category: this.category,
      priority: savings >= 100 ? 'high' : savings >= 30 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: Math.round(
        (SPOT_SAVINGS_PERCENT * spotPercentage) / 100,
      ),
      affectedResources: [resource.logicalId],
      actionItems: [
        'Add MixedInstancesPolicy with OnDemandPercentageAboveBaseCapacity: 50',
        'Diversify across multiple instance types for better Spot availability',
        'Use Capacity Rebalancing to proactively replace Spot instances before termination',
        'Ensure application handles graceful shutdown (2-minute termination notice)',
      ],
      caveats: [
        'Spot Instances can be interrupted with 2 minutes notice',
        'Only suitable for fault-tolerant, stateless workloads',
        'Not recommended for databases or stateful services',
        'Spot availability varies by instance type, AZ, and time',
      ],
    };
  }

  private analyzeECSService(
    resource: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    const props = resource.properties;

    // Check if already using Spot
    const capacityProviders = props.CapacityProviderStrategy as
      | Array<Record<string, unknown>>
      | undefined;
    if (capacityProviders) {
      const hasSpot = capacityProviders.some((cp) => {
        const name = (cp.CapacityProvider as string) || '';
        return name.includes('SPOT') || name.includes('Spot');
      });
      if (hasSpot) return null;
    }

    // Check launch type; only FARGATE services can easily use FARGATE_SPOT
    const launchType = props.LaunchType as string | undefined;
    if (launchType && launchType !== 'FARGATE') return null;

    const cost = this.findCost(resource.logicalId, resourceCosts);
    const spotPercentage = 50;
    const fargateSpotDiscount = 70;
    const savings = cost * (spotPercentage / 100) * (fargateSpotDiscount / 100);

    return {
      id: `spot-ecs-${resource.logicalId}`,
      title: `Use Fargate Spot for ${resource.logicalId}`,
      description: `ECS service ${resource.logicalId} uses only standard Fargate. Fargate Spot is up to ${fargateSpotDiscount}% cheaper. Using ${spotPercentage}% Spot capacity can save ~$${savings.toFixed(2)}/month.`,
      category: this.category,
      priority: savings >= 50 ? 'high' : savings >= 20 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: Math.round(
        (fargateSpotDiscount * spotPercentage) / 100,
      ),
      affectedResources: [resource.logicalId],
      actionItems: [
        'Add CapacityProviderStrategy with FARGATE (base) and FARGATE_SPOT',
        'Set FARGATE as base capacity and FARGATE_SPOT for scaling',
        'Ensure tasks handle SIGTERM gracefully for Spot interruptions',
      ],
      caveats: [
        'Fargate Spot tasks can be interrupted when AWS needs capacity',
        'Not suitable for latency-sensitive or stateful workloads',
        'Tasks receive a 30-second warning before termination',
      ],
    };
  }

  private findCost(logicalId: string, resourceCosts: ResourceCost[]): number {
    const cost = resourceCosts.find((c) => c.logicalId === logicalId);
    return cost?.monthlyCost.amount ?? 0;
  }
}
