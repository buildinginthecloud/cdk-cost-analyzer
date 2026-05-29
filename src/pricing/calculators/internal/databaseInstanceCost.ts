import { ResourceWithId } from '../../../diff/types';
import { MonthlyCost, PricingClient } from '../../types';
import { normalizeRegion } from '../../RegionMapper';

export const MONTHLY_HOURS = 730;
export const DEFAULT_STORAGE_GB = 100;
export const STORAGE_PRICE_PER_GB = 0.10;

export interface DatabaseInstancePricingConfig {
  serviceCode: string;
  defaultInstanceClass: string;
  fallbackHourlyRate: number;
  productFamily: string;
  customStorageGB?: number;
}

/**
 * Calculates monthly cost for a DocumentDB- or Neptune-style instance.
 * Both services bill on instance-hour + per-GB storage and share the same
 * pricing-API filter structure, so this helper avoids duplication.
 */
export async function calculateDatabaseInstanceCost(
  resource: ResourceWithId,
  region: string,
  pricingClient: PricingClient,
  config: DatabaseInstancePricingConfig,
): Promise<MonthlyCost> {
  const instanceClass =
    (resource.properties.DBInstanceClass as string) ?? config.defaultInstanceClass;

  try {
    const hourlyRate = await pricingClient.getPrice({
      serviceCode: config.serviceCode,
      region: normalizeRegion(region),
      filters: [
        { field: 'productFamily', value: config.productFamily },
        { field: 'instanceType', value: instanceClass },
      ],
    });

    const usedFallback = hourlyRate === null;
    const fallbackMatchesClass = instanceClass === config.defaultInstanceClass;
    const rate = hourlyRate ?? config.fallbackHourlyRate;
    const instanceCost = rate * MONTHLY_HOURS;
    const storageGB = config.customStorageGB ?? DEFAULT_STORAGE_GB;
    const storageCost = storageGB * STORAGE_PRICE_PER_GB;
    const total = instanceCost + storageCost;

    // When the API returns null and the requested instance class differs from
    // the fallback's baseline class, the estimate is unreliable - mark it low.
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
            `Using fallback hourly rate: $${config.fallbackHourlyRate} (pricing API returned no data)`,
            ...(fallbackMatchesClass
              ? []
              : [`Fallback rate is calibrated for ${config.defaultInstanceClass} - actual ${instanceClass} cost will differ`]),
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
