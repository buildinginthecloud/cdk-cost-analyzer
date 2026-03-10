import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class AuroraServerlessCalculator implements ResourceCostCalculator {
    private readonly customMinACU?;
    private readonly customMaxACU?;
    private readonly customStorageGB?;
    private readonly HOURS_PER_MONTH;
    private readonly DEFAULT_MIN_ACU;
    private readonly DEFAULT_MAX_ACU;
    private readonly DEFAULT_STORAGE_GB;
    private readonly DEFAULT_MONTHLY_IO_REQUESTS;
    private readonly FALLBACK_ACU_PRICE_V2;
    private readonly FALLBACK_ACU_PRICE_V1;
    private readonly STORAGE_PRICE_PER_GB;
    private readonly IO_PRICE_PER_MILLION;
    constructor(customMinACU?: number | undefined, customMaxACU?: number | undefined, customStorageGB?: number | undefined);
    supports(resourceType: string): boolean;
    canCalculate(resource: ResourceWithId): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
