/**
 * Debug logger for pricing API operations
 * Outputs to stderr to avoid interfering with JSON output
 */
export class Logger {
  private static debugEnabled = false;

  /**
   * Enable or disable debug logging
   */
  static setDebugEnabled(enabled: boolean): void {
    Logger.debugEnabled = enabled;
  }

  /**
   * Check if debug logging is enabled
   */
  static isDebugEnabled(): boolean {
    return Logger.debugEnabled;
  }

  /**
   * Log debug information to stderr
   */
  static debug(message: string, data?: any): void {
    if (Logger.debugEnabled) {
      const timestamp = new Date().toISOString();
      console.error(`[DEBUG ${timestamp}] ${message}`);
      if (data !== undefined) {
        console.error(JSON.stringify(data, null, 2));
      }
    }
  }

  /**
   * Log pricing API query information
   */
  static logPricingQuery(serviceCode: string, region: string, filters: any[]): void {
    if (Logger.debugEnabled) {
      Logger.debug('Pricing API Query', {
        serviceCode,
        region,
        filters: filters.map(f => ({
          field: f.field,
          value: f.value,
          type: f.type || 'TERM_MATCH',
        })),
      });
    }
  }

  /**
   * Log pricing API response information
   */
  static logPricingResponse(serviceCode: string, region: string, price: number | null, productDetails?: any): void {
    if (Logger.debugEnabled) {
      Logger.debug('Pricing API Response', {
        serviceCode,
        region,
        price,
        productDetails,
      });
    }
  }

  /**
   * Log region normalization
   */
  static logRegionNormalization(originalRegion: string, normalizedRegion: string): void {
    if (Logger.debugEnabled) {
      Logger.debug('Region Normalization', {
        originalRegion,
        normalizedRegion,
        wasNormalized: originalRegion !== normalizedRegion,
      });
    }
  }

  /**
   * Log pricing lookup failure
   */
  static logPricingFailure(serviceCode: string, region: string, reason: string): void {
    if (Logger.debugEnabled) {
      Logger.debug('Pricing Lookup Failed', {
        serviceCode,
        region,
        reason,
      });
    }
  }

  /**
   * Log cache hit/miss
   */
  static logCacheStatus(cacheKey: string, hit: boolean, source?: 'memory' | 'persistent'): void {
    if (Logger.debugEnabled) {
      Logger.debug(`Cache ${hit ? 'HIT' : 'MISS'}`, {
        cacheKey,
        source: hit ? source : undefined,
      });
    }
  }
}
