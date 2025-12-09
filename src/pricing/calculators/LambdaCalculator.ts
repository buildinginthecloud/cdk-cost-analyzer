import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class LambdaCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_INVOCATIONS = 1000000;
  private readonly DEFAULT_DURATION_MS = 1000;
  private readonly DEFAULT_MEMORY_MB = 128;

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::Lambda::Function';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const memorySize = (resource.properties.MemorySize as number) || this.DEFAULT_MEMORY_MB;

    try {
      const requestPrice = await pricingClient.getPrice({
        serviceCode: 'AWSLambda',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'group', value: 'AWS-Lambda-Requests' },
        ],
      });

      const computePrice = await pricingClient.getPrice({
        serviceCode: 'AWSLambda',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'group', value: 'AWS-Lambda-Duration' },
        ],
      });

      if (requestPrice === null || computePrice === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Pricing data not available for Lambda in region ${region}`],
        };
      }

      const requestCost = (this.DEFAULT_INVOCATIONS / 1000000) * requestPrice;

      const gbSeconds = (memorySize / 1024) * (this.DEFAULT_DURATION_MS / 1000) * this.DEFAULT_INVOCATIONS;
      const computeCost = gbSeconds * computePrice;

      const totalCost = requestCost + computeCost;

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Assumes ${this.DEFAULT_INVOCATIONS.toLocaleString()} invocations per month`,
          `Assumes ${this.DEFAULT_DURATION_MS}ms average execution time`,
          `Assumes ${memorySize}MB memory allocation`,
        ],
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
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
