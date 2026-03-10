import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class EKSCalculator implements ResourceCostCalculator {
  private readonly HOURS_PER_MONTH = 730;
  private readonly FALLBACK_CONTROL_PLANE_HOURLY = 0.10;

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::EKS::Cluster';
  }

  async calculateCost(
    _resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEKS',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Compute' },
          { field: 'usagetype', value: 'AmazonEKS-Hours:perCluster' },
        ],
      });

      const rate = hourlyRate ?? this.FALLBACK_CONTROL_PLANE_HOURLY;
      const monthlyCost = rate * this.HOURS_PER_MONTH;
      const usedFallback = hourlyRate === null;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: usedFallback ? 'medium' : 'high',
        assumptions: [
          `EKS control plane: $${rate.toFixed(2)}/hour × ${this.HOURS_PER_MONTH} hours = $${monthlyCost.toFixed(2)}/month`,
          ...(usedFallback ? [`Using fallback pricing (API data not available for region ${region})`] : []),
          'Worker nodes (EC2/Fargate) are calculated separately',
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
