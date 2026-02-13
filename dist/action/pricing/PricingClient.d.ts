import { PricingClient as AWSPricingClient } from '@aws-sdk/client-pricing';
import { CacheManager } from './CacheManager';
import { PricingClient as IPricingClient, PriceQueryParams } from './types';
export declare class PricingClient implements IPricingClient {
    private cache;
    private client;
    private cacheManager?;
    constructor(region?: string, cacheManager?: CacheManager, awsClient?: AWSPricingClient);
    /**
     * Clean up resources and connections
     */
    destroy(): void;
    getPrice(params: PriceQueryParams): Promise<number | null>;
    private fetchPriceWithRetry;
    private fetchPrice;
    private getCacheKey;
}
