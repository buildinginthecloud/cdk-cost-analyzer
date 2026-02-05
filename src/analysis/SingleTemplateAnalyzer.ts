import * as crypto from 'crypto';
import { TemplateParser } from '../parser/TemplateParser';
import { PricingService } from '../pricing/PricingService';
import { ResourceWithId } from '../diff/types';
import {
  AnalysisConfig,
  SingleTemplateCostResult,
  CostBreakdown,
  ResourceTypeCost,
  ConfidenceLevelCost,
  EnhancedResourceCost,
  AnalysisMetadata,
} from '../api/single-template-types';

/**
 * Service for analyzing costs in a single CloudFormation template
 */
export class SingleTemplateAnalyzer {
  /**
   * Analyze costs for all resources in a single template
   * 
   * @param template - CloudFormation template content (JSON or YAML)
   * @param region - AWS region for pricing calculations
   * @param config - Optional configuration for analysis
   * @returns Promise resolving to detailed cost analysis result
   */
  async analyzeCosts(
    template: string,
    region: string,
    config?: AnalysisConfig,
  ): Promise<SingleTemplateCostResult> {
    const parser = new TemplateParser();
    const pricingService = new PricingService(
      region,
      config?.usageAssumptions,
      config?.excludedResourceTypes,
      config?.cacheConfig,
    );

    try {
      // Parse the template
      const parsedTemplate = parser.parse(template);
      const resources: ResourceWithId[] = Object.entries(parsedTemplate.Resources || {}).map(
        ([logicalId, resource]: [string, any]) => ({
          logicalId,
          type: resource.Type,
          properties: resource.Properties || {},
        }),
      );

      // Calculate costs for all resources
      const analyzedAt = new Date();
      const resourceCosts: EnhancedResourceCost[] = await Promise.all(
        resources.map(async (resource) => {
          const monthlyCost = await pricingService.getResourceCost(resource, region, resources);
          return {
            logicalId: resource.logicalId,
            type: resource.type,
            monthlyCost,
            properties: resource.properties,
            region,
            calculatedAt: analyzedAt,
          };
        }),
      );

      // Calculate total cost
      const totalMonthlyCost = resourceCosts.reduce(
        (sum, rc) => sum + rc.monthlyCost.amount,
        0,
      );

      // Generate cost breakdown
      const costBreakdown = this.generateCostBreakdown(resourceCosts);

      // Generate metadata
      const metadata = this.generateMetadata(template, region, resourceCosts, analyzedAt);

      // Generate summary (placeholder - will be replaced by reporter)
      const summary = `Total monthly cost: $${totalMonthlyCost.toFixed(2)} USD`;

      return {
        totalMonthlyCost,
        currency: 'USD',
        resourceCosts,
        costBreakdown,
        summary,
        metadata,
      };
    } finally {
      // Clean up pricing service resources
      pricingService.destroy();
    }
  }

  /**
   * Generate cost breakdown grouped by resource type and confidence level
   */
  private generateCostBreakdown(resourceCosts: EnhancedResourceCost[]): CostBreakdown {
    // Group by resource type
    const byTypeMap = new Map<string, EnhancedResourceCost[]>();
    for (const rc of resourceCosts) {
      const existing = byTypeMap.get(rc.type) || [];
      existing.push(rc);
      byTypeMap.set(rc.type, existing);
    }

    const byResourceType: ResourceTypeCost[] = Array.from(byTypeMap.entries())
      .map(([resourceType, resources]) => ({
        resourceType,
        count: resources.length,
        totalCost: resources.reduce((sum, r) => sum + r.monthlyCost.amount, 0),
        resources: resources.map((r) => ({
          logicalId: r.logicalId,
          type: r.type,
          monthlyCost: r.monthlyCost,
        })),
      }))
      .sort((a, b) => b.totalCost - a.totalCost); // Sort by cost descending

    // Group by confidence level
    const byConfidenceMap = new Map<string, EnhancedResourceCost[]>();
    for (const rc of resourceCosts) {
      const confidence = rc.monthlyCost.confidence;
      const existing = byConfidenceMap.get(confidence) || [];
      existing.push(rc);
      byConfidenceMap.set(confidence, existing);
    }

    const byConfidenceLevel: ConfidenceLevelCost[] = Array.from(byConfidenceMap.entries()).map(
      ([confidence, resources]) => ({
        confidence: confidence as 'high' | 'medium' | 'low' | 'unknown',
        count: resources.length,
        totalCost: resources.reduce((sum, r) => sum + r.monthlyCost.amount, 0),
      }),
    );

    // Collect all unique assumptions
    const assumptionsSet = new Set<string>();
    for (const rc of resourceCosts) {
      for (const assumption of rc.monthlyCost.assumptions) {
        assumptionsSet.add(assumption);
      }
    }
    const assumptions = Array.from(assumptionsSet);

    return {
      byResourceType,
      byConfidenceLevel,
      assumptions,
    };
  }

  /**
   * Generate metadata about the analysis
   */
  private generateMetadata(
    template: string,
    region: string,
    resourceCosts: EnhancedResourceCost[],
    analyzedAt: Date,
  ): AnalysisMetadata {
    // Generate hash of template
    const templateHash = crypto.createHash('sha256').update(template).digest('hex').substring(0, 16);

    // Count supported vs unsupported resources
    const supportedResourceCount = resourceCosts.filter(
      (rc) => rc.monthlyCost.confidence !== 'unknown' || rc.monthlyCost.amount > 0,
    ).length;
    const unsupportedResourceCount = resourceCosts.length - supportedResourceCount;

    return {
      templateHash,
      region,
      analyzedAt,
      resourceCount: resourceCosts.length,
      supportedResourceCount,
      unsupportedResourceCount,
    };
  }
}
