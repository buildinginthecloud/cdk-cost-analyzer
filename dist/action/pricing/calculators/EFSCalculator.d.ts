import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export interface EFSUsageAssumptions {
    storageSizeGb?: number;
    infrequentAccessPercentage?: number;
}
export declare class EFSCalculator implements ResourceCostCalculator {
    private readonly customStorageSizeGb?;
    private readonly customInfrequentAccessPercentage?;
    private readonly DEFAULT_STORAGE_SIZE_GB;
    private readonly DEFAULT_IA_PERCENTAGE;
    private readonly FALLBACK_STANDARD_PRICE;
    private readonly FALLBACK_IA_STORAGE_PRICE;
    private readonly FALLBACK_IA_REQUEST_PRICE;
    private readonly FALLBACK_PROVISIONED_THROUGHPUT_PRICE;
    constructor(customStorageSizeGb?: number | undefined, customInfrequentAccessPercentage?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
