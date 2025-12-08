import { ConfigSummary } from '../pipeline/types';
import { CostDelta } from '../pricing/types';
import { ThresholdEvaluation } from '../threshold/types';

/**
 * Reporter interface for generating cost analysis reports in various formats.
 */
export interface Reporter {
  /**
   * Generate a cost analysis report.
   *
   * @param costDelta - The cost delta containing added, removed, and modified resources
   * @param format - The output format (text, json, or markdown)
   * @param options - Optional reporting options for enhanced reports
   * @returns Formatted report string
   */
  generateReport(
    costDelta: CostDelta,
    format: ReportFormat,
    options?: ReportOptions,
  ): string;
}

/**
 * Options for customizing report generation.
 *
 * These options enable enhanced reporting features including:
 * - Configuration summaries showing applied settings
 * - Threshold status with actionable guidance
 * - Multi-stack breakdowns for complex applications
 */
export interface ReportOptions {
  /**
   * Configuration summary to include in the report.
   * Shows thresholds, usage assumptions, and exclusions applied.
   */
  configSummary?: ConfigSummary;

  /**
   * Threshold evaluation status to include in the report.
   * Shows whether cost thresholds were exceeded and provides recommendations.
   */
  thresholdStatus?: ThresholdEvaluation;

  /**
   * Name of the stack being analyzed (for multi-stack reports).
   */
  stackName?: string;

  /**
   * Whether this is a multi-stack analysis.
   * When true, enables per-stack cost breakdowns in the report.
   */
  multiStack?: boolean;

  /**
   * Stack-level cost details for multi-stack reports.
   * Each entry contains the stack name and its cost delta.
   */
  stacks?: StackCostDelta[];
}

/**
 * Stack-level cost delta for multi-stack reporting.
 */
export interface StackCostDelta {
  /**
   * Name of the CloudFormation stack.
   */
  stackName: string;

  /**
   * Cost delta for this specific stack.
   */
  costDelta: CostDelta;
}

/**
 * Supported report output formats.
 *
 * - text: Human-readable console output with ASCII formatting
 * - json: Structured JSON for programmatic processing
 * - markdown: Formatted markdown suitable for GitLab merge request comments
 */
export type ReportFormat = 'text' | 'json' | 'markdown';
