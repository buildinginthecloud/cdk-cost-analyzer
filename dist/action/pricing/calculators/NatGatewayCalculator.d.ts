import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class NatGatewayCalculator implements ResourceCostCalculator {
    private customDataProcessedGB?;
    private readonly DEFAULT_DATA_PROCESSED_GB;
    private readonly HOURS_PER_MONTH;
    constructor(customDataProcessedGB?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(_resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
