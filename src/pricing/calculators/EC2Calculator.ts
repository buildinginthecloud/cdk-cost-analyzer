import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class EC2Calculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::EC2::Instance';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const instanceType = resource.properties.InstanceType as string;

    if (!instanceType) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: ['Instance type not specified'],
      };
    }

    try {
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'instanceType', value: instanceType },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });

      if (hourlyRate === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Pricing data not available for instance type ${instanceType} in region ${region}`],
        };
      }

      const monthlyHours = 730;
      const monthlyCost = hourlyRate * monthlyHours;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          `Assumes ${monthlyHours} hours per month (24/7 operation)`,
          'Assumes Linux OS, shared tenancy, on-demand pricing',
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
