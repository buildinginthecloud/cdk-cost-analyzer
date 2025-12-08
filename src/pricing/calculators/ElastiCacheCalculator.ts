import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class ElastiCacheCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::ElastiCache::CacheCluster';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient
  ): Promise<MonthlyCost> {
    const cacheNodeType = resource.properties.CacheNodeType as string;
    const engine = resource.properties.Engine as string;
    const numCacheNodes = (resource.properties.NumCacheNodes as number) || 1;
    const azMode = resource.properties.AZMode as string;

    if (!cacheNodeType || !engine) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: ['Cache node type or engine not specified'],
      };
    }

    try {
      // Query AWS Pricing API for node hourly rates
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonElastiCache',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'instanceType', value: cacheNodeType },
          { field: 'cacheEngine', value: this.normalizeEngine(engine) },
        ],
      });

      if (hourlyRate === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for node type ${cacheNodeType} with engine ${engine} in region ${region}`,
          ],
        };
      }

      const monthlyHours = 730;
      const perNodeCost = hourlyRate * monthlyHours;
      let totalCost = perNodeCost * numCacheNodes;

      const assumptions = [
        `Assumes ${monthlyHours} hours per month (24/7 operation)`,
        `Node type: ${cacheNodeType}`,
        `Engine: ${engine}`,
        `Number of cache nodes: ${numCacheNodes}`,
        `Per-node monthly cost: $${perNodeCost.toFixed(2)}`,
      ];

      // Account for multi-AZ replica costs when configured
      if (azMode === 'cross-az') {
        // Multi-AZ adds replica nodes (typically doubles the cost)
        totalCost *= 2;
        assumptions.push('Multi-AZ deployment with replica nodes (cost doubled)');
      } else {
        assumptions.push('Single-AZ deployment');
      }

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'high',
        assumptions,
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  private normalizeEngine(engine: string): string {
    const engineMap: Record<string, string> = {
      'redis': 'Redis',
      'memcached': 'Memcached',
    };

    return engineMap[engine.toLowerCase()] || engine;
  }

  private normalizeRegion(region: string): string {
    const regionMap: Record<string, string> = {
      'us-east-1': 'US East (N. Virginia)',
      'us-east-2': 'US East (Ohio)',
      'us-west-1': 'US West (N. California)',
      'us-west-2': 'US West (Oregon)',
      'eu-west-1': 'EU (Ireland)',
      'eu-west-2': 'EU (London)',
      'eu-west-3': 'EU (Paris)',
      'eu-central-1': 'EU (Frankfurt)',
      'eu-north-1': 'EU (Stockholm)',
      'ap-south-1': 'Asia Pacific (Mumbai)',
      'ap-southeast-1': 'Asia Pacific (Singapore)',
      'ap-southeast-2': 'Asia Pacific (Sydney)',
      'ap-northeast-1': 'Asia Pacific (Tokyo)',
      'ap-northeast-2': 'Asia Pacific (Seoul)',
    };

    return regionMap[region] || region;
  }
}
