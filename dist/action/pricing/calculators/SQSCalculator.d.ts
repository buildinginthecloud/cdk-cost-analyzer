import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { CostAnalyzerConfig } from '../../config/types';
export declare class SQSCalculator implements ResourceCostCalculator {
    private readonly DEFAULT_MONTHLY_REQUESTS;
    private readonly FALLBACK_STANDARD_PRICE_PER_MILLION;
    private readonly FALLBACK_FIFO_PRICE_PER_MILLION;
    private config?;
    constructor(config?: CostAnalyzerConfig);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private isFifoQueue;
    private getMonthlyRequests;
    private buildAssumptions;
    private getPricePerMillion;
}
