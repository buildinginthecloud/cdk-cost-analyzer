import * as fs from 'fs';
import * as path from 'path';
// Jest imports are global
import { CacheManager } from '../../src/pricing/CacheManager';

describe('CacheManager', () => {
  const testCacheDir = '.test-cache';
  let cacheManager: CacheManager;

  beforeEach(() => {
    // Clean up test cache directory before each test
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
    cacheManager = new CacheManager(testCacheDir, 24);
  });

  afterEach(() => {
    // Clean up test cache directory after each test
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('cache storage and retrieval', () => {
    it('should store and retrieve cached prices', () => {
      const params = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [
          { field: 'instanceType', value: 't3.micro' },
          { field: 'operatingSystem', value: 'Linux' },
        ],
      };

      // Store a price
      cacheManager.setCachedPrice(params, 0.0104);

      // Retrieve the price
      const cachedPrice = cacheManager.getCachedPrice(params);
      expect(cachedPrice).toBe(0.0104);
    });

    it('should return null for non-existent cache entries', () => {
      const params = {
        serviceCode: 'AmazonS3',
        region: 'us-west-2',
        filters: [{ field: 'storageClass', value: 'STANDARD' }],
      };

      const cachedPrice = cacheManager.getCachedPrice(params);
      expect(cachedPrice).toBeNull();
    });

    it('should handle multiple cache entries', () => {
      const params1 = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      const params2 = {
        serviceCode: 'AmazonS3',
        region: 'us-west-2',
        filters: [{ field: 'storageClass', value: 'STANDARD' }],
      };

      cacheManager.setCachedPrice(params1, 0.0104);
      cacheManager.setCachedPrice(params2, 0.023);

      expect(cacheManager.getCachedPrice(params1)).toBe(0.0104);
      expect(cacheManager.getCachedPrice(params2)).toBe(0.023);
    });
  });

  describe('cache freshness', () => {
    it('should return null for expired cache entries', () => {
      // Create cache manager with very short duration (1ms)
      const shortCacheManager = new CacheManager(testCacheDir, 1 / (60 * 60 * 1000));

      const params = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      shortCacheManager.setCachedPrice(params, 0.0104);

      // Wait for cache to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cachedPrice = shortCacheManager.getCachedPrice(params);
          expect(cachedPrice).toBeNull();
          resolve();
        }, 10);
      });
    });

    it('should correctly identify fresh cache entries', () => {
      const params = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      cacheManager.setCachedPrice(params, 0.0104);
      expect(cacheManager.hasFreshCache(params)).toBe(true);
    });

    it('should correctly identify missing cache entries', () => {
      const params = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      expect(cacheManager.hasFreshCache(params)).toBe(false);
    });
  });

  describe('cache persistence', () => {
    it('should persist cache to disk', () => {
      const params = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      cacheManager.setCachedPrice(params, 0.0104);

      // Verify metadata file exists
      const metadataPath = path.join(testCacheDir, 'metadata.json');
      expect(fs.existsSync(metadataPath)).toBe(true);

      // Create new cache manager instance to load from disk
      const newCacheManager = new CacheManager(testCacheDir, 24);
      const cachedPrice = newCacheManager.getCachedPrice(params);
      expect(cachedPrice).toBe(0.0104);
    });

    it('should handle corrupted metadata gracefully', () => {
      // Write corrupted metadata
      const metadataPath = path.join(testCacheDir, 'metadata.json');
      fs.mkdirSync(testCacheDir, { recursive: true });
      fs.writeFileSync(metadataPath, 'invalid json{', 'utf-8');

      // Should not throw, should start with empty cache
      const newCacheManager = new CacheManager(testCacheDir, 24);
      const params = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      expect(newCacheManager.getCachedPrice(params)).toBeNull();
    });
  });

  describe('cache management', () => {
    it('should clear all cache entries', () => {
      const params1 = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      const params2 = {
        serviceCode: 'AmazonS3',
        region: 'us-west-2',
        filters: [{ field: 'storageClass', value: 'STANDARD' }],
      };

      cacheManager.setCachedPrice(params1, 0.0104);
      cacheManager.setCachedPrice(params2, 0.023);

      cacheManager.clearCache();

      expect(cacheManager.getCachedPrice(params1)).toBeNull();
      expect(cacheManager.getCachedPrice(params2)).toBeNull();
    });

    it('should provide accurate cache statistics', () => {
      const params1 = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      const params2 = {
        serviceCode: 'AmazonS3',
        region: 'us-west-2',
        filters: [{ field: 'storageClass', value: 'STANDARD' }],
      };

      cacheManager.setCachedPrice(params1, 0.0104);
      cacheManager.setCachedPrice(params2, 0.023);

      const stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.freshEntries).toBe(2);
      expect(stats.staleEntries).toBe(0);
    });

    it('should prune stale entries', () => {
      // Create cache manager with very short duration
      const shortCacheManager = new CacheManager(testCacheDir, 1 / (60 * 60 * 1000));

      const params = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      shortCacheManager.setCachedPrice(params, 0.0104);

      // Wait for cache to become stale
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          shortCacheManager.pruneStaleEntries();
          const stats = shortCacheManager.getCacheStats();
          expect(stats.totalEntries).toBe(0);
          resolve();
        }, 10);
      });
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys for same parameters', () => {
      const params1 = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [
          { field: 'instanceType', value: 't3.micro' },
          { field: 'operatingSystem', value: 'Linux' },
        ],
      };

      const params2 = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'instanceType', value: 't3.micro' },
        ],
      };

      cacheManager.setCachedPrice(params1, 0.0104);

      // Should retrieve same price even with filters in different order
      const cachedPrice = cacheManager.getCachedPrice(params2);
      expect(cachedPrice).toBe(0.0104);
    });

    it('should generate different cache keys for different parameters', () => {
      const params1 = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.micro' }],
      };

      const params2 = {
        serviceCode: 'AmazonEC2',
        region: 'us-east-1',
        filters: [{ field: 'instanceType', value: 't3.small' }],
      };

      cacheManager.setCachedPrice(params1, 0.0104);

      // Should not retrieve price for different parameters
      const cachedPrice = cacheManager.getCachedPrice(params2);
      expect(cachedPrice).toBeNull();
    });
  });
});
