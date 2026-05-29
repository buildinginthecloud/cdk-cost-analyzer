import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

// Valid CPU configurations for AWS App Runner.
// @see https://docs.aws.amazon.com/apprunner/latest/dg/architecture.html
const CPU_VALUES: Record<string, number> = {
  '0.25 vCPU': 0.25,
  '0.5 vCPU': 0.5,
  '1 vCPU': 1,
  '2 vCPU': 2,
  '4 vCPU': 4,
};

const MEMORY_VALUES: Record<string, number> = {
  '0.5 GB': 0.5,
  '1 GB': 1,
  '2 GB': 2,
  '3 GB': 3,
  '4 GB': 4,
  '6 GB': 6,
  '8 GB': 8,
  '10 GB': 10,
  '12 GB': 12,
};

const DEFAULT_CPU = '1 vCPU';
const DEFAULT_MEMORY = '2 GB';

/**
 * Calculator for AWS App Runner service costs.
 *
 * NOTE: AWS App Runner is in maintenance mode as of 2026. No new customers
 * are accepted after April 30, 2026. Existing services continue to operate.
 * The AWS-recommended replacement is Amazon ECS Express Mode.
 *
 * @see https://aws.amazon.com/apprunner/pricing/
 */
export class AppRunnerCalculator implements ResourceCostCalculator {
  private readonly VCPU_HOURLY_RATE = 0.064;
  private readonly MEMORY_HOURLY_RATE = 0.007;
  private readonly REQUEST_RATE_PER_MILLION = 0.10;
  private readonly DEFAULT_REQUESTS_PER_MONTH = 1_000_000;

  constructor(
    private readonly customRequestsPerMonth?: number,
    private readonly customHoursPerMonth?: number,
  ) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::AppRunner::Service';
  }

  async calculateCost(
    resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const instanceConfig = (resource.properties.InstanceConfiguration as {
      Cpu?: string;
      Memory?: string;
    }) ?? {};

    const cpuStr = instanceConfig.Cpu ?? DEFAULT_CPU;
    const memoryStr = instanceConfig.Memory ?? DEFAULT_MEMORY;

    const { value: vcpuCount, isKnown: cpuKnown } = this.parseCPU(cpuStr);
    const { value: memoryGB, isKnown: memoryKnown } = this.parseMemory(memoryStr);
    const requests = this.customRequestsPerMonth ?? this.DEFAULT_REQUESTS_PER_MONTH;
    const hoursPerMonth = this.customHoursPerMonth ?? 730;

    const vcpuCost = vcpuCount * this.VCPU_HOURLY_RATE * hoursPerMonth;
    const memoryCost = memoryGB * this.MEMORY_HOURLY_RATE * hoursPerMonth;
    const requestCost = (requests / 1_000_000) * this.REQUEST_RATE_PER_MILLION;
    const total = vcpuCost + memoryCost + requestCost;

    const assumptions: string[] = [
      `vCPU: ${vcpuCount} × $${this.VCPU_HOURLY_RATE}/vCPU-hour × ${hoursPerMonth}h = $${vcpuCost.toFixed(2)}/month`,
      `Memory: ${memoryGB} GB × $${this.MEMORY_HOURLY_RATE}/GB-hour × ${hoursPerMonth}h = $${memoryCost.toFixed(2)}/month`,
      `Requests: ${requests.toLocaleString()} × $${this.REQUEST_RATE_PER_MILLION}/million = $${requestCost.toFixed(2)}/month`,
      'Does not include data transfer costs',
      'AWS App Runner is in maintenance mode - consider migrating to ECS Express Mode',
    ];

    if (!cpuKnown) {
      assumptions.push(`Unrecognized Cpu value "${cpuStr}" - parsed numerically as ${vcpuCount} vCPU`);
    }
    if (!memoryKnown) {
      assumptions.push(`Unrecognized Memory value "${memoryStr}" - parsed numerically as ${memoryGB} GB`);
    }

    return {
      amount: total,
      currency: 'USD',
      confidence: (cpuKnown && memoryKnown) ? 'medium' : 'low',
      assumptions,
    };
  }

  private parseCPU(cpuStr: string): { value: number; isKnown: boolean } {
    if (cpuStr in CPU_VALUES) {
      return { value: CPU_VALUES[cpuStr], isKnown: true };
    }
    const parsed = parseFloat(cpuStr);
    return { value: Number.isFinite(parsed) ? parsed : 1, isKnown: false };
  }

  private parseMemory(memoryStr: string): { value: number; isKnown: boolean } {
    if (memoryStr in MEMORY_VALUES) {
      return { value: MEMORY_VALUES[memoryStr], isKnown: true };
    }
    const parsed = parseFloat(memoryStr);
    return { value: Number.isFinite(parsed) ? parsed : 2, isKnown: false };
  }
}
