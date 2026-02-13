/**
 * Debug logger for pricing API operations
 * Outputs to stderr to avoid interfering with JSON output
 */
export declare class Logger {
    private static debugEnabled;
    /**
     * Enable or disable debug logging
     */
    static setDebugEnabled(enabled: boolean): void;
    /**
     * Check if debug logging is enabled
     */
    static isDebugEnabled(): boolean;
    /**
     * Log debug information to stderr
     */
    static debug(message: string, data?: any): void;
    /**
     * Log pricing API query information
     */
    static logPricingQuery(serviceCode: string, region: string, filters: any[]): void;
    /**
     * Log pricing API response information
     */
    static logPricingResponse(serviceCode: string, region: string, price: number | null, productDetails?: any): void;
    /**
     * Log region normalization
     */
    static logRegionNormalization(originalRegion: string, normalizedRegion: string): void;
    /**
     * Log pricing lookup failure
     */
    static logPricingFailure(serviceCode: string, region: string, reason: string): void;
    /**
     * Log cache hit/miss
     */
    static logCacheStatus(cacheKey: string, hit: boolean, source?: 'memory' | 'persistent'): void;
}
