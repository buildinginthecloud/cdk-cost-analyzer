import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';
import { Logger } from '../../utils/Logger';

export interface EFSUsageAssumptions {
  storageSizeGb?: number;
  infrequentAccessPercentage?: number;
}

export class EFSCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_STORAGE_SIZE_GB = 100;
  private readonly DEFAULT_IA_PERCENTAGE = 0;
  
  // Fallback pricing rates (AWS EFS us-east-1 pricing as of 2024)
  private readonly FALLBACK_STANDARD_PRICE = 0.30; // Per GB-month
  private readonly FALLBACK_IA_STORAGE_PRICE = 0.016; // Per GB-month
  private readonly FALLBACK_IA_REQUEST_PRICE = 0.01; // Per GB transferred
  private readonly FALLBACK_PROVISIONED_THROUGHPUT_PRICE = 6.00; // Per MB/s-month

  constructor(
    private readonly customStorageSizeGb?: number,
    private readonly customInfrequentAccessPercentage?: number,
  ) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::EFS::FileSystem';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const regionPrefix = getRegionPrefix(region);
      const storageSizeGb = this.customStorageSizeGb ?? this.DEFAULT_STORAGE_SIZE_GB;
      const iaPercentage = this.customInfrequentAccessPercentage ?? this.DEFAULT_IA_PERCENTAGE;

      Logger.debug('EFS pricing calculation started', {
        region,
        regionPrefix,
        normalizedRegion: normalizeRegion(region),
        storageSizeGb,
        iaPercentage,
      });

      // Check for lifecycle policies to determine if IA storage is used
      const lifecyclePolicies = resource.properties?.LifecyclePolicies as Array<{ TransitionToIA?: string }> | undefined;
      const hasIATransition = lifecyclePolicies?.some(policy => policy.TransitionToIA !== undefined) ?? false;

      // Check for provisioned throughput
      const throughputMode = resource.properties?.ThroughputMode as string | undefined;
      const provisionedThroughputInMibps = resource.properties?.ProvisionedThroughputInMibps as number | undefined;
      const isProvisionedThroughput = throughputMode === 'provisioned' && provisionedThroughputInMibps !== undefined;

      // Calculate storage distribution
      const effectiveIAPercentage = hasIATransition ? iaPercentage : 0;
      const standardStorageGb = storageSizeGb * (1 - effectiveIAPercentage / 100);
      const iaStorageGb = storageSizeGb * (effectiveIAPercentage / 100);

      // Get Standard storage pricing
      const standardStoragePrice = await pricingClient.getPrice({
        serviceCode: 'AmazonEFS',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Storage' },
          { field: 'usagetype', value: `${regionPrefix}-TimedStorage-ByteHrs` },
        ],
      });

      Logger.debug('EFS Standard storage price retrieved', {
        standardStoragePrice,
        usageType: `${regionPrefix}-TimedStorage-ByteHrs`,
      });

      // Get Infrequent Access storage pricing
      let iaStoragePrice: number | null = null;
      let iaRequestPrice: number | null = null;
      if (hasIATransition && iaPercentage > 0) {
        iaStoragePrice = await pricingClient.getPrice({
          serviceCode: 'AmazonEFS',
          region: normalizeRegion(region),
          filters: [
            { field: 'productFamily', value: 'Storage' },
            { field: 'usagetype', value: `${regionPrefix}-IATimedStorage-ByteHrs` },
          ],
        });

        iaRequestPrice = await pricingClient.getPrice({
          serviceCode: 'AmazonEFS',
          region: normalizeRegion(region),
          filters: [
            { field: 'productFamily', value: 'Storage' },
            { field: 'usagetype', value: `${regionPrefix}-IARequests-Bytes` },
          ],
        });

        Logger.debug('EFS IA storage prices retrieved', {
          iaStoragePrice,
          iaRequestPrice,
        });
      }

      // Get Provisioned Throughput pricing
      let provisionedThroughputPrice: number | null = null;
      if (isProvisionedThroughput) {
        provisionedThroughputPrice = await pricingClient.getPrice({
          serviceCode: 'AmazonEFS',
          region: normalizeRegion(region),
          filters: [
            { field: 'productFamily', value: 'Provisioned Throughput' },
            { field: 'usagetype', value: `${regionPrefix}-ProvisionedTP-MiBpsHrs` },
          ],
        });

        Logger.debug('EFS Provisioned Throughput price retrieved', {
          provisionedThroughputPrice,
          usageType: `${regionPrefix}-ProvisionedTP-MiBpsHrs`,
        });
      }

      const assumptions: string[] = [];
      let totalCost = 0;
      let confidence: 'high' | 'medium' | 'low' | 'unknown' = 'medium';

      // Calculate standard storage cost
      const effectiveStandardPrice = standardStoragePrice ?? this.FALLBACK_STANDARD_PRICE;
      const standardStorageCost = standardStorageGb * effectiveStandardPrice;
      if (standardStoragePrice === null) {
        assumptions.push('Using fallback Standard storage pricing (API unavailable)');
        confidence = 'low';
      }
      totalCost += standardStorageCost;
      assumptions.push(`Standard storage: ${standardStorageGb.toFixed(2)} GB × $${effectiveStandardPrice.toFixed(4)}/GB = $${standardStorageCost.toFixed(2)}/month`);

      // Calculate IA storage cost
      if (hasIATransition && iaPercentage > 0) {
        const effectiveIAStoragePrice = iaStoragePrice ?? this.FALLBACK_IA_STORAGE_PRICE;
        const iaStorageCost = iaStorageGb * effectiveIAStoragePrice;
        if (iaStoragePrice === null) {
          assumptions.push('Using fallback Infrequent Access storage pricing (API unavailable)');
          confidence = 'low';
        }
        totalCost += iaStorageCost;
        assumptions.push(`Infrequent Access storage: ${iaStorageGb.toFixed(2)} GB × $${effectiveIAStoragePrice.toFixed(4)}/GB = $${iaStorageCost.toFixed(2)}/month`);

        // Estimate IA request cost (assume 10% of IA data is accessed per month)
        const estimatedIAAccessGb = iaStorageGb * 0.10;
        const effectiveIARequestPrice = iaRequestPrice ?? this.FALLBACK_IA_REQUEST_PRICE;
        const iaRequestCost = estimatedIAAccessGb * effectiveIARequestPrice;
        if (iaRequestPrice === null && iaPercentage > 0) {
          assumptions.push('Using fallback Infrequent Access request pricing (API unavailable)');
          confidence = 'low';
        }
        totalCost += iaRequestCost;
        assumptions.push(`IA requests (estimated 10% access): ${estimatedIAAccessGb.toFixed(2)} GB × $${effectiveIARequestPrice.toFixed(4)}/GB = $${iaRequestCost.toFixed(2)}/month`);
      }

      // Calculate provisioned throughput cost
      if (isProvisionedThroughput && provisionedThroughputInMibps !== undefined) {
        const effectiveProvisionedPrice = provisionedThroughputPrice ?? this.FALLBACK_PROVISIONED_THROUGHPUT_PRICE;
        const provisionedCost = provisionedThroughputInMibps * effectiveProvisionedPrice;
        if (provisionedThroughputPrice === null) {
          assumptions.push('Using fallback Provisioned Throughput pricing (API unavailable)');
          confidence = 'low';
        }
        totalCost += provisionedCost;
        assumptions.push(`Provisioned Throughput: ${provisionedThroughputInMibps} MB/s × $${effectiveProvisionedPrice.toFixed(2)}/MB/s = $${provisionedCost.toFixed(2)}/month`);
      }

      // Add summary assumptions
      assumptions.push(`Total storage: ${storageSizeGb} GB`);
      if (this.customStorageSizeGb !== undefined) {
        assumptions.push('Using custom storage size assumption from configuration');
      }
      if (hasIATransition) {
        assumptions.push(`Lifecycle policy detected: ${effectiveIAPercentage}% in Infrequent Access`);
        if (this.customInfrequentAccessPercentage !== undefined) {
          assumptions.push('Using custom IA percentage assumption from configuration');
        }
      }
      if (throughputMode) {
        assumptions.push(`Throughput mode: ${throughputMode}`);
      }

      assumptions.push(`Total: $${totalCost.toFixed(2)}/month`);

      Logger.debug('EFS cost calculated', {
        standardStorageCost,
        totalCost,
        confidence,
      });

      return {
        amount: totalCost,
        currency: 'USD',
        confidence,
        assumptions,
      };
    } catch (error) {
      Logger.debug('EFS pricing calculation failed', {
        error: error instanceof Error ? error.message : String(error),
        region,
      });

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
}
