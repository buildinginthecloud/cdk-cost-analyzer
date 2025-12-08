import { ResourceWithId, ResourceDiff } from '../diff/types';
import {
  PricingService as IPricingService,
  MonthlyCost,
  CostDelta,
  ResourceCostCalculator,
} from './types';
import { UsageAssumptionsConfig, CacheConfig } from '../config/types';
import { PricingClient } from './PricingClient';
import { CacheManager } from './CacheManager';
import { EC2Calculator } from './calculators/EC2Calculator';
import { S3Calculator } from './calculators/S3Calculator';
import { LambdaCalculator } from './calculators/LambdaCalculator';
import { RDSCalculator } from './calculators/RDSCalculator';
import { DynamoDBCalculator } from './calculators/DynamoDBCalculator';
import { ECSCalculator } from './calculators/ECSCalculator';
import { APIGatewayCalculator } from './calculators/APIGatewayCalculator';
import { NatGatewayCalculator } from './calculators/NatGatewayCalculator';
import { ALBCalculator } from './calculators/ALBCalculator';
import { NLBCalculator } from './calculators/NLBCalculator';
import { VPCEndpointCalculator } from './calculators/VPCEndpointCalculator';
import { CloudFrontCalculator } from './calculators/CloudFrontCalculator';
import { ElastiCacheCalculator } from './calculators/ElastiCacheCalculator';

export class PricingService implements IPricingService {
  private calculators: ResourceCostCalculator[];
  private pricingClient: PricingClient;
  private excludedResourceTypes: Set<string>;

  constructor(
    region: string = 'us-east-1',
    usageAssumptions?: UsageAssumptionsConfig,
    excludedResourceTypes?: string[],
    cacheConfig?: CacheConfig
  ) {
    // Initialize cache manager if caching is enabled
    let cacheManager: CacheManager | undefined;
    if (cacheConfig?.enabled !== false) {
      const cacheDuration = cacheConfig?.durationHours ?? 24;
      cacheManager = new CacheManager('.cdk-cost-analyzer-cache', cacheDuration);
    }

    this.pricingClient = new PricingClient(region, cacheManager);
    this.excludedResourceTypes = new Set(excludedResourceTypes || []);
    this.calculators = [
      new EC2Calculator(),
      new S3Calculator(),
      new LambdaCalculator(),
      new RDSCalculator(),
      new DynamoDBCalculator(),
      new ECSCalculator(),
      new APIGatewayCalculator(),
      new NatGatewayCalculator(usageAssumptions?.natGateway?.dataProcessedGB),
      new ALBCalculator(
        usageAssumptions?.alb?.newConnectionsPerSecond,
        usageAssumptions?.alb?.activeConnectionsPerMinute,
        usageAssumptions?.alb?.processedBytesGB
      ),
      new NLBCalculator(
        usageAssumptions?.nlb?.newConnectionsPerSecond,
        usageAssumptions?.nlb?.activeConnectionsPerMinute,
        usageAssumptions?.nlb?.processedBytesGB
      ),
      new VPCEndpointCalculator(usageAssumptions?.vpcEndpoint?.dataProcessedGB),
      new CloudFrontCalculator(
        usageAssumptions?.cloudfront?.dataTransferGB,
        usageAssumptions?.cloudfront?.requests
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
    const addedCosts = await Promise.all(
      diff.added.map(async (resource) => {
        const monthlyCost = await this.getResourceCost(resource, region);
        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost,
        };
      })
    );

    const removedCosts = await Promise.all(
      diff.removed.map(async (resource) => {
        const monthlyCost = await this.getResourceCost(resource, region);
        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost,
        };
      })
    );

    const modifiedCosts = await Promise.all(
      diff.modified.map(async (resource) => {
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
      })
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
}
