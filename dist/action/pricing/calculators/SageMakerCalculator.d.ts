import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class SageMakerCalculator implements ResourceCostCalculator {
    private readonly customHoursPerMonth?;
    private readonly FALLBACK_ENDPOINT_HOURLY;
    private readonly FALLBACK_NOTEBOOK_HOURLY;
    constructor(customHoursPerMonth?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private calculateEndpointCost;
    private calculateNotebookCost;
}
