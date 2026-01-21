import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

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

      const regionPrefix = this.getRegionPrefix(region);
      if (!regionPrefix) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Region prefix not found for ${region}`,
            'Unable to query Fargate pricing',
          ],
        };
      }

      const vCpuCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonECS',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Compute' },
          { field: 'usagetype', value: `${regionPrefix}-Fargate-vCPU-Hours:perCPU` },
        ],
      });

      const memoryCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonECS',
        region: normalizeRegion(region),
        filters: [
          { field: 'usagetype', value: `${regionPrefix}-Fargate-GB-Hours` },
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

  private getRegionPrefix(region: string): string {
    // AWS uses region prefixes in usage types for ECS Fargate
    // Format: {PREFIX}-Fargate-vCPU-Hours:perCPU or {PREFIX}-Fargate-GB-Hours
    const prefixMap: Record<string, string> = {
      // US Regions
      'us-east-1': 'USE1',
      'us-east-2': 'USE2',
      'us-west-1': 'USW1',
      'us-west-2': 'USW2',
      // EU Regions
      'eu-west-1': 'EUW1',
      'eu-west-2': 'EUW2',
      'eu-west-3': 'EUW3',
      'eu-central-1': 'EUC1',
      'eu-central-2': 'EUC2',
      'eu-north-1': 'EUN1',
      'eu-south-1': 'EUS1',
      'eu-south-2': 'EUS2',
      // Asia Pacific Regions
      'ap-south-1': 'APS1',
      'ap-south-2': 'APS2',
      'ap-southeast-1': 'APS3',
      'ap-southeast-2': 'APS4',
      'ap-southeast-3': 'APS5',
      'ap-southeast-4': 'APS6',
      'ap-northeast-1': 'APN1',
      'ap-northeast-2': 'APN2',
      'ap-northeast-3': 'APN3',
      'ap-east-1': 'APE1',
      // Canada Regions
      'ca-central-1': 'CAN1',
      'ca-west-1': 'CAW1',
      // South America Regions
      'sa-east-1': 'SAE1',
      // Middle East Regions
      'me-south-1': 'MES1',
      'me-central-1': 'MEC1',
      // Africa Regions
      'af-south-1': 'AFS1',
      // Israel Regions
      'il-central-1': 'ILC1',
      // Other Regions
      'ap-southeast-5': 'APS7',
      'us-gov-west-1': 'UGW1',
      'us-gov-east-1': 'UGE1',
    };

    return prefixMap[region] || '';
  }
}
