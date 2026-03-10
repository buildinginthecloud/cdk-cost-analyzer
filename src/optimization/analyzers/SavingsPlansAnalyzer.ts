import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationCategory,
  Recommendation,
} from '../types';

const COMPUTE_SP_DISCOUNT = 30;
const EC2_SP_DISCOUNT = 35;

const COMPUTE_TYPES = [
  'AWS::EC2::Instance',
  'AWS::EC2::LaunchTemplate',
  'AWS::AutoScaling::AutoScalingGroup',
  'AWS::ECS::Service',
  'AWS::ECS::TaskDefinition',
  'AWS::Lambda::Function',
];

const EC2_ONLY_TYPES = [
  'AWS::EC2::Instance',
  'AWS::EC2::LaunchTemplate',
  'AWS::AutoScaling::AutoScalingGroup',
];

const MINIMUM_AGGREGATE_COST = 100;

export class SavingsPlansAnalyzer implements OptimizationAnalyzer {
  readonly category: OptimizationCategory = 'savings-plan';
  readonly name = 'Savings Plans';

  isApplicable(resources: ResourceWithId[]): boolean {
    return resources.some((r) => COMPUTE_TYPES.includes(r.type));
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    _region: string,
  ): Promise<Recommendation[]> {
    const computeResources = resources.filter((r) =>
      COMPUTE_TYPES.includes(r.type),
    );
    if (computeResources.length === 0) return [];

    const totalComputeCost = computeResources.reduce((sum, r) => {
      return sum + this.findCost(r.logicalId, resourceCosts);
    }, 0);

    if (totalComputeCost < MINIMUM_AGGREGATE_COST) return [];

    const recommendations: Recommendation[] = [];
    const hasMultipleComputeTypes = this.hasMultipleComputeTypes(computeResources);
    const ec2OnlyResources = computeResources.filter((r) =>
      EC2_ONLY_TYPES.includes(r.type),
    );

    // Compute Savings Plan (works across EC2, Fargate, Lambda)
    const computeSavings = totalComputeCost * (COMPUTE_SP_DISCOUNT / 100);
    recommendations.push({
      id: 'compute-savings-plan',
      title: 'Purchase Compute Savings Plan',
      description: `Total compute spend across ${computeResources.length} resources is $${totalComputeCost.toFixed(2)}/month. A 1-year Compute Savings Plan could save ~${COMPUTE_SP_DISCOUNT}%.${hasMultipleComputeTypes ? ' Compute Savings Plans apply across EC2, Fargate, and Lambda.' : ''}`,
      category: this.category,
      priority: computeSavings >= 200 ? 'high' : computeSavings >= 100 ? 'medium' : 'low',
      estimatedMonthlySavings: Math.round(computeSavings * 100) / 100,
      estimatedSavingsPercent: COMPUTE_SP_DISCOUNT,
      affectedResources: computeResources.map((r) => r.logicalId),
      actionItems: [
        `Commit to $${Math.round(totalComputeCost * (1 - COMPUTE_SP_DISCOUNT / 100))}/month in compute usage`,
        'Evaluate 1-year vs 3-year term based on workload stability',
        'Use AWS Cost Explorer Savings Plans recommendations for exact pricing',
      ],
      caveats: [
        '1-year minimum commitment',
        `${COMPUTE_SP_DISCOUNT}% discount is approximate; actual savings vary by instance type and region`,
        'Applies to EC2, Fargate, and Lambda compute usage',
        'Cannot be cancelled or modified after purchase',
      ],
    });

    // EC2 Instance Savings Plan (higher discount, less flexibility)
    if (ec2OnlyResources.length > 0) {
      const ec2Cost = ec2OnlyResources.reduce(
        (sum, r) => sum + this.findCost(r.logicalId, resourceCosts),
        0,
      );

      if (ec2Cost >= MINIMUM_AGGREGATE_COST) {
        const ec2Savings = ec2Cost * (EC2_SP_DISCOUNT / 100);
        recommendations.push({
          id: 'ec2-savings-plan',
          title: 'Purchase EC2 Instance Savings Plan',
          description: `EC2 spend is $${ec2Cost.toFixed(2)}/month across ${ec2OnlyResources.length} resources. An EC2 Instance Savings Plan offers ~${EC2_SP_DISCOUNT}% discount (higher than Compute SP) but only applies to EC2.`,
          category: this.category,
          priority: ec2Savings >= 200 ? 'high' : 'medium',
          estimatedMonthlySavings: Math.round(ec2Savings * 100) / 100,
          estimatedSavingsPercent: EC2_SP_DISCOUNT,
          affectedResources: ec2OnlyResources.map((r) => r.logicalId),
          actionItems: [
            'Compare Compute SP vs EC2 Instance SP savings in AWS Cost Explorer',
            'Choose EC2 Instance SP only if EC2 is the dominant compute spend',
            'Consider combining with Compute SP for non-EC2 workloads',
          ],
          caveats: [
            'Only applies to EC2 instance usage (not Fargate or Lambda)',
            'Locked to a specific instance family and region',
            `${EC2_SP_DISCOUNT}% discount is approximate`,
          ],
        });
      }
    }

    return recommendations;
  }

  private hasMultipleComputeTypes(resources: ResourceWithId[]): boolean {
    const types = new Set(resources.map((r) => r.type));
    const hasEC2 = [...types].some((t) => EC2_ONLY_TYPES.includes(t));
    const hasNonEC2 = [...types].some(
      (t) => COMPUTE_TYPES.includes(t) && !EC2_ONLY_TYPES.includes(t),
    );
    return hasEC2 && hasNonEC2;
  }

  private findCost(logicalId: string, resourceCosts: ResourceCost[]): number {
    const cost = resourceCosts.find((c) => c.logicalId === logicalId);
    return cost?.monthlyCost.amount ?? 0;
  }
}
