import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class LambdaCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_INVOCATIONS = 1000000;
  private readonly DEFAULT_DURATION_MS = 1000;
  private readonly DEFAULT_MEMORY_MB = 128;
  
  // Fallback pricing rates (AWS Lambda us-east-1 pricing as of 2024)
  // Used when API pricing is unavailable but user provided usage assumptions
  private readonly FALLBACK_REQUEST_PRICE = 0.20; // Per 1M requests
  private readonly FALLBACK_COMPUTE_PRICE = 0.0000166667; // Per GB-second

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
        // If user provided custom usage assumptions, use fallback pricing
        // Otherwise return 0 (pricing not available)
        const hasCustomAssumptions = this.customInvocationsPerMonth !== undefined || 
                                     this.customAverageDurationMs !== undefined;
        
        if (hasCustomAssumptions) {
          // Use fallback pricing to provide estimate
          const effectiveRequestPrice = requestPrice ?? this.FALLBACK_REQUEST_PRICE;
          const effectiveComputePrice = computePrice ?? this.FALLBACK_COMPUTE_PRICE;
          
          const requestCost = (invocations / 1000000) * effectiveRequestPrice;
          const gbSeconds = (memorySize / 1024) * (durationMs / 1000) * invocations;
          const computeCost = gbSeconds * effectiveComputePrice;
          const totalCost = requestCost + computeCost;
          
          return {
            amount: totalCost,
            currency: 'USD',
            confidence: 'low',
            assumptions: [
              requestPrice === null ? 'Using fallback request pricing (API unavailable)' : '',
              computePrice === null ? 'Using fallback compute pricing (API unavailable)' : '',
              ...assumptions,
            ].filter(a => a !== ''),
          };
        }
        
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

      // If user provided custom usage assumptions, use fallback pricing
      // Otherwise return 0 (pricing API failed)
      const hasCustomAssumptions = this.customInvocationsPerMonth !== undefined || 
                                   this.customAverageDurationMs !== undefined;
      
      if (hasCustomAssumptions) {
        // Use fallback pricing to provide estimate even when API fails
        const requestCost = (invocations / 1000000) * this.FALLBACK_REQUEST_PRICE;
        const gbSeconds = (memorySize / 1024) * (durationMs / 1000) * invocations;
        const computeCost = gbSeconds * this.FALLBACK_COMPUTE_PRICE;
        const totalCost = requestCost + computeCost;
        
        return {
          amount: totalCost,
          currency: 'USD',
          confidence: 'low',
          assumptions: [
            'Using fallback pricing (API error)',
            ...assumptions.slice(1), // Skip the "Failed to fetch" message, already covered
          ],
        };
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
