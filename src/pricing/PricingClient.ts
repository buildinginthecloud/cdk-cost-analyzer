import { PricingClient as AWSPricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';
import { CacheManager } from './CacheManager';
import { PricingClient as IPricingClient, PriceQueryParams, PricingAPIError } from './types';

export class PricingClient implements IPricingClient {
  private cache: Map<string, number> = new Map();
  private client: AWSPricingClient;
  private cacheManager?: CacheManager;

  constructor(region: string = 'us-east-1', cacheManager?: CacheManager) {
    this.client = new AWSPricingClient({ region });
    this.cacheManager = cacheManager;
  }

  async getPrice(params: PriceQueryParams): Promise<number | null> {
    const cacheKey = this.getCacheKey(params);

    // Check in-memory cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check persistent cache if cache manager is available
    if (this.cacheManager) {
      const cachedPrice = this.cacheManager.getCachedPrice(params);
      if (cachedPrice !== null) {
        // Store in memory cache for faster subsequent access
        this.cache.set(cacheKey, cachedPrice);
        return cachedPrice;
      }
    }

    try {
      const price = await this.fetchPriceWithRetry(params);
      if (price !== null) {
        // Store in both memory and persistent cache
        this.cache.set(cacheKey, price);
        if (this.cacheManager) {
          this.cacheManager.setCachedPrice(params, price);
        }
      }
      return price;
    } catch (error) {
      // On API failure, try to use cached data even if stale
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }
      if (this.cacheManager) {
        const cachedPrice = this.cacheManager.getCachedPrice(params);
        if (cachedPrice !== null) {
          return cachedPrice;
        }
      }
      return null;
    }
  }

  private async fetchPriceWithRetry(params: PriceQueryParams, maxRetries: number = 3): Promise<number | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.fetchPrice(params);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new PricingAPIError(
      `Failed to fetch pricing after ${maxRetries} attempts: ${lastError?.message}`,
      false,
    );
  }

  private async fetchPrice(params: PriceQueryParams): Promise<number | null> {
    const filters = params.filters.map(f => ({
      Type: f.type || 'TERM_MATCH',
      Field: f.field,
      Value: f.value,
    }));

    const command = new GetProductsCommand({
      ServiceCode: params.serviceCode,
      Filters: filters,
      MaxResults: 1,
    });

    const response = await this.client.send(command);

    if (!response.PriceList || response.PriceList.length === 0) {
      return null;
    }

    const priceItem = JSON.parse(response.PriceList[0]);
    const onDemand = priceItem?.terms?.OnDemand;

    if (!onDemand) {
      return null;
    }

    const termKey = Object.keys(onDemand)[0];
    const priceDimensions = onDemand[termKey]?.priceDimensions;

    if (!priceDimensions) {
      return null;
    }

    const dimensionKey = Object.keys(priceDimensions)[0];
    const pricePerUnit = priceDimensions[dimensionKey]?.pricePerUnit?.USD;

    if (!pricePerUnit) {
      return null;
    }

    return parseFloat(pricePerUnit);
  }

  private getCacheKey(params: PriceQueryParams): string {
    const filterStr = params.filters
      .map(f => `${f.field}:${f.value}`)
      .sort()
      .join('|');
    return `${params.serviceCode}:${params.region}:${filterStr}`;
  }
}
