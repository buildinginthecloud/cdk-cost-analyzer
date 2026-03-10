import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class AuroraServerlessCalculator implements ResourceCostCalculator {
  private readonly HOURS_PER_MONTH = 730;
  private readonly DEFAULT_MIN_ACU = 0.5;
  private readonly DEFAULT_MAX_ACU = 16;
  private readonly DEFAULT_STORAGE_GB = 100;
  private readonly DEFAULT_MONTHLY_IO_REQUESTS = 100_000_000;
  private readonly FALLBACK_ACU_PRICE_V2 = 0.12;
  private readonly FALLBACK_ACU_PRICE_V1 = 0.06;
  private readonly STORAGE_PRICE_PER_GB = 0.10;
  private readonly IO_PRICE_PER_MILLION = 0.20;

  constructor(
    private readonly customMinACU?: number,
    private readonly customMaxACU?: number,
    private readonly customStorageGB?: number,
  ) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::RDS::DBCluster';
  }

  canCalculate(resource: ResourceWithId): boolean {
    const props = resource.properties || {};
    return (
      (props.EngineMode as string) === 'serverless' ||
      props.ServerlessV2ScalingConfiguration !== undefined
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const props = resource.properties || {};
      const scalingConfig = props.ServerlessV2ScalingConfiguration as Record<string, unknown> | undefined;
      const isV2 = scalingConfig !== undefined;

      const minACU = this.customMinACU
        ?? (scalingConfig?.MinCapacity as number | undefined)
        ?? this.DEFAULT_MIN_ACU;
      const maxACU = this.customMaxACU
        ?? (scalingConfig?.MaxCapacity as number | undefined)
        ?? this.DEFAULT_MAX_ACU;
      const avgACU = (minACU + maxACU) / 2;

      const fallbackPrice = isV2 ? this.FALLBACK_ACU_PRICE_V2 : this.FALLBACK_ACU_PRICE_V1;

      const acuPrice = await pricingClient.getPrice({
        serviceCode: 'AmazonRDS',
        region: normalizeRegion(region),
        filters: [
          { field: 'databaseEngine', value: 'Aurora' },
          { field: 'productFamily', value: 'ServerlessV2' },
        ],
      });

      const rate = acuPrice ?? fallbackPrice;
      const usedFallback = acuPrice === null;
      const computeCost = avgACU * this.HOURS_PER_MONTH * rate;

      const storageGB = this.customStorageGB ?? this.DEFAULT_STORAGE_GB;
      const storageCost = storageGB * this.STORAGE_PRICE_PER_GB;

      let ioCost = 0;
      if (isV2) {
        ioCost = (this.DEFAULT_MONTHLY_IO_REQUESTS / 1_000_000) * this.IO_PRICE_PER_MILLION;
      }

      const totalCost = computeCost + storageCost + ioCost;
      const version = isV2 ? 'v2' : 'v1';

      const assumptions = [
        `Aurora Serverless ${version}: ${avgACU} avg ACUs × $${rate.toFixed(2)}/ACU-hour × ${this.HOURS_PER_MONTH}h = $${computeCost.toFixed(2)}/month`,
        `Storage: ${storageGB} GB × $${this.STORAGE_PRICE_PER_GB}/GB = $${storageCost.toFixed(2)}/month`,
      ];

      if (isV2) {
        assumptions.push(`I/O: ${this.DEFAULT_MONTHLY_IO_REQUESTS / 1_000_000}M requests × $${this.IO_PRICE_PER_MILLION}/M = $${ioCost.toFixed(2)}/month`);
      }

      if (usedFallback) {
        assumptions.push(`Using fallback pricing (API data not available for region ${region})`);
      }

      assumptions.push(`ACU range: ${minACU}–${maxACU} (estimated average: ${avgACU})`);

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: usedFallback ? 'medium' : 'medium',
        assumptions,
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
