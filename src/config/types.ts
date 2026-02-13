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
  /**
   * DynamoDB usage assumptions for on-demand (pay-per-request) billing mode.
   * These values are used to estimate monthly costs for DynamoDB tables
   * configured with BillingMode: PAY_PER_REQUEST.
   *
   * For provisioned billing mode, costs are calculated based on the
   * ReadCapacityUnits and WriteCapacityUnits specified in the template.
   *
   * @see https://aws.amazon.com/dynamodb/pricing/
   */
  dynamodb?: {
    /** Number of read requests per month (default: 10,000,000) */
    readRequestsPerMonth?: number;
    /** Number of write requests per month (default: 1,000,000) */
    writeRequestsPerMonth?: number;
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
  /**
   * EFS (Elastic File System) usage assumptions for cost estimation.
   * These values are used to estimate monthly costs for EFS file systems.
   *
   * @see https://aws.amazon.com/efs/pricing/
   */
  efs?: {
    /** Total storage size in GB (default: 100) */
    storageSizeGb?: number;
    /** Percentage of storage in Infrequent Access class (default: 0, range: 0-100) */
    infrequentAccessPercentage?: number;
  };
  /**
   * SNS (Simple Notification Service) usage assumptions.
   * These values are used to estimate monthly costs for SNS topics.
   *
   * @see https://aws.amazon.com/sns/pricing/
   */
  sns?: {
    /** Number of publish requests per month (default: 1,000,000) */
    monthlyPublishes?: number;
    /** Number of HTTP/S deliveries per month (default: 1,000,000) */
    httpDeliveries?: number;
    /** Number of email deliveries per month (default: 0) */
    emailDeliveries?: number;
    /** Number of SMS deliveries per month (default: 0) */
    smsDeliveries?: number;
    /** Number of mobile push deliveries per month (default: 0) */
    mobilePushDeliveries?: number;
  };
  /**
   * SQS usage assumptions for cost estimation.
   * Applies to both Standard and FIFO queues.
   *
   * @see https://aws.amazon.com/sqs/pricing/
   */
  sqs?: {
    /** Number of requests per month (default: 1,000,000) */
    monthlyRequests?: number;
  };
  /**
   * Step Functions usage assumptions for cost estimation.
   *
   * Standard workflows are charged per state transition.
   * Express workflows are charged per request and per GB-second of duration.
   *
   * @see https://aws.amazon.com/step-functions/pricing/
   */
  stepFunctions?: {
    /** Number of workflow executions per month (default: 10,000) */
    monthlyExecutions?: number;
    /** Number of state transitions per execution (default: 10, for Standard workflows) */
    stateTransitionsPerExecution?: number;
    /** Average execution duration in milliseconds (default: 1000, for Express workflows) */
    averageDurationMs?: number;
  };
  /**
   * Secrets Manager usage assumptions for cost estimation.
   *
   * @see https://aws.amazon.com/secrets-manager/pricing/
   */
  secretsManager?: {
    /** Number of API calls per month (default: 10,000) */
    monthlyApiCalls?: number;
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
    public validationErrors: string[],
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
