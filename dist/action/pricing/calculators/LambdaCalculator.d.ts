import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class LambdaCalculator implements ResourceCostCalculator {
    private readonly customInvocationsPerMonth?;
    private readonly customAverageDurationMs?;
    private readonly DEFAULT_INVOCATIONS;
    private readonly DEFAULT_DURATION_MS;
    private readonly DEFAULT_MEMORY_MB;
    private readonly FALLBACK_REQUEST_PRICE;
    private readonly FALLBACK_COMPUTE_PRICE;
    constructor(customInvocationsPerMonth?: number | undefined, customAverageDurationMs?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
