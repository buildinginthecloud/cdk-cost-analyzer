import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';
import { CostAnalyzerConfig } from '../../config/types';

export class SQSCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_MONTHLY_REQUESTS = 1_000_000;

  // Fallback pricing rates (AWS SQS us-east-1 pricing as of 2024)
  // Used when API pricing is unavailable but user provided usage assumptions
  private readonly FALLBACK_STANDARD_PRICE_PER_MILLION = 0.40;
  private readonly FALLBACK_FIFO_PRICE_PER_MILLION = 0.50;

  private config?: CostAnalyzerConfig;

  constructor(config?: CostAnalyzerConfig) {
    this.config = config;
  }

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::SQS::Queue';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const isFifo = this.isFifoQueue(resource);
    const monthlyRequests = this.getMonthlyRequests();

    try {
      const pricePerMillion = await this.getPricePerMillion(region, isFifo, pricingClient);

      const assumptions = this.buildAssumptions(monthlyRequests, isFifo);

      if (pricePerMillion === null) {
        const hasCustomAssumptions = this.config?.usageAssumptions?.sqs?.monthlyRequests !== undefined;

        if (hasCustomAssumptions) {
          const fallbackPrice = isFifo
            ? this.FALLBACK_FIFO_PRICE_PER_MILLION
            : this.FALLBACK_STANDARD_PRICE_PER_MILLION;
          const monthlyCost = (monthlyRequests / 1_000_000) * fallbackPrice;

          return {
            amount: monthlyCost,
            currency: 'USD',
            confidence: 'low',
            assumptions: [
              'Using fallback pricing (API unavailable)',
              ...assumptions,
            ],
          };
        }

        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for SQS in region ${region}`,
            ...assumptions,
          ],
        };
      }

      const monthlyCost = (monthlyRequests / 1_000_000) * pricePerMillion;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions,
      };
    } catch (error) {
      const assumptions = this.buildAssumptions(monthlyRequests, isFifo);
      const hasCustomAssumptions = this.config?.usageAssumptions?.sqs?.monthlyRequests !== undefined;

      if (hasCustomAssumptions) {
        const fallbackPrice = isFifo
          ? this.FALLBACK_FIFO_PRICE_PER_MILLION
          : this.FALLBACK_STANDARD_PRICE_PER_MILLION;
        const monthlyCost = (monthlyRequests / 1_000_000) * fallbackPrice;

        return {
          amount: monthlyCost,
          currency: 'USD',
          confidence: 'low',
          assumptions: [
            'Using fallback pricing (API error)',
            ...assumptions,
          ],
        };
      }

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
          ...assumptions,
        ],
      };
    }
  }

  private isFifoQueue(resource: ResourceWithId): boolean {
    return resource.properties.FifoQueue === true ||
           resource.properties.FifoQueue === 'true';
  }

  private getMonthlyRequests(): number {
    return this.config?.usageAssumptions?.sqs?.monthlyRequests ?? this.DEFAULT_MONTHLY_REQUESTS;
  }

  private buildAssumptions(monthlyRequests: number, isFifo: boolean): string[] {
    const assumptions = [
      `Assumes ${monthlyRequests.toLocaleString()} requests per month`,
      isFifo ? 'FIFO queue' : 'Standard queue',
      'Does not include data transfer costs',
    ];

    if (this.config?.usageAssumptions?.sqs?.monthlyRequests !== undefined) {
      assumptions.push('Using custom monthly requests assumption from configuration');
    }

    return assumptions;
  }

  private async getPricePerMillion(
    region: string,
    isFifo: boolean,
    pricingClient: PricingClient,
  ): Promise<number | null> {
    const normalizedRegion = normalizeRegion(region);
    const regionPrefix = getRegionPrefix(region);

    // Standard queue usagetype: USE1-Requests (or just Requests for us-east-1)
    // FIFO queue usagetype: USE1-Requests-FIFO (or just Requests-FIFO for us-east-1)
    const baseUsageType = isFifo ? 'Requests-FIFO' : 'Requests';
    const usageType = regionPrefix ? `${regionPrefix}-${baseUsageType}` : baseUsageType;

    return pricingClient.getPrice({
      serviceCode: 'AWSQueueService',
      region: normalizedRegion,
      filters: [
        { field: 'productFamily', value: 'Queue' },
        { field: 'usagetype', value: usageType },
      ],
    });
  }
}
