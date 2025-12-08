import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class S3Calculator implements ResourceCostCalculator {
  private readonly DEFAULT_STORAGE_GB = 100;

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::S3::Bucket';
  }

  async calculateCost(
    _resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const pricePerGB = await pricingClient.getPrice({
        serviceCode: 'AmazonS3',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'storageClass', value: 'General Purpose' },
          { field: 'volumeType', value: 'Standard' },
        ],
      });

      if (pricePerGB === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Pricing data not available for S3 in region ${region}`],
        };
      }

      const monthlyCost = pricePerGB * this.DEFAULT_STORAGE_GB;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Assumes ${this.DEFAULT_STORAGE_GB} GB of standard storage`,
          'Does not include request costs or data transfer',
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
