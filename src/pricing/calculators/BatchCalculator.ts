import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class BatchCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_HOURS_PER_MONTH = 100;
  private readonly FARGATE_VCPU_HOURLY = 0.04048;
  private readonly FARGATE_MEMORY_HOURLY = 0.004445;

  constructor(private readonly customHoursPerMonth?: number) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::Batch::JobDefinition' ||
      resourceType === 'AWS::Batch::ComputeEnvironment'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    switch (resource.type) {
      case 'AWS::Batch::JobDefinition':
        return this.calculateJobDefinitionCost();
      case 'AWS::Batch::ComputeEnvironment':
        return this.calculateComputeEnvironmentCost(resource);
      default:
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Unsupported Batch resource type: ${resource.type}`],
        };
    }
  }

  private calculateJobDefinitionCost(): MonthlyCost {
    return {
      amount: 0,
      currency: 'USD',
      confidence: 'high',
      assumptions: [
        'AWS Batch has no additional charge for job definitions - costs are incurred on compute environments',
      ],
    };
  }

  private calculateComputeEnvironmentCost(resource: ResourceWithId): MonthlyCost {
    const computeResources = (resource.properties.ComputeResources as { Type?: string }) ?? {};
    const computeType = computeResources.Type?.toUpperCase() ?? 'FARGATE';

    if (computeType === 'EC2' || computeType === 'SPOT') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          'EC2-based Batch uses underlying EC2 instance pricing - calculate costs via the EC2 instances directly',
        ],
      };
    }

    // FARGATE or FARGATE_SPOT default
    const hours = this.customHoursPerMonth ?? this.DEFAULT_HOURS_PER_MONTH;
    const vcpuCost = 1 * this.FARGATE_VCPU_HOURLY * hours;
    const memoryCost = 2 * this.FARGATE_MEMORY_HOURLY * hours;
    const total = vcpuCost + memoryCost;

    return {
      amount: total,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `Fargate compute environment`,
        `vCPU: 1 × $${this.FARGATE_VCPU_HOURLY}/vCPU-hour × ${hours}h = $${vcpuCost.toFixed(4)}/month`,
        `Memory: 2 GB × $${this.FARGATE_MEMORY_HOURLY}/GB-hour × ${hours}h = $${memoryCost.toFixed(4)}/month`,
        'Assumes 1 vCPU, 2 GB memory as default job size',
        'Actual costs depend on job resource requirements and run frequency',
      ],
    };
  }
}
