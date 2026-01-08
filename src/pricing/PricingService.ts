import { CacheManager } from './CacheManager';
import { ALBCalculator } from './calculators/ALBCalculator';
import { APIGatewayCalculator } from './calculators/APIGatewayCalculator';
import { CloudFrontCalculator } from './calculators/CloudFrontCalculator';
import { DynamoDBCalculator } from './calculators/DynamoDBCalculator';
import { EC2Calculator } from './calculators/EC2Calculator';
import { ECSCalculator } from './calculators/ECSCalculator';
import { ElastiCacheCalculator } from './calculators/ElastiCacheCalculator';
import { LambdaCalculator } from './calculators/LambdaCalculator';
import { NatGatewayCalculator } from './calculators/NatGatewayCalculator';
import { NLBCalculator } from './calculators/NLBCalculator';
import { RDSCalculator } from './calculators/RDSCalculator';
import { S3Calculator } from './calculators/S3Calculator';
import { VPCEndpointCalculator } from './calculators/VPCEndpointCalculator';
import { PricingClient } from './PricingClient';
import {
  PricingService as IPricingService,
  MonthlyCost,
  CostDelta,
  ResourceCostCalculator,
} from './types';
import { UsageAssumptionsConfig, CacheConfig } from '../config/types';
import { ResourceWithId, ResourceDiff } from '../diff/types';

export class PricingService implements IPricingService {
  private calculators: ResourceCostCalculator[];
  private pricingClient: PricingClient;
  private excludedResourceTypes: Set<string>;

  constructor(
    region: string = 'us-east-1',
    usageAssumptions?: UsageAssumptionsConfig,
    excludedResourceTypes?: string[],
    cacheConfig?: CacheConfig,
    pricingClient?: PricingClient,
  ) {
    // Use provided pricing client or create a new one
    if (pricingClient) {
      this.pricingClient = pricingClient;
    } else {
      // Initialize cache manager if caching is enabled
      let cacheManager: CacheManager | undefined;
      if (cacheConfig?.enabled !== false) {
        const cacheDuration = cacheConfig?.durationHours ?? 24;
        cacheManager = new CacheManager('.cdk-cost-analyzer-cache', cacheDuration);
      }

      this.pricingClient = new PricingClient(region, cacheManager);
    }
    this.excludedResourceTypes = new Set(excludedResourceTypes || []);
    this.calculators = [
      new EC2Calculator(),
      new S3Calculator(),
      new LambdaCalculator(
        usageAssumptions?.lambda?.invocationsPerMonth,
        usageAssumptions?.lambda?.averageDurationMs,
      ),
      new RDSCalculator(),
      new DynamoDBCalculator(),
      new ECSCalculator(),
      new APIGatewayCalculator(),
      new NatGatewayCalculator(usageAssumptions?.natGateway?.dataProcessedGB),
      new ALBCalculator(
        usageAssumptions?.alb?.newConnectionsPerSecond,
        usageAssumptions?.alb?.activeConnectionsPerMinute,
        usageAssumptions?.alb?.processedBytesGB,
      ),
      new NLBCalculator(
        usageAssumptions?.nlb?.newConnectionsPerSecond,
        usageAssumptions?.nlb?.activeConnectionsPerMinute,
        usageAssumptions?.nlb?.processedBytesGB,
      ),
      new VPCEndpointCalculator(usageAssumptions?.vpcEndpoint?.dataProcessedGB),
      new CloudFrontCalculator(
        usageAssumptions?.cloudfront?.dataTransferGB,
        usageAssumptions?.cloudfront?.requests,
      ),
      new ElastiCacheCalculator(),
    ];
  }

  async getResourceCost(resource: ResourceWithId, region: string): Promise<MonthlyCost> {
    // Check if resource type is excluded
    if (this.excludedResourceTypes.has(resource.type)) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [`Resource type ${resource.type} is excluded from cost analysis`],
      };
    }

    const calculator = this.calculators.find(calc => calc.supports(resource.type));

    if (!calculator) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Resource type ${resource.type} is not supported`],
      };
    }

    try {
      return await calculator.calculateCost(resource, region, this.pricingClient);
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to calculate cost: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  async getCostDelta(diff: ResourceDiff, region: string): Promise<CostDelta> {
    // Filter out excluded resources before processing
    const filteredAdded = diff.added.filter(r => !this.excludedResourceTypes.has(r.type));
    const filteredRemoved = diff.removed.filter(r => !this.excludedResourceTypes.has(r.type));
    const filteredModified = diff.modified.filter(r => !this.excludedResourceTypes.has(r.type));

    const addedCosts = await Promise.all(
      filteredAdded.map(async (resource) => {
        const monthlyCost = await this.getResourceCost(resource, region);
        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost,
        };
      }),
    );

    const removedCosts = await Promise.all(
      filteredRemoved.map(async (resource) => {
        const monthlyCost = await this.getResourceCost(resource, region);
        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost,
        };
      }),
    );

    const modifiedCosts = await Promise.all(
      filteredModified.map(async (resource) => {
        const oldResource: ResourceWithId = {
          logicalId: resource.logicalId,
          type: resource.type,
          properties: resource.oldProperties,
        };
        const newResource: ResourceWithId = {
          logicalId: resource.logicalId,
          type: resource.type,
          properties: resource.newProperties,
        };

        const oldMonthlyCost = await this.getResourceCost(oldResource, region);
        const newMonthlyCost = await this.getResourceCost(newResource, region);
        const costDelta = newMonthlyCost.amount - oldMonthlyCost.amount;

        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost: newMonthlyCost,
          oldMonthlyCost,
          newMonthlyCost,
          costDelta,
        };
      }),
    );

    const totalAddedCost = addedCosts.reduce((sum, r) => sum + r.monthlyCost.amount, 0);
    const totalRemovedCost = removedCosts.reduce((sum, r) => sum + r.monthlyCost.amount, 0);
    const totalModifiedDelta = modifiedCosts.reduce((sum, r) => sum + r.costDelta, 0);

    const totalDelta = totalAddedCost - totalRemovedCost + totalModifiedDelta;

    return {
      totalDelta,
      currency: 'USD',
      addedCosts,
      removedCosts,
      modifiedCosts,
    };
  }

  /**
   * Clean up resources and connections
   */
  destroy(): void {
    this.pricingClient.destroy();
  }
}
