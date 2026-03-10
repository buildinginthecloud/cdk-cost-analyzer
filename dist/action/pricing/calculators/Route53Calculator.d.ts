import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class Route53Calculator implements ResourceCostCalculator {
    private readonly customMonthlyQueries?;
    private readonly HOSTED_ZONE_PRICE;
    private readonly BASIC_HEALTH_CHECK_PRICE;
    private readonly HTTPS_HEALTH_CHECK_PRICE;
    private readonly STANDARD_QUERY_PRICE_PER_MILLION;
    private readonly LATENCY_QUERY_PRICE_PER_MILLION;
    private readonly GEO_QUERY_PRICE_PER_MILLION;
    private readonly DEFAULT_MONTHLY_QUERIES;
    constructor(customMonthlyQueries?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, _region: string, _pricingClient: PricingClient): Promise<MonthlyCost>;
    private calculateHostedZoneCost;
    private calculateHealthCheckCost;
    private calculateRecordSetCost;
}
