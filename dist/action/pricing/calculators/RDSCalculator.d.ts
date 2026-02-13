import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class RDSCalculator implements ResourceCostCalculator {
    private readonly DEFAULT_STORAGE_GB;
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private normalizeEngine;
}
