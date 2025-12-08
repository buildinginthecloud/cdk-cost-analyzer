export interface CostAnalyzerConfig {
  thresholds?: ThresholdConfig;
  usageAssumptions?: UsageAssumptionsConfig;
  synthesis?: SynthesisConfig;
  exclusions?: ExclusionsConfig;
  cache?: CacheConfig;
}

export interface ThresholdConfig {
  default?: ThresholdLevels;
  environments?: Record<string, ThresholdLevels>;
}

export interface ThresholdLevels {
  warning?: number;
  error?: number;
}

export interface UsageAssumptionsConfig {
  s3?: {
    storageGB?: number;
    getRequests?: number;
    putRequests?: number;
  };
  lambda?: {
    invocationsPerMonth?: number;
    averageDurationMs?: number;
  };
  natGateway?: {
    dataProcessedGB?: number;
  };
  alb?: {
    newConnectionsPerSecond?: number;
    activeConnectionsPerMinute?: number;
    processedBytesGB?: number;
  };
  nlb?: {
    newConnectionsPerSecond?: number;
    activeConnectionsPerMinute?: number;
    processedBytesGB?: number;
  };
  cloudfront?: {
    dataTransferGB?: number;
    requests?: number;
  };
  apiGateway?: {
    requestsPerMonth?: number;
  };
  vpcEndpoint?: {
    dataProcessedGB?: number;
  };
}

export interface SynthesisConfig {
  appPath?: string;
  outputPath?: string;
  customCommand?: string;
  context?: Record<string, string>;
}

export interface ExclusionsConfig {
  resourceTypes?: string[];
}

export interface CacheConfig {
  enabled?: boolean;
  durationHours?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public configPath: string,
    public validationErrors: string[]
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
