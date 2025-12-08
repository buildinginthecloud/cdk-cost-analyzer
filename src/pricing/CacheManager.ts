import * as fs from "fs";
import * as path from "path";
import { PriceQueryParams } from "./types";

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
export class CacheManager {
  private cacheDir: string;
  private cacheDurationMs: number;
  private metadata: CacheMetadata;
  private metadataPath: string;

  /**
   * Creates a new CacheManager instance
   * @param cacheDir Directory to store cache files (default: .cdk-cost-analyzer-cache)
   * @param cacheDurationHours Duration in hours before cache entries expire (default: 24)
   */
  constructor(
    cacheDir: string = ".cdk-cost-analyzer-cache",
    cacheDurationHours: number = 24,
  ) {
    this.cacheDir = cacheDir;
    this.cacheDurationMs = cacheDurationHours * 60 * 60 * 1000;
    this.metadataPath = path.join(this.cacheDir, "metadata.json");
    this.metadata = { entries: {} };
    this.ensureCacheDirectory();
    this.loadMetadata();
  }

  /**
   * Retrieves a cached price if it exists and is still fresh
   * @param params Price query parameters
   * @returns Cached price or null if not found or expired
   */
  getCachedPrice(params: PriceQueryParams): number | null {
    const cacheKey = this.getCacheKey(params);
    const entry = this.metadata.entries[cacheKey];

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > this.cacheDurationMs) {
      // Cache entry is stale
      delete this.metadata.entries[cacheKey];
      this.saveMetadata();
      return null;
    }

    return entry.price;
  }

  /**
   * Stores a price in the cache with current timestamp
   * @param params Price query parameters
   * @param price Price value to cache
   */
  setCachedPrice(params: PriceQueryParams, price: number): void {
    const cacheKey = this.getCacheKey(params);
    this.metadata.entries[cacheKey] = {
      price,
      timestamp: Date.now(),
    };
    this.saveMetadata();
  }

  /**
   * Checks if a cached price exists and is still fresh
   * @param params Price query parameters
   * @returns true if fresh cache entry exists
   */
  hasFreshCache(params: PriceQueryParams): boolean {
    return this.getCachedPrice(params) !== null;
  }

  /**
   * Clears all cached entries
   */
  clearCache(): void {
    this.metadata = { entries: {} };
    this.saveMetadata();
  }

  /**
   * Gets cache statistics
   * @returns Object with cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    freshEntries: number;
    staleEntries: number;
  } {
    const now = Date.now();
    let freshEntries = 0;
    let staleEntries = 0;

    for (const entry of Object.values(this.metadata.entries)) {
      const age = now - entry.timestamp;
      if (age <= this.cacheDurationMs) {
        freshEntries++;
      } else {
        staleEntries++;
      }
    }

    return {
      totalEntries: Object.keys(this.metadata.entries).length,
      freshEntries,
      staleEntries,
    };
  }

  /**
   * Removes stale cache entries
   */
  pruneStaleEntries(): void {
    const now = Date.now();
    const freshEntries: Record<string, CachedPriceEntry> = {};

    for (const [key, entry] of Object.entries(this.metadata.entries)) {
      const age = now - entry.timestamp;
      if (age <= this.cacheDurationMs) {
        freshEntries[key] = entry;
      }
    }

    this.metadata.entries = freshEntries;
    this.saveMetadata();
  }

  /**
   * Generates a cache key from price query parameters
   */
  private getCacheKey(params: PriceQueryParams): string {
    const filterStr = params.filters
      .map((f) => `${f.field}:${f.value}`)
      .sort()
      .join("|");
    return `${params.serviceCode}:${params.region}:${filterStr}`;
  }

  /**
   * Ensures the cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Loads cache metadata from disk
   */
  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const data = fs.readFileSync(this.metadataPath, "utf-8");
        this.metadata = JSON.parse(data);
      }
    } catch (error) {
      // If metadata is corrupted, start fresh
      this.metadata = { entries: {} };
    }
  }

  /**
   * Saves cache metadata to disk
   */
  private saveMetadata(): void {
    try {
      fs.writeFileSync(
        this.metadataPath,
        JSON.stringify(this.metadata, null, 2),
        "utf-8",
      );
    } catch (error) {
      // Silently fail if we can't write cache - not critical
      console.warn(
        `Failed to save cache metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
