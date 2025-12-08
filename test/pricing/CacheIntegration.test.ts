import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PricingClient } from '../../src/pricing/PricingClient';
import { CacheManager } from '../../src/pricing/CacheManager';
import { GetProductsCommand } from '@aws-sdk/client-pricing';
import * as fs from 'fs';

vi.mock('@aws-sdk/client-pricing');

describe('Cache Integration with PricingClient', () => {
  const testCacheDir = '.test-cache-integration';
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }

    vi.clearAllMocks();
    mockSend = vi.fn().mockResolvedValue({
      PriceList: [
        JSON.stringify({
          terms: {
            OnDemand: {
              'TERM_KEY': {
                priceDimensions: {
                  'DIM_KEY': {
                    pricePerUnit: {
                      USD: '0.10',
                    },
                  },
                },
              },
            },
          },
        }),
      ],
    });

    const { PricingClient: MockPricingClient } = await import('@aws-sdk/client-pricing');
    (MockPricingClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      send: mockSend,
    }));
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  it('should use cache to reduce API calls', async () => {
    const cacheManager = new CacheManager(testCacheDir, 24);
    const client = new PricingClient('us-east-1', cacheManager);

    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    // First call should hit the API
    const firstResult = await client.getPrice(params);
    expect(firstResult).toBe(0.10);
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Second call should use cache (no additional API call)
    const secondResult = await client.getPrice(params);
    expect(secondResult).toBe(0.10);
    expect(mockSend).toHaveBeenCalledTimes(1); // Still only 1 call

    // Verify cache was used
    expect(cacheManager.hasFreshCache(params)).toBe(true);
  });

  it('should persist cache across client instances', async () => {
    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    // First client instance
    const cacheManager1 = new CacheManager(testCacheDir, 24);
    const client1 = new PricingClient('us-east-1', cacheManager1);

    const firstResult = await client1.getPrice(params);
    expect(firstResult).toBe(0.10);
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Second client instance (simulating new pipeline run)
    const cacheManager2 = new CacheManager(testCacheDir, 24);
    const client2 = new PricingClient('us-east-1', cacheManager2);

    const secondResult = await client2.getPrice(params);
    expect(secondResult).toBe(0.10);
    expect(mockSend).toHaveBeenCalledTimes(1); // Still only 1 call - cache was used

    // Verify cache was loaded from disk
    expect(cacheManager2.hasFreshCache(params)).toBe(true);
  });

  it('should fall back to cache when API fails', async () => {
    const cacheManager = new CacheManager(testCacheDir, 24);
    const client = new PricingClient('us-east-1', cacheManager);

    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    // First call succeeds and populates cache
    const firstResult = await client.getPrice(params);
    expect(firstResult).toBe(0.10);

    // Simulate API failure
    mockSend.mockRejectedValue(new Error('API failure'));

    // Second call should use cached data despite API failure
    const secondResult = await client.getPrice(params);
    expect(secondResult).toBe(0.10);
  });

  it('should work without cache manager (backward compatibility)', async () => {
    // Client without cache manager should still work
    const client = new PricingClient('us-east-1');

    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    const result = await client.getPrice(params);
    expect(result).toBe(0.10);
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Second call should use in-memory cache
    const secondResult = await client.getPrice(params);
    expect(secondResult).toBe(0.10);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should respect cache duration configuration across client instances', async () => {
    // Create cache manager with very short duration (1ms)
    const cacheManager1 = new CacheManager(testCacheDir, 1 / (60 * 60 * 1000));
    const client1 = new PricingClient('us-east-1', cacheManager1);

    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    // First call
    await client1.getPrice(params);
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create new client instance (simulating new pipeline run)
    // This ensures we're not using in-memory cache
    const cacheManager2 = new CacheManager(testCacheDir, 1 / (60 * 60 * 1000));
    const client2 = new PricingClient('us-east-1', cacheManager2);

    // Second call should hit API again (cache expired)
    await client2.getPrice(params);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
