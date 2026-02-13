import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
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
export declare class SecretsManagerCalculator implements ResourceCostCalculator {
    private readonly customMonthlyApiCalls?;
    private readonly DEFAULT_MONTHLY_API_CALLS;
    private readonly FALLBACK_SECRET_STORAGE_PRICE;
    private readonly FALLBACK_API_CALL_PRICE_PER_10K;
    constructor(customMonthlyApiCalls?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
