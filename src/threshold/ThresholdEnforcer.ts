import { ThresholdEvaluation } from './types';
import { ThresholdConfig, ThresholdLevels } from '../config/types';
import { ResourceCost, ModifiedResourceCost } from '../pricing/types';

export class ThresholdEnforcer {
  /**
   * Evaluate cost delta against configured thresholds
   */
  evaluateThreshold(
    costDelta: number,
    addedResources: ResourceCost[],
    modifiedResources: ModifiedResourceCost[],
    config?: ThresholdConfig,
    environment?: string,
  ): ThresholdEvaluation {
    if (!config) {
      return {
        passed: true,
        level: 'none',
        delta: costDelta,
        message: 'No thresholds configured',
        recommendations: [],
      };
    }

    const thresholds = this.selectThresholds(config, environment);

    if (!thresholds) {
      return {
        passed: true,
        level: 'none',
        delta: costDelta,
        message: 'No thresholds configured',
        recommendations: [],
      };
    }

    // Check error threshold first
    if (thresholds.error !== undefined && costDelta > thresholds.error) {
      const topContributors = this.getTopContributors(
        addedResources,
        modifiedResources,
        5,
      );

      return {
        passed: false,
        level: 'error',
        threshold: thresholds.error,
        delta: costDelta,
        message: this.formatErrorMessage(costDelta, thresholds.error),
        recommendations: this.getRecommendations('error', topContributors),
      };
    }

    // Check warning threshold
    if (thresholds.warning !== undefined && costDelta > thresholds.warning) {
      const topContributors = this.getTopContributors(
        addedResources,
        modifiedResources,
        5,
      );

      return {
        passed: true,
        level: 'warning',
        threshold: thresholds.warning,
        delta: costDelta,
        message: this.formatWarningMessage(costDelta, thresholds.warning),
        recommendations: this.getRecommendations('warning', topContributors),
      };
    }

    return {
      passed: true,
      level: 'none',
      delta: costDelta,
      message: `Cost delta $${costDelta.toFixed(2)}/month is within thresholds`,
      recommendations: [],
    };
  }

  /**
   * Select appropriate threshold based on environment
   */
  private selectThresholds(
    config: ThresholdConfig,
    environment?: string,
  ): ThresholdLevels | undefined {
    if (environment && config.environments?.[environment]) {
      return config.environments[environment];
    }
    return config.default;
  }

  /**
   * Get top cost contributors sorted by impact
   */
  private getTopContributors(
    addedResources: ResourceCost[],
    modifiedResources: ModifiedResourceCost[],
    limit: number,
  ): ResourceCost[] {
    const allContributors: ResourceCost[] = [
      ...addedResources,
      ...modifiedResources.map((r) => ({
        logicalId: r.logicalId,
        type: r.type,
        monthlyCost: {
          amount: r.costDelta,
          currency: r.newMonthlyCost.currency,
          confidence: r.newMonthlyCost.confidence,
          assumptions: r.newMonthlyCost.assumptions,
        },
      })),
    ];

    return allContributors
      .sort((a, b) => b.monthlyCost.amount - a.monthlyCost.amount)
      .slice(0, limit);
  }

  /**
   * Format error threshold message
   */
  private formatErrorMessage(delta: number, threshold: number): string {
    const exceededBy = delta - threshold;
    const percentage = ((exceededBy / threshold) * 100).toFixed(1);

    return `Cost increase of $${delta.toFixed(2)}/month exceeds error threshold of $${threshold.toFixed(2)}/month by $${exceededBy.toFixed(2)} (${percentage}%)`;
  }

  /**
   * Format warning threshold message
   */
  private formatWarningMessage(delta: number, threshold: number): string {
    const exceededBy = delta - threshold;
    const percentage = ((exceededBy / threshold) * 100).toFixed(1);

    return `Cost increase of $${delta.toFixed(2)}/month exceeds warning threshold of $${threshold.toFixed(2)}/month by $${exceededBy.toFixed(2)} (${percentage}%)`;
  }

  /**
   * Get recommendations based on threshold level and contributors
   */
  private getRecommendations(
    level: 'warning' | 'error',
    topContributors: ResourceCost[],
  ): string[] {
    const recommendations: string[] = [];

    if (level === 'error') {
      recommendations.push(
        'This change cannot be merged without approval due to cost impact.',
      );
      recommendations.push(
        'Review the cost breakdown and consider optimizations before proceeding.',
      );
      recommendations.push(
        'Contact your FinOps team for threshold override approval if this cost increase is necessary.',
      );
    } else {
      recommendations.push(
        'Review this cost increase with your team before merging.',
      );
      recommendations.push(
        'Consider whether all resources in this change are necessary.',
      );
    }

    if (topContributors.length > 0) {
      recommendations.push(
        `Top cost contributors: ${topContributors
          .map((r) => `${r.type} (${r.logicalId}): $${r.monthlyCost.amount.toFixed(2)}/month`)
          .join(', ')}`,
      );

      // Specific recommendations based on resource types
      const resourceTypes = new Set(topContributors.map((r) => r.type));

      if (resourceTypes.has('AWS::RDS::DBInstance')) {
        recommendations.push(
          'Consider using smaller RDS instance types or Aurora Serverless for lower costs.',
        );
      }

      if (resourceTypes.has('AWS::EC2::Instance')) {
        recommendations.push(
          'Consider using smaller EC2 instance types, Spot instances, or Savings Plans.',
        );
      }

      if (resourceTypes.has('AWS::EC2::NatGateway')) {
        recommendations.push(
          'NAT Gateways have high data processing costs. Consider using VPC endpoints or consolidating NAT Gateways.',
        );
      }

      if (
        resourceTypes.has('AWS::ElasticLoadBalancingV2::LoadBalancer')
      ) {
        recommendations.push(
          'Load Balancers have hourly costs. Consider sharing load balancers across services if possible.',
        );
      }
    }

    return recommendations;
  }
}
