import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class LambdaCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_INVOCATIONS = 1000000;
  private readonly DEFAULT_DURATION_MS = 1000;
  private readonly DEFAULT_MEMORY_MB = 128;

  constructor(
    private readonly customInvocationsPerMonth?: number,
    private readonly customAverageDurationMs?: number,
  ) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::Lambda::Function';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const memorySize = (resource.properties.MemorySize as number) || this.DEFAULT_MEMORY_MB;
    const invocations = this.customInvocationsPerMonth ?? this.DEFAULT_INVOCATIONS;
    const durationMs = this.customAverageDurationMs ?? this.DEFAULT_DURATION_MS;

    try {
      const requestPrice = await pricingClient.getPrice({
        serviceCode: 'AWSLambda',
        region: normalizeRegion(region),
        filters: [
          { field: 'group', value: 'AWS-Lambda-Requests' },
        ],
      });

      const computePrice = await pricingClient.getPrice({
        serviceCode: 'AWSLambda',
        region: normalizeRegion(region),
        filters: [
          { field: 'group', value: 'AWS-Lambda-Duration' },
        ],
      });

      const assumptions = [
        `Assumes ${invocations.toLocaleString()} invocations per month`,
        `Assumes ${durationMs}ms average execution time`,
        `Assumes ${memorySize}MB memory allocation`,
      ];

      if (this.customInvocationsPerMonth !== undefined) {
        assumptions.push('Using custom invocation count assumption from configuration');
      }
      if (this.customAverageDurationMs !== undefined) {
        assumptions.push('Using custom duration assumption from configuration');
      }

      if (requestPrice === null || computePrice === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for Lambda in region ${region}`,
            ...assumptions,
          ],
        };
      }

      const requestCost = (invocations / 1000000) * requestPrice;

      const gbSeconds = (memorySize / 1024) * (durationMs / 1000) * invocations;
      const computeCost = gbSeconds * computePrice;

      const totalCost = requestCost + computeCost;

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions,
      };
    } catch (error) {
      const assumptions = [
        `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
        `Would assume ${invocations.toLocaleString()} invocations per month`,
        `Would assume ${durationMs}ms average execution time`,
        `Would assume ${memorySize}MB memory allocation`,
      ];

      if (this.customInvocationsPerMonth !== undefined) {
        assumptions.push('Using custom invocation count assumption from configuration');
      }
      if (this.customAverageDurationMs !== undefined) {
        assumptions.push('Using custom duration assumption from configuration');
      }

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions,
      };
    }
  }
}
