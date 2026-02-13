import { CostAnalyzerConfig, ValidationResult } from './types';
export declare class ConfigManager {
    private static readonly CONFIG_FILE_NAMES;
    /**
     * Load configuration from file or return default configuration
     */
    loadConfig(configPath?: string): Promise<CostAnalyzerConfig>;
    /**
     * Validate configuration structure and values
     */
    validateConfig(config: CostAnalyzerConfig): ValidationResult;
    /**
     * Resolve configuration file path using search order
     */
    private resolveConfigPath;
    /**
     * Read and parse configuration file (YAML or JSON)
     */
    private readConfigFile;
    /**
     * Check if file exists
     */
    private fileExists;
    /**
     * Validate threshold configuration
     */
    private validateThresholds;
    /**
     * Validate usage assumptions
     */
    private validateUsageAssumptions;
    /**
     * Get default configuration
     */
    private getDefaultConfig;
    /**
     * Merge user configuration with defaults
     */
    private mergeWithDefaults;
}
