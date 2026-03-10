import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class EKSCalculator implements ResourceCostCalculator {
    private readonly HOURS_PER_MONTH;
    private readonly FALLBACK_CONTROL_PLANE_HOURLY;
    supports(resourceType: string): boolean;
    calculateCost(_resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
