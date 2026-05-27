import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

const FALLBACK_HOURLY_RATE = 0.348;
const DEFAULT_INSTANCE_CLASS = 'db.r5.large';
const MONTHLY_HOURS = 730;
const DEFAULT_STORAGE_GB = 100;
const STORAGE_PRICE_PER_GB = 0.10;

export class NeptuneCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::Neptune::DBCluster' ||
      resourceType === 'AWS::Neptune::DBInstance'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    if (resource.type === 'AWS::Neptune::DBCluster') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          'Neptune cluster cost is calculated on individual AWS::Neptune::DBInstance resources',
        ],
      };
    }

    // AWS::Neptune::DBInstance
    const instanceClass =
      (resource.properties.DBInstanceClass as string) ?? DEFAULT_INSTANCE_CLASS;

    try {
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonNeptune',
        region: normalizeRegion(region),
        filters: [{ field: 'instanceType', value: instanceClass }],
      });

      const usedFallback = hourlyRate === null;
      const rate = hourlyRate ?? FALLBACK_HOURLY_RATE;
      const instanceCost = rate * MONTHLY_HOURS;
      const storageCost = DEFAULT_STORAGE_GB * STORAGE_PRICE_PER_GB;
      const total = instanceCost + storageCost;

      return {
        amount: total,
        currency: 'USD',
        confidence: usedFallback ? 'medium' : 'high',
        assumptions: [
          `Instance class: ${instanceClass}`,
          `Assumes ${MONTHLY_HOURS} hours per month (24/7 operation)`,
          `Assumes ${DEFAULT_STORAGE_GB} GB of storage at $${STORAGE_PRICE_PER_GB}/GB-month`,
          ...(usedFallback
            ? [`Using fallback hourly rate: $${FALLBACK_HOURLY_RATE} (pricing API returned no data)`]
            : []),
        ],
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }
}
