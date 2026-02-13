import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class AutoScalingGroupCalculator implements ResourceCostCalculator {
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient, templateResources?: ResourceWithId[]): Promise<MonthlyCost>;
    private resolveInstanceType;
    private resolveInstanceTypeFromLaunchTemplate;
    private resolveReference;
}
