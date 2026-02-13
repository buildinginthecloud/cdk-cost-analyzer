import { PricingClient } from './PricingClient';
import { PricingService as IPricingService, MonthlyCost, CostDelta } from './types';
import { UsageAssumptionsConfig, CacheConfig } from '../config/types';
import { ResourceWithId, ResourceDiff } from '../diff/types';
export declare class PricingService implements IPricingService {
    private calculators;
    private pricingClient;
    private excludedResourceTypes;
    constructor(region?: string, usageAssumptions?: UsageAssumptionsConfig, excludedResourceTypes?: string[], cacheConfig?: CacheConfig, pricingClient?: PricingClient);
    getResourceCost(resource: ResourceWithId, region: string, templateResources?: ResourceWithId[]): Promise<MonthlyCost>;
    getCostDelta(diff: ResourceDiff, region: string): Promise<CostDelta>;
    /**
     * Clean up resources and connections
     */
    destroy(): void;
}
