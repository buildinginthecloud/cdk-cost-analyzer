import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

const FALLBACK_HOURLY_RATE = 0.24;
const DEFAULT_INSTANCE_CLASS = 'db.r6g.large';
const MONTHLY_HOURS = 730;
const DEFAULT_STORAGE_GB = 100;
const STORAGE_PRICE_PER_GB = 0.10;

export class DocumentDBCalculator implements ResourceCostCalculator {
  constructor(private readonly customStorageGB?: number) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::DocDB::DBCluster' ||
      resourceType === 'AWS::DocDB::DBInstance'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    if (resource.type === 'AWS::DocDB::DBCluster') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          'DocumentDB cluster cost is calculated on individual AWS::DocDB::DBInstance resources',
        ],
      };
    }

    // AWS::DocDB::DBInstance
    const instanceClass =
      (resource.properties.DBInstanceClass as string) ?? DEFAULT_INSTANCE_CLASS;

    try {
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonDocDB',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Database Instance' },
          { field: 'instanceType', value: instanceClass },
        ],
      });

      const usedFallback = hourlyRate === null;
      const fallbackMatchesClass = instanceClass === DEFAULT_INSTANCE_CLASS;
      const rate = hourlyRate ?? FALLBACK_HOURLY_RATE;
      const instanceCost = rate * MONTHLY_HOURS;
      const storageGB = this.customStorageGB ?? DEFAULT_STORAGE_GB;
      const storageCost = storageGB * STORAGE_PRICE_PER_GB;
      const total = instanceCost + storageCost;

      // When the API returns null and the requested instance class differs from
      // the fallback's baseline class, the estimate is unreliable — mark it low.
      const confidence: MonthlyCost['confidence'] = usedFallback
        ? (fallbackMatchesClass ? 'medium' : 'low')
        : 'high';

      return {
        amount: total,
        currency: 'USD',
        confidence,
        assumptions: [
          `Instance class: ${instanceClass}`,
          `Assumes ${MONTHLY_HOURS} hours per month (24/7 operation)`,
          `Assumes ${storageGB} GB of storage at $${STORAGE_PRICE_PER_GB}/GB-month`,
          ...(usedFallback
            ? [
              `Using fallback hourly rate: $${FALLBACK_HOURLY_RATE} (pricing API returned no data)`,
              ...(fallbackMatchesClass
                ? []
                : [`Fallback rate is calibrated for ${DEFAULT_INSTANCE_CLASS} - actual ${instanceClass} cost will differ`]),
            ]
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
