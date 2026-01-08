import * as fs from 'fs';
// Jest imports are global
import { CacheManager } from '../../src/pricing/CacheManager';
import { PricingClient } from '../../src/pricing/PricingClient';

describe('Cache Integration with PricingClient', () => {
  const testCacheDir = '.test-cache-integration';
  let mockSend: jest.MockedFunction<any>;
  let mockAWSClient: any;

  beforeEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }

    mockSend = jest.fn() as jest.MockedFunction<any>;
    mockAWSClient = {
      send: mockSend,
    };

    mockSend.mockResolvedValue({
      PriceList: [
        JSON.stringify({
          terms: {
            OnDemand: {
              TERM_KEY: {
                priceDimensions: {
                  DIM_KEY: {
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
    } as any);
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  it('should use cache to reduce API calls', async () => {
    const cacheManager = new CacheManager(testCacheDir, 24);
    const client = new PricingClient('us-east-1', cacheManager, mockAWSClient);

    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    try {
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
    } finally {
      client.destroy();
    }
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

    let client1: PricingClient | undefined;
    let client2: PricingClient | undefined;

    try {
      // First client instance
      const cacheManager1 = new CacheManager(testCacheDir, 24);
      client1 = new PricingClient('us-east-1', cacheManager1, mockAWSClient);

      const firstResult = await client1.getPrice(params);
      expect(firstResult).toBe(0.10);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second client instance (simulating new pipeline run)
      const cacheManager2 = new CacheManager(testCacheDir, 24);
      client2 = new PricingClient('us-east-1', cacheManager2, mockAWSClient);

      const secondResult = await client2.getPrice(params);
      expect(secondResult).toBe(0.10);
      expect(mockSend).toHaveBeenCalledTimes(1); // Still only 1 call - cache was used

      // Verify cache was loaded from disk
      expect(cacheManager2.hasFreshCache(params)).toBe(true);
    } finally {
      client1?.destroy();
      client2?.destroy();
    }
  });

  it('should fall back to cache when API fails', async () => {
    const cacheManager = new CacheManager(testCacheDir, 24);
    const client = new PricingClient('us-east-1', cacheManager, mockAWSClient);

    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    try {
      // First call succeeds and populates cache
      const firstResult = await client.getPrice(params);
      expect(firstResult).toBe(0.10);

      // Simulate API failure
      mockSend.mockRejectedValue(new Error('API failure') as any);

      // Second call should use cached data despite API failure
      const secondResult = await client.getPrice(params);
      expect(secondResult).toBe(0.10);
    } finally {
      client.destroy();
    }
  });

  it('should work without cache manager (backward compatibility)', async () => {
    // Client without cache manager should still work
    const client = new PricingClient('us-east-1', undefined, mockAWSClient);

    const params = {
      serviceCode: 'AmazonEC2',
      region: 'us-east-1',
      filters: [
        { field: 'instanceType', value: 't3.micro' },
        { field: 'operatingSystem', value: 'Linux' },
      ],
    };

    try {
      const result = await client.getPrice(params);
      expect(result).toBe(0.10);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call should use in-memory cache
      const secondResult = await client.getPrice(params);
      expect(secondResult).toBe(0.10);
      expect(mockSend).toHaveBeenCalledTimes(1);
    } finally {
      client.destroy();
    }
  });

  it('should respect cache duration configuration across client instances', async () => {
    // Create cache manager with very short duration (1ms)
    const cacheManager1 = new CacheManager(testCacheDir, 1 / (60 * 60 * 1000));
    const client1 = new PricingClient('us-east-1', cacheManager1, mockAWSClient);

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

    // Wait for cache to expire with a more reliable approach
    await new Promise(resolve => setTimeout(resolve, 50));

    // Create new client instance (simulating new pipeline run)
    // This ensures we're not using in-memory cache
    const cacheManager2 = new CacheManager(testCacheDir, 1 / (60 * 60 * 1000));
    const client2 = new PricingClient('us-east-1', cacheManager2, mockAWSClient);

    // Second call should hit API again (cache expired)
    await client2.getPrice(params);
    expect(mockSend).toHaveBeenCalledTimes(2);

    // Clean up clients
    client1.destroy();
    client2.destroy();
  }, 10000); // Increase timeout for CI environment
});
