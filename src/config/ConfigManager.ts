import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  CostAnalyzerConfig,
  ValidationResult,
  ConfigurationError,
  ThresholdLevels,
} from './types';

export class ConfigManager {
  private static readonly CONFIG_FILE_NAMES = [
    '.cdk-cost-analyzer.yml',
    '.cdk-cost-analyzer.yaml',
    '.cdk-cost-analyzer.json',
  ];

  /**
   * Load configuration from file or return default configuration
   */
  async loadConfig(configPath?: string): Promise<CostAnalyzerConfig> {
    try {
      const resolvedPath = await this.resolveConfigPath(configPath);

      if (!resolvedPath) {
        return this.getDefaultConfig();
      }

      const config = await this.readConfigFile(resolvedPath);
      const validation = this.validateConfig(config);

      if (!validation.valid) {
        throw new ConfigurationError(
          'Invalid configuration',
          resolvedPath,
          validation.errors,
        );
      }

      return this.mergeWithDefaults(config);
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
        configPath || 'unknown',
        [],
      );
    }
  }

  /**
   * Validate configuration structure and values
   */
  validateConfig(config: CostAnalyzerConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.thresholds) {
      this.validateThresholds(config.thresholds, errors, warnings);
    }

    if (config.usageAssumptions) {
      this.validateUsageAssumptions(config.usageAssumptions, errors);
    }

    if (config.cache?.durationHours !== undefined) {
      if (config.cache.durationHours <= 0) {
        errors.push('cache.durationHours must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Resolve configuration file path using search order
   */
  private async resolveConfigPath(configPath?: string): Promise<string | null> {
    if (configPath) {
      const exists = await this.fileExists(configPath);
      if (!exists) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      return configPath;
    }

    // Search in current directory
    for (const fileName of ConfigManager.CONFIG_FILE_NAMES) {
      const filePath = path.join(process.cwd(), fileName);
      if (await this.fileExists(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * Read and parse configuration file (YAML or JSON)
   */
  private async readConfigFile(filePath: string): Promise<CostAnalyzerConfig> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === '.json') {
        return JSON.parse(content);
      } else {
        return yaml.load(content) as CostAnalyzerConfig;
      }
    } catch (error) {
      throw new Error(
        `Failed to parse configuration file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate threshold configuration
   */
  private validateThresholds(
    thresholds: NonNullable<CostAnalyzerConfig['thresholds']>,
    errors: string[],
    warnings: string[],
  ): void {
    const validateLevels = (levels: ThresholdLevels, prefix: string) => {
      if (levels.warning !== undefined && levels.warning < 0) {
        errors.push(`${prefix}.warning must be non-negative`);
      }
      if (levels.error !== undefined && levels.error < 0) {
        errors.push(`${prefix}.error must be non-negative`);
      }
      if (
        levels.warning !== undefined &&
        levels.error !== undefined &&
        levels.warning > levels.error
      ) {
        warnings.push(
          `${prefix}.warning (${levels.warning}) is greater than ${prefix}.error (${levels.error})`,
        );
      }
    };

    if (thresholds.default) {
      validateLevels(thresholds.default, 'thresholds.default');
    }

    if (thresholds.environments) {
      for (const [env, levels] of Object.entries(thresholds.environments)) {
        validateLevels(levels, `thresholds.environments.${env}`);
      }
    }
  }

  /**
   * Validate usage assumptions
   */
  private validateUsageAssumptions(
    assumptions: NonNullable<CostAnalyzerConfig['usageAssumptions']>,
    errors: string[],
  ): void {
    const validatePositive = (value: number | undefined, configPath: string) => {
      if (value !== undefined && value < 0) {
        errors.push(`${configPath} must be non-negative`);
      }
    };

    if (assumptions.s3) {
      validatePositive(assumptions.s3.storageGB, 'usageAssumptions.s3.storageGB');
      validatePositive(assumptions.s3.getRequests, 'usageAssumptions.s3.getRequests');
      validatePositive(assumptions.s3.putRequests, 'usageAssumptions.s3.putRequests');
    }

    if (assumptions.lambda) {
      validatePositive(
        assumptions.lambda.invocationsPerMonth,
        'usageAssumptions.lambda.invocationsPerMonth',
      );
      validatePositive(
        assumptions.lambda.averageDurationMs,
        'usageAssumptions.lambda.averageDurationMs',
      );
    }

    if (assumptions.dynamodb) {
      validatePositive(
        assumptions.dynamodb.readRequestsPerMonth,
        'usageAssumptions.dynamodb.readRequestsPerMonth',
      );
      validatePositive(
        assumptions.dynamodb.writeRequestsPerMonth,
        'usageAssumptions.dynamodb.writeRequestsPerMonth',
      );
    }

    if (assumptions.natGateway) {
      validatePositive(
        assumptions.natGateway.dataProcessedGB,
        'usageAssumptions.natGateway.dataProcessedGB',
      );
    }

    if (assumptions.alb) {
      validatePositive(
        assumptions.alb.newConnectionsPerSecond,
        'usageAssumptions.alb.newConnectionsPerSecond',
      );
      validatePositive(
        assumptions.alb.activeConnectionsPerMinute,
        'usageAssumptions.alb.activeConnectionsPerMinute',
      );
      validatePositive(
        assumptions.alb.processedBytesGB,
        'usageAssumptions.alb.processedBytesGB',
      );
    }

    if (assumptions.nlb) {
      validatePositive(
        assumptions.nlb.newConnectionsPerSecond,
        'usageAssumptions.nlb.newConnectionsPerSecond',
      );
      validatePositive(
        assumptions.nlb.activeConnectionsPerMinute,
        'usageAssumptions.nlb.activeConnectionsPerMinute',
      );
      validatePositive(
        assumptions.nlb.processedBytesGB,
        'usageAssumptions.nlb.processedBytesGB',
      );
    }

    if (assumptions.cloudfront) {
      validatePositive(
        assumptions.cloudfront.dataTransferGB,
        'usageAssumptions.cloudfront.dataTransferGB',
      );
      validatePositive(
        assumptions.cloudfront.requests,
        'usageAssumptions.cloudfront.requests',
      );
    }

    if (assumptions.apiGateway) {
      validatePositive(
        assumptions.apiGateway.requestsPerMonth,
        'usageAssumptions.apiGateway.requestsPerMonth',
      );
    }

    if (assumptions.vpcEndpoint) {
      validatePositive(
        assumptions.vpcEndpoint.dataProcessedGB,
        'usageAssumptions.vpcEndpoint.dataProcessedGB',
      );
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): CostAnalyzerConfig {
    return {
      cache: {
        enabled: true,
        durationHours: 24,
      },
    };
  }

  /**
   * Merge user configuration with defaults
   */
  private mergeWithDefaults(config: CostAnalyzerConfig): CostAnalyzerConfig {
    const defaults = this.getDefaultConfig();
    return {
      ...defaults,
      ...config,
      cache: {
        ...defaults.cache,
        ...config.cache,
      },
    };
  }
}
