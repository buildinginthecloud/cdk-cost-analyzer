import { PriceQueryParams } from './types';
export interface CachedPriceEntry {
    price: number;
    timestamp: number;
}
export interface CacheMetadata {
    entries: Record<string, CachedPriceEntry>;
}
/**
 * Manages persistent caching of pricing data to reduce AWS API calls
 * and improve performance across pipeline runs.
 */
export declare class CacheManager {
    private cacheDir;
    private cacheDurationMs;
    private metadata;
    private metadataPath;
    /**
     * Creates a new CacheManager instance
     * @param cacheDir Directory to store cache files (default: .cdk-cost-analyzer-cache)
     * @param cacheDurationHours Duration in hours before cache entries expire (default: 24)
     */
    constructor(cacheDir?: string, cacheDurationHours?: number);
    /**
     * Retrieves a cached price if it exists and is still fresh
     * @param params Price query parameters
     * @returns Cached price or null if not found or expired
     */
    getCachedPrice(params: PriceQueryParams): number | null;
    /**
     * Stores a price in the cache with current timestamp
     * @param params Price query parameters
     * @param price Price value to cache
     */
    setCachedPrice(params: PriceQueryParams, price: number): void;
    /**
     * Checks if a cached price exists and is still fresh
     * @param params Price query parameters
     * @returns true if fresh cache entry exists
     */
    hasFreshCache(params: PriceQueryParams): boolean;
    /**
     * Clears all cached entries
     */
    clearCache(): void;
    /**
     * Gets cache statistics
     * @returns Object with cache statistics
     */
    getCacheStats(): {
        totalEntries: number;
        freshEntries: number;
        staleEntries: number;
    };
    /**
     * Removes stale cache entries
     */
    pruneStaleEntries(): void;
    /**
     * Generates a cache key from price query parameters
     */
    private getCacheKey;
    /**
     * Ensures the cache directory exists
     */
    private ensureCacheDirectory;
    /**
     * Loads cache metadata from disk
     */
    private loadMetadata;
    /**
     * Saves cache metadata to disk
     */
    private saveMetadata;
}
