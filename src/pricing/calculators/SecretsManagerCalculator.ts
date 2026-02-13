import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';
import { Logger } from '../../utils/Logger';

/**
 * Calculator for AWS::SecretsManager::Secret resources.
 *
 * AWS Secrets Manager Pricing Model (as of 2024):
 * - Secret storage: $0.40 per secret per month
 * - API calls: $0.05 per 10,000 API calls
 * - No free tier
 *
 * @see https://aws.amazon.com/secrets-manager/pricing/
 */
export class SecretsManagerCalculator implements ResourceCostCalculator {
  // Default usage assumptions
  private readonly DEFAULT_MONTHLY_API_CALLS = 10_000;

  // Fallback pricing (AWS Secrets Manager pricing as of 2024)
  private readonly FALLBACK_SECRET_STORAGE_PRICE = 0.40; // Per secret per month
  private readonly FALLBACK_API_CALL_PRICE_PER_10K = 0.05;

  constructor(private readonly customMonthlyApiCalls?: number) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::SecretsManager::Secret';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const monthlyApiCalls = this.customMonthlyApiCalls ?? this.DEFAULT_MONTHLY_API_CALLS;

    Logger.debug('Secrets Manager pricing calculation started', {
      region,
      logicalId: resource.logicalId,
      monthlyApiCalls,
    });

    try {
      const normalizedRegion = normalizeRegion(region);

      // Query pricing for secret storage (per secret monthly cost)
      const secretStoragePrice = await pricingClient.getPrice({
        serviceCode: 'AWSSecretsManager',
        region: normalizedRegion,
        filters: [
          { field: 'productFamily', value: 'Secret' },
          { field: 'group', value: 'SecretStorage' },
        ],
      });

      Logger.debug('Secrets Manager storage price retrieved', {
        secretStoragePrice,
        region: normalizedRegion,
      });

      // Query pricing for API calls
      const apiCallPrice = await pricingClient.getPrice({
        serviceCode: 'AWSSecretsManager',
        region: normalizedRegion,
        filters: [
          { field: 'productFamily', value: 'Secret' },
          { field: 'group', value: 'SecretRotation' },
        ],
      });

      Logger.debug('Secrets Manager API call price retrieved', {
        apiCallPrice,
        region: normalizedRegion,
      });

      // If pricing data is completely unavailable
      if (secretStoragePrice === null && apiCallPrice === null) {
        Logger.debug('Secrets Manager pricing not available', {
          region,
          normalizedRegion,
        });

        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for Secrets Manager in region ${region}`,
            `Would assume ${monthlyApiCalls.toLocaleString()} API calls per month`,
          ],
        };
      }

      // Handle pricing unavailability with fallback
      const storageCost = secretStoragePrice ?? this.FALLBACK_SECRET_STORAGE_PRICE;
      const callCostPer10K = apiCallPrice ?? this.FALLBACK_API_CALL_PRICE_PER_10K;

      const apiCallCost = (monthlyApiCalls / 10_000) * callCostPer10K;
      const totalCost = storageCost + apiCallCost;

      const confidence = (secretStoragePrice === null || apiCallPrice === null) ? 'low' : 'medium';
      const usedFallback = (secretStoragePrice === null || apiCallPrice === null);

      Logger.debug('Secrets Manager cost calculated', {
        storageCost,
        callCostPer10K,
        apiCallCost,
        totalCost,
        confidence,
        usedFallback,
      });

      const assumptions: string[] = [];

      // Add fallback warning first if used
      if (usedFallback) {
        if (secretStoragePrice === null) {
          assumptions.push('Using fallback storage pricing (API unavailable)');
        }
        if (apiCallPrice === null) {
          assumptions.push('Using fallback API call pricing (API unavailable)');
        }
      }

      // Add cost breakdown
      assumptions.push(`Secret storage: $${storageCost.toFixed(2)}/month`);
      assumptions.push(
        `API calls: ${monthlyApiCalls.toLocaleString()} calls × $${callCostPer10K.toFixed(4)}/10K = $${apiCallCost.toFixed(2)}/month`,
      );
      assumptions.push(`Total: $${totalCost.toFixed(2)}/month`);

      // Add custom assumption note
      if (this.customMonthlyApiCalls !== undefined) {
        assumptions.push('Using custom API call volume from configuration');
      }

      // Add informational notes
      assumptions.push('No free tier for Secrets Manager');
      assumptions.push('Cross-region replication incurs additional costs (not calculated)');

      return {
        amount: totalCost,
        currency: 'USD',
        confidence,
        assumptions,
      };
    } catch (error) {
      Logger.debug('Secrets Manager pricing calculation failed', {
        error: error instanceof Error ? error.message : String(error),
        region,
      });

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to calculate Secrets Manager cost: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
}
