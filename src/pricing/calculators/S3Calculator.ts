import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

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
        region: normalizeRegion(region),
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

}
