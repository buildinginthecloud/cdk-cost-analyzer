import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class TransitGatewayCalculator implements ResourceCostCalculator {
  private readonly HOURS_PER_MONTH = 730;
  private readonly DEFAULT_ATTACHMENTS = 3;
  private readonly DEFAULT_MONTHLY_DATA_GB = 1000;
  private readonly FALLBACK_ATTACHMENT_PRICE = 0.05;
  private readonly FALLBACK_DATA_PRICE = 0.02;

  constructor(
    private readonly customAttachments?: number,
    private readonly customMonthlyDataGB?: number,
  ) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::EC2::TransitGateway' ||
      resourceType === 'AWS::EC2::TransitGatewayAttachment'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      if (resource.type === 'AWS::EC2::TransitGatewayAttachment') {
        return await this.calculateAttachmentCost(region, pricingClient);
      }
      return await this.calculateTransitGatewayCost(region, pricingClient);
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private async calculateAttachmentCost(
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const hourlyRate = await pricingClient.getPrice({
      serviceCode: 'AmazonVPC',
      region: normalizeRegion(region),
      filters: [
        { field: 'productFamily', value: 'TransitGateway' },
        { field: 'operation', value: 'TransitGatewayVPCAttachment' },
      ],
    });

    const rate = hourlyRate ?? this.FALLBACK_ATTACHMENT_PRICE;
    const monthlyCost = rate * this.HOURS_PER_MONTH;

    return {
      amount: monthlyCost,
      currency: 'USD',
      confidence: hourlyRate !== null ? 'high' : 'medium',
      assumptions: [
        `Transit Gateway attachment: $${rate.toFixed(4)}/hour × ${this.HOURS_PER_MONTH}h = $${monthlyCost.toFixed(2)}/month`,
        ...(hourlyRate === null ? [`Using fallback pricing (API data not available for region ${region})`] : []),
        'Data processing costs are calculated on the Transit Gateway resource',
      ],
    };
  }

  private async calculateTransitGatewayCost(
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const hourlyRate = await pricingClient.getPrice({
      serviceCode: 'AmazonVPC',
      region: normalizeRegion(region),
      filters: [
        { field: 'productFamily', value: 'TransitGateway' },
        { field: 'operation', value: 'TransitGatewayVPCAttachment' },
      ],
    });

    const dataRate = await pricingClient.getPrice({
      serviceCode: 'AmazonVPC',
      region: normalizeRegion(region),
      filters: [
        { field: 'productFamily', value: 'TransitGateway' },
        { field: 'operation', value: 'TransitGatewayData' },
      ],
    });

    const attachmentRate = hourlyRate ?? this.FALLBACK_ATTACHMENT_PRICE;
    const dataProcessingRate = dataRate ?? this.FALLBACK_DATA_PRICE;
    const usedFallback = hourlyRate === null || dataRate === null;

    const attachments = this.customAttachments ?? this.DEFAULT_ATTACHMENTS;
    const monthlyDataGB = this.customMonthlyDataGB ?? this.DEFAULT_MONTHLY_DATA_GB;

    const attachmentCost = attachments * attachmentRate * this.HOURS_PER_MONTH;
    const dataProcessingCost = monthlyDataGB * dataProcessingRate;
    const totalCost = attachmentCost + dataProcessingCost;

    return {
      amount: totalCost,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `${attachments} attachments × $${attachmentRate.toFixed(4)}/hour × ${this.HOURS_PER_MONTH}h = $${attachmentCost.toFixed(2)}/month`,
        `Data processing: ${monthlyDataGB} GB × $${dataProcessingRate.toFixed(4)}/GB = $${dataProcessingCost.toFixed(2)}/month`,
        ...(usedFallback ? [`Using fallback pricing (API data not available for region ${region})`] : []),
      ],
    };
  }
}
