import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class ECSCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::ECS::Service';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const desiredCount = (resource.properties.DesiredCount as number) || 1;
    const launchType = (resource.properties.LaunchType as string) || 'FARGATE';

    if (launchType === 'FARGATE') {
      return this.calculateFargateCost(resource, desiredCount, region, pricingClient);
    } else if (launchType === 'EC2') {
      return this.calculateEC2Cost(desiredCount);
    } else {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Unsupported launch type: ${launchType}`],
      };
    }
  }

  private async calculateFargateCost(
    _resource: ResourceWithId,
    desiredCount: number,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      // Default assumptions for Fargate task
      const assumedVCpu = 0.25; // 0.25 vCPU
      const assumedMemoryGB = 0.5; // 0.5 GB

      const vCpuCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonECS',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Compute' },
          { field: 'usagetype', value: `${region}-Fargate-vCPU-Hours:perCPU` },
        ],
      });

      const memoryCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonECS',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Compute' },
          { field: 'usagetype', value: `${region}-Fargate-GB-Hours:perGB` },
        ],
      });

      if (vCpuCostPerHour === null || memoryCostPerHour === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: ['Pricing data not available for ECS Fargate'],
        };
      }

      const hoursPerMonth = 730;
      const vCpuCost = assumedVCpu * vCpuCostPerHour * hoursPerMonth * desiredCount;
      const memoryCost = assumedMemoryGB * memoryCostPerHour * hoursPerMonth * desiredCount;
      const monthlyCost = vCpuCost + memoryCost;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `${desiredCount} task(s) running`,
          `Assumes ${assumedVCpu} vCPU per task`,
          `Assumes ${assumedMemoryGB} GB memory per task`,
          `Assumes ${hoursPerMonth} hours per month (24/7 operation)`,
          'Fargate launch type',
          'Does not include data transfer or storage costs',
        ],
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private calculateEC2Cost(desiredCount: number): MonthlyCost {
    return {
      amount: 0,
      currency: 'USD',
      confidence: 'low',
      assumptions: [
        `${desiredCount} task(s) running on EC2 launch type`,
        'EC2 launch type costs depend on underlying EC2 instances',
        'Refer to EC2 instance costs for actual pricing',
        'Does not include ECS task-specific costs (minimal for EC2 launch type)',
      ],
    };
  }

  private normalizeRegion(region: string): string {
    const regionMap: Record<string, string> = {
      'us-east-1': 'US East (N. Virginia)',
      'us-east-2': 'US East (Ohio)',
      'us-west-1': 'US West (N. California)',
      'us-west-2': 'US West (Oregon)',
      'eu-west-1': 'EU (Ireland)',
      'eu-west-2': 'EU (London)',
      'eu-west-3': 'EU (Paris)',
      'eu-central-1': 'EU (Frankfurt)',
      'eu-north-1': 'EU (Stockholm)',
      'ap-south-1': 'Asia Pacific (Mumbai)',
      'ap-southeast-1': 'Asia Pacific (Singapore)',
      'ap-southeast-2': 'Asia Pacific (Sydney)',
      'ap-northeast-1': 'Asia Pacific (Tokyo)',
      'ap-northeast-2': 'Asia Pacific (Seoul)',
    };

    return regionMap[region] || region;
  }
}
