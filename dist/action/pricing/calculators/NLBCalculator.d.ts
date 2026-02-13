import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class NLBCalculator implements ResourceCostCalculator {
    private customNewConnectionsPerSecond?;
    private customActiveConnectionsPerMinute?;
    private customProcessedBytesGB?;
    private readonly DEFAULT_NEW_CONNECTIONS_PER_SECOND;
    private readonly DEFAULT_ACTIVE_CONNECTIONS_PER_MINUTE;
    private readonly DEFAULT_PROCESSED_BYTES_GB;
    private readonly HOURS_PER_MONTH;
    constructor(customNewConnectionsPerSecond?: number | undefined, customActiveConnectionsPerMinute?: number | undefined, customProcessedBytesGB?: number | undefined);
    supports(resourceType: string): boolean;
    canCalculate(resource: ResourceWithId): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
