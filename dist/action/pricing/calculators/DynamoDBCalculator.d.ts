import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { CostAnalyzerConfig } from '../../config/types';
export declare class DynamoDBCalculator implements ResourceCostCalculator {
    private config?;
    constructor(config?: CostAnalyzerConfig);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private getUsageAssumptions;
    private calculateOnDemandCost;
    private calculateProvisionedCost;
}
