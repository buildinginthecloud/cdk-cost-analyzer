import { AnalyzeOptions, CostAnalysisResult } from './types';
import { DiffEngine } from '../diff/DiffEngine';
import { TemplateParser } from '../parser/TemplateParser';
import { PricingService } from '../pricing/PricingService';
import { Reporter } from '../reporter/Reporter';

export * from './types';
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
