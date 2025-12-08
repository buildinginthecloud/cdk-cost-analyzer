import * as fs from 'fs/promises';
import { ConfigManager } from '../config/ConfigManager';
import { SynthesisOrchestrator } from '../synthesis/SynthesisOrchestrator';
import { ThresholdEnforcer } from '../threshold/ThresholdEnforcer';
import { TemplateParser } from '../parser/TemplateParser';
import { DiffEngine } from '../diff/DiffEngine';
import { PricingService } from '../pricing/PricingService';
import { Reporter } from '../reporter/Reporter';
import { PipelineOptions, PipelineResult, PipelineError, ConfigSummary } from './types';

export class PipelineOrchestrator {
  private configManager: ConfigManager;
  private synthesisOrchestrator: SynthesisOrchestrator;
  private thresholdEnforcer: ThresholdEnforcer;

  constructor() {
    this.configManager = new ConfigManager();
    this.synthesisOrchestrator = new SynthesisOrchestrator();
    this.thresholdEnforcer = new ThresholdEnforcer();
  }

  /**
   * Run complete pipeline analysis
   */
  async runPipelineAnalysis(options: PipelineOptions): Promise<PipelineResult> {
    try {
      // 1. Load configuration
      const config = await this.configManager.loadConfig(options.configPath);

      // 2. Determine template paths
      let baseTemplatePath: string;
      let targetTemplatePath: string;
      let synthesisInfo;

      if (options.synthesize && options.cdkAppPath) {
        // Synthesize both branches
        const synthResult = await this.synthesizeBothBranches(options.cdkAppPath, config);
        baseTemplatePath = synthResult.baseTemplatePath;
        targetTemplatePath = synthResult.targetTemplatePath;
        synthesisInfo = synthResult.synthesisInfo;
      } else {
        // Use provided template paths
        if (!options.baseTemplate || !options.targetTemplate) {
          throw new PipelineError(
            'Either provide template paths or enable synthesis with cdkAppPath',
            'configuration'
          );
        }
        baseTemplatePath = options.baseTemplate;
        targetTemplatePath = options.targetTemplate;
      }

      // 3. Analyze costs
      const region = options.region || config.synthesis?.context?.region || 'eu-central-1';
      const costAnalysis = await this.analyzeCosts(
        baseTemplatePath,
        targetTemplatePath,
        region,
        config
      );

      // 4. Evaluate thresholds
      const thresholdStatus = this.thresholdEnforcer.evaluateThreshold(
        costAnalysis.totalDelta,
        costAnalysis.addedResources,
        costAnalysis.modifiedResources,
        config.thresholds,
        options.environment
      );

      // 5. Build config summary
      const configSummary = this.buildConfigSummary(config, options);

      return {
        costAnalysis,
        thresholdStatus,
        synthesisInfo,
        configUsed: configSummary,
      };
    } catch (error) {
      if (error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError(
        `Pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
        'unknown'
      );
    }
  }

  /**
   * Synthesize both base and target branches
   */
  private async synthesizeBothBranches(
    cdkAppPath: string,
    config: any
  ): Promise<{
    baseTemplatePath: string;
    targetTemplatePath: string;
    synthesisInfo: any;
  }> {
    // For now, just synthesize the current branch
    // In a full implementation, this would checkout branches and synthesize each
    const result = await this.synthesisOrchestrator.synthesize({
      cdkAppPath,
      outputPath: config.synthesis?.outputPath,
      context: config.synthesis?.context,
      customCommand: config.synthesis?.customCommand,
    });

    if (!result.success) {
      throw new PipelineError(
        `CDK synthesis failed: ${result.error}`,
        'synthesis'
      );
    }

    // For simplicity, use the first template for both base and target
    // In production, you'd synthesize different branches
    return {
      baseTemplatePath: result.templatePaths[0],
      targetTemplatePath: result.templatePaths[0],
      synthesisInfo: {
        baseStackCount: result.stackNames.length,
        targetStackCount: result.stackNames.length,
        baseSynthesisTime: result.duration,
        targetSynthesisTime: result.duration,
      },
    };
  }

  /**
   * Analyze costs between two templates
   */
  private async analyzeCosts(
    baseTemplatePath: string,
    targetTemplatePath: string,
    region: string,
    config: any
  ): Promise<any> {
    const parser = new TemplateParser();
    const diffEngine = new DiffEngine();
    const pricingService = new PricingService(
      region,
      config.usageAssumptions,
      config.exclusions?.resourceTypes,
      config.cache
    );
    const reporter = new Reporter();

    // Read templates
    const baseTemplateContent = await fs.readFile(baseTemplatePath, 'utf-8');
    const targetTemplateContent = await fs.readFile(targetTemplatePath, 'utf-8');

    // Parse templates
    const baseTemplateObj = parser.parse(baseTemplateContent);
    const targetTemplateObj = parser.parse(targetTemplateContent);

    // Diff templates
    const diff = diffEngine.diff(baseTemplateObj, targetTemplateObj);

    // Calculate cost delta
    const costDelta = await pricingService.getCostDelta(diff, region);

    // Generate report
    const summary = reporter.generateReport(costDelta, 'text');

    return {
      totalDelta: costDelta.totalDelta,
      currency: costDelta.currency,
      addedResources: costDelta.addedCosts,
      removedResources: costDelta.removedCosts,
      modifiedResources: costDelta.modifiedCosts,
      summary,
    };
  }

  /**
   * Build configuration summary
   */
  private buildConfigSummary(config: any, options: PipelineOptions): ConfigSummary {
    const summary: ConfigSummary = {
      synthesisEnabled: !!options.synthesize,
    };

    if (options.configPath) {
      summary.configPath = options.configPath;
    }

    if (config.thresholds) {
      const thresholds = options.environment && config.thresholds.environments?.[options.environment]
        ? config.thresholds.environments[options.environment]
        : config.thresholds.default;

      if (thresholds) {
        summary.thresholds = {
          warning: thresholds.warning,
          error: thresholds.error,
          environment: options.environment,
        };
      }
    }

    if (config.usageAssumptions) {
      summary.usageAssumptions = config.usageAssumptions;
    }

    if (config.exclusions?.resourceTypes) {
      summary.excludedResourceTypes = config.exclusions.resourceTypes;
    }

    return summary;
  }
}
