import { AnalyzeOptions, CostAnalysisResult } from './types';
import { AnalyzeSingleTemplateOptions, SingleTemplateCostResult } from './single-template-types';
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
export declare function analyzeCosts(options: AnalyzeOptions): Promise<CostAnalysisResult>;
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
export declare function analyzeSingleTemplate(options: AnalyzeSingleTemplateOptions): Promise<SingleTemplateCostResult>;
