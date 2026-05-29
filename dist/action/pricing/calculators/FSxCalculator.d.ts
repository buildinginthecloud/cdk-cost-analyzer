import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class FSxCalculator implements ResourceCostCalculator {
    private readonly customStorageGB?;
    constructor(customStorageGB?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, _region: string, _pricingClient: PricingClient): Promise<MonthlyCost>;
}
