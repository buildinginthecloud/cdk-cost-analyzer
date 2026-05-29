import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class BatchCalculator implements ResourceCostCalculator {
    private readonly customHoursPerMonth?;
    private readonly DEFAULT_HOURS_PER_MONTH;
    private readonly FARGATE_VCPU_HOURLY;
    private readonly FARGATE_MEMORY_HOURLY;
    constructor(customHoursPerMonth?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, _region: string, _pricingClient: PricingClient): Promise<MonthlyCost>;
    private calculateJobDefinitionCost;
    private calculateComputeEnvironmentCost;
}
