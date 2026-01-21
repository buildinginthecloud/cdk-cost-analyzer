import { AnalyzeOptions, CostAnalysisResult } from './types';
import { AnalyzeSingleTemplateOptions, SingleTemplateCostResult } from './single-template-types';
import { DiffEngine } from '../diff/DiffEngine';
import { TemplateParser } from '../parser/TemplateParser';
import { PricingService } from '../pricing/PricingService';
import { Reporter } from '../reporter/Reporter';
import { SingleTemplateReporter } from '../reporter/SingleTemplateReporter';
import { SingleTemplateAnalyzer } from '../analysis/SingleTemplateAnalyzer';

export * from './types';
export * from './single-template-types';
export { TemplateParseError } from '../parser/TemplateParser';
export { PricingAPIError, UnsupportedResourceError } from '../pricing/types';
export * from '../integrations';
export * from '../reporter/types';
export * from '../config';
export * from '../synthesis';
export * from '../threshold';
export * from '../pipeline';

export async function analyzeCosts(options: AnalyzeOptions): Promise<CostAnalysisResult> {
  const region = options.region || 'eu-central-1';
  const format = options.format || 'text';

  if (!options.baseTemplate || !options.targetTemplate) {
    throw new Error('Both baseTemplate and targetTemplate are required');
  }

  const parser = new TemplateParser();
  const diffEngine = new DiffEngine();
  const pricingService = new PricingService();
  const reporter = new Reporter();

  try {
    const baseTemplateObj = parser.parse(options.baseTemplate);
    const targetTemplateObj = parser.parse(options.targetTemplate);

    const diff = diffEngine.diff(baseTemplateObj, targetTemplateObj);

    const costDelta = await pricingService.getCostDelta(diff, region);

    const summary = reporter.generateReport(costDelta, format);

    return {
      totalDelta: costDelta.totalDelta,
      currency: costDelta.currency,
      addedResources: costDelta.addedCosts,
      removedResources: costDelta.removedCosts,
      modifiedResources: costDelta.modifiedCosts,
      summary,
    };
  } finally {
    // Clean up resources to prevent hanging connections
    pricingService.destroy();
  }
}

/**
 * Analyze a single CloudFormation template for estimated monthly costs
 * 
 * @param options - Configuration options including template content, region, format, and analysis config
 * @returns Promise resolving to detailed cost analysis result
 * 
 * @example
 * ```typescript
 * const result = await analyzeSingleTemplate({
 *   template: fs.readFileSync('template.json', 'utf-8'),
 *   region: 'us-east-1',
 *   format: 'text',
 *   config: {
 *     usageAssumptions: {
 *       lambda: { invocationsPerMonth: 1000000 }
 *     }
 *   }
 * });
 * console.log(result.summary);
 * ```
 */
export async function analyzeSingleTemplate(
  options: AnalyzeSingleTemplateOptions,
): Promise<SingleTemplateCostResult> {
  const region = options.region || 'eu-central-1';
  const format = options.format || 'text';

  if (!options.template) {
    throw new Error('Template content is required');
  }

  const analyzer = new SingleTemplateAnalyzer();
  const reporter = new SingleTemplateReporter();

  try {
    // Analyze the template
    const result = await analyzer.analyzeCosts(options.template, region, options.config);

    // Generate formatted summary using the reporter
    const summary = reporter.generateReport(result, format);

    return {
      ...result,
      summary,
    };
  } catch (error) {
    // Handle AWS credentials errors
    if (error instanceof Error && error.message.includes('Could not load credentials')) {
      throw new Error(
        'AWS credentials not configured. Please set AWS credentials using one of:\n' +
        '  - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables\n' +
        '  - AWS_PROFILE environment variable\n' +
        '  - AWS credentials file (~/.aws/credentials)\n' +
        '  - For CI/CD, configure AWS credentials in your pipeline',
      );
    }
    throw error;
  }
}

