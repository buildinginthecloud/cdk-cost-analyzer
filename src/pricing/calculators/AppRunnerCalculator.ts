import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class AppRunnerCalculator implements ResourceCostCalculator {
  private readonly HOURS_PER_MONTH = 730;
  private readonly VCPU_HOURLY_RATE = 0.040;
  private readonly MEMORY_HOURLY_RATE = 0.007;
  private readonly REQUEST_RATE_PER_MILLION = 0.10;
  private readonly DEFAULT_REQUESTS_PER_MONTH = 1_000_000;

  constructor(private readonly customRequestsPerMonth?: number) {}

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

    const cpuStr = instanceConfig.Cpu ?? '1 vCPU';
    const memoryStr = instanceConfig.Memory ?? '2 GB';

    const vcpuCount = this.parseCPU(cpuStr);
    const memoryGB = this.parseMemory(memoryStr);
    const requests = this.customRequestsPerMonth ?? this.DEFAULT_REQUESTS_PER_MONTH;

    const vcpuCost = vcpuCount * this.VCPU_HOURLY_RATE * this.HOURS_PER_MONTH;
    const memoryCost = memoryGB * this.MEMORY_HOURLY_RATE * this.HOURS_PER_MONTH;
    const requestCost = (requests / 1_000_000) * this.REQUEST_RATE_PER_MILLION;
    const total = vcpuCost + memoryCost + requestCost;

    return {
      amount: total,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `vCPU: ${vcpuCount} × $${this.VCPU_HOURLY_RATE}/vCPU-hour × ${this.HOURS_PER_MONTH}h = $${vcpuCost.toFixed(2)}/month`,
        `Memory: ${memoryGB} GB × $${this.MEMORY_HOURLY_RATE}/GB-hour × ${this.HOURS_PER_MONTH}h = $${memoryCost.toFixed(2)}/month`,
        `Requests: ${requests.toLocaleString()} × $${this.REQUEST_RATE_PER_MILLION}/million = $${requestCost.toFixed(2)}/month`,
        'Does not include data transfer costs',
      ],
    };
  }

  private parseCPU(cpuStr: string): number {
    return parseFloat(cpuStr);
  }

  private parseMemory(memoryStr: string): number {
    return parseFloat(memoryStr);
  }
}
