import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class S3Calculator implements ResourceCostCalculator {
    private readonly DEFAULT_STORAGE_GB;
    supports(resourceType: string): boolean;
    calculateCost(_resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
