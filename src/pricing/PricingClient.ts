import { PricingClient as AWSPricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';
import { PricingClient as IPricingClient, PriceQueryParams, PricingAPIError } from './types';

export class PricingClient implements IPricingClient {
  private cache: Map<string, number> = new Map();
  private client: AWSPricingClient;

  constructor(region: string = 'us-east-1') {
    this.client = new AWSPricingClient({ region });
  }

  async getPrice(params: PriceQueryParams): Promise<number | null> {
    const cacheKey = this.getCacheKey(params);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const price = await this.fetchPriceWithRetry(params);
      if (price !== null) {
        this.cache.set(cacheKey, price);
      }
      return price;
    } catch (error) {
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
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
      false
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
