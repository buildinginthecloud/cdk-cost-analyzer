import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

interface BatchComputeResources {
  Type?: string;
  MaxvCpus?: number;
  DesiredvCpus?: number;
  MinvCpus?: number;
}

// Fargate jobs typically pair memory with vCPU in a ~2 GB / vCPU ratio.
const FARGATE_GB_PER_VCPU = 2;
const DEFAULT_VCPUS = 1;

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
    if (resource.type === 'AWS::Batch::JobDefinition') {
      return this.calculateJobDefinitionCost();
    }
    return this.calculateComputeEnvironmentCost(resource);
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
    const computeResources = (resource.properties.ComputeResources as BatchComputeResources) ?? {};
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

    // FARGATE or FARGATE_SPOT
    const { vcpus, vcpuSource } = this.resolveVcpus(computeResources);
    const memoryGB = vcpus * FARGATE_GB_PER_VCPU;
    const hours = this.customHoursPerMonth ?? this.DEFAULT_HOURS_PER_MONTH;
    const vcpuCost = vcpus * this.FARGATE_VCPU_HOURLY * hours;
    const memoryCost = memoryGB * this.FARGATE_MEMORY_HOURLY * hours;
    const total = vcpuCost + memoryCost;

    return {
      amount: total,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        'Fargate compute environment',
        `vCPUs: ${vcpus} (${vcpuSource})`,
        `vCPU cost: ${vcpus} × $${this.FARGATE_VCPU_HOURLY}/vCPU-hour × ${hours}h = $${vcpuCost.toFixed(4)}/month`,
        `Memory cost: ${memoryGB} GB × $${this.FARGATE_MEMORY_HOURLY}/GB-hour × ${hours}h = $${memoryCost.toFixed(4)}/month`,
        `Assumes ${FARGATE_GB_PER_VCPU} GB memory per vCPU (typical Fargate ratio)`,
        'MaxvCpus represents peak capacity, not average utilization - real costs depend on job run frequency',
      ],
    };
  }

  private resolveVcpus(computeResources: BatchComputeResources): { vcpus: number; vcpuSource: string } {
    if (typeof computeResources.MaxvCpus === 'number') {
      return { vcpus: computeResources.MaxvCpus, vcpuSource: 'MaxvCpus from template' };
    }
    if (typeof computeResources.DesiredvCpus === 'number') {
      return { vcpus: computeResources.DesiredvCpus, vcpuSource: 'DesiredvCpus from template' };
    }
    return { vcpus: DEFAULT_VCPUS, vcpuSource: `default ${DEFAULT_VCPUS} vCPU (no MaxvCpus/DesiredvCpus in template)` };
  }
}
