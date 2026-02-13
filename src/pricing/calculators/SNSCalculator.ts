import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';
import { Logger } from '../../utils/Logger';

/**
 * Cost breakdown for SNS pricing components
 */
export interface SNSCostBreakdown {
  publishCost: number;
  httpDeliveryCost: number;
  emailDeliveryCost: number;
  smsDeliveryCost: number;
  mobilePushDeliveryCost: number;
  totalCost: number;
}

/**
 * Calculator for AWS::SNS::Topic resources.
 *
 * SNS Pricing Model (as of 2024):
 * - Publishes: $0.50 per million requests (first 1M free)
 * - HTTP/S deliveries: $0.60 per million
 * - Email deliveries: $2.00 per 100,000
 * - SMS: Varies by country (using US rate as default)
 * - Mobile push: $0.50 per million
 *
 * @see https://aws.amazon.com/sns/pricing/
 */
export class SNSCalculator implements ResourceCostCalculator {
  // Default usage assumptions
  private readonly DEFAULT_MONTHLY_PUBLISHES = 1_000_000;
  private readonly DEFAULT_HTTP_DELIVERIES = 1_000_000;
  private readonly DEFAULT_EMAIL_DELIVERIES = 0;
  private readonly DEFAULT_SMS_DELIVERIES = 0;
  private readonly DEFAULT_MOBILE_PUSH_DELIVERIES = 0;

  // Fallback pricing rates (AWS SNS us-east-1 pricing as of 2024)
  private readonly FALLBACK_PUBLISH_PRICE_PER_MILLION = 0.50;
  private readonly FALLBACK_HTTP_DELIVERY_PRICE_PER_MILLION = 0.60;
  private readonly FALLBACK_EMAIL_DELIVERY_PRICE_PER_100K = 2.00;
  private readonly FALLBACK_SMS_PRICE_PER_MESSAGE = 0.00645; // US rate
  private readonly FALLBACK_MOBILE_PUSH_PRICE_PER_MILLION = 0.50;

  // Free tier thresholds
  private readonly FREE_TIER_PUBLISHES = 1_000_000;

  constructor(
    private readonly customMonthlyPublishes?: number,
    private readonly customHttpDeliveries?: number,
    private readonly customEmailDeliveries?: number,
    private readonly customSmsDeliveries?: number,
    private readonly customMobilePushDeliveries?: number,
  ) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::SNS::Topic';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const monthlyPublishes = this.customMonthlyPublishes ?? this.DEFAULT_MONTHLY_PUBLISHES;
    const httpDeliveries = this.customHttpDeliveries ?? this.DEFAULT_HTTP_DELIVERIES;
    const emailDeliveries = this.customEmailDeliveries ?? this.DEFAULT_EMAIL_DELIVERIES;
    const smsDeliveries = this.customSmsDeliveries ?? this.DEFAULT_SMS_DELIVERIES;
    const mobilePushDeliveries = this.customMobilePushDeliveries ?? this.DEFAULT_MOBILE_PUSH_DELIVERIES;

    Logger.debug('SNS pricing calculation started', {
      region,
      logicalId: resource.logicalId,
      monthlyPublishes,
      httpDeliveries,
      emailDeliveries,
      smsDeliveries,
      mobilePushDeliveries,
    });

    try {
      const regionPrefix = getRegionPrefix(region);
      const normalizedRegion = normalizeRegion(region);

      // Fetch pricing data from AWS Pricing API
      const publishPrice = await this.getPublishPrice(pricingClient, normalizedRegion, regionPrefix);
      const httpDeliveryPrice = await this.getHttpDeliveryPrice(pricingClient, normalizedRegion, regionPrefix);
      const emailDeliveryPrice = await this.getEmailDeliveryPrice(pricingClient, normalizedRegion, regionPrefix);
      const smsPrice = await this.getSmsPrice(pricingClient, normalizedRegion, regionPrefix);
      const mobilePushPrice = await this.getMobilePushPrice(pricingClient, normalizedRegion, regionPrefix);

      const hasCustomAssumptions = this.hasCustomAssumptions();
      const allPricesAvailable = publishPrice !== null &&
        httpDeliveryPrice !== null &&
        emailDeliveryPrice !== null &&
        smsPrice !== null &&
        mobilePushPrice !== null;

      // Calculate costs using API prices or fallbacks
      const costBreakdown = this.calculateCostBreakdown(
        monthlyPublishes,
        httpDeliveries,
        emailDeliveries,
        smsDeliveries,
        mobilePushDeliveries,
        publishPrice,
        httpDeliveryPrice,
        emailDeliveryPrice,
        smsPrice,
        mobilePushPrice,
      );

      Logger.debug('SNS cost calculated', {
        costBreakdown,
        allPricesAvailable,
      });

      const assumptions = this.buildAssumptions(
        monthlyPublishes,
        httpDeliveries,
        emailDeliveries,
        smsDeliveries,
        mobilePushDeliveries,
        costBreakdown,
        allPricesAvailable,
        publishPrice,
        httpDeliveryPrice,
        emailDeliveryPrice,
        smsPrice,
        mobilePushPrice,
      );

      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low' | 'unknown';
      if (!allPricesAvailable && !hasCustomAssumptions) {
        confidence = 'unknown';
      } else if (!allPricesAvailable && hasCustomAssumptions) {
        confidence = 'low';
      } else {
        confidence = 'medium';
      }

      // If all prices are unavailable and no custom assumptions, return zero cost
      if (!allPricesAvailable && !hasCustomAssumptions) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for SNS in region ${region}`,
            ...assumptions,
          ],
        };
      }

      return {
        amount: costBreakdown.totalCost,
        currency: 'USD',
        confidence,
        assumptions,
      };
    } catch (error) {
      Logger.debug('SNS pricing calculation failed', {
        error: error instanceof Error ? error.message : String(error),
        region,
      });

      // If user provided custom assumptions, use fallback pricing
      if (this.hasCustomAssumptions()) {
        const costBreakdown = this.calculateCostBreakdown(
          monthlyPublishes,
          httpDeliveries,
          emailDeliveries,
          smsDeliveries,
          mobilePushDeliveries,
          null,
          null,
          null,
          null,
          null,
        );

        return {
          amount: costBreakdown.totalCost,
          currency: 'USD',
          confidence: 'low',
          assumptions: [
            'Using fallback pricing (API error)',
            `Assumes ${monthlyPublishes.toLocaleString()} publishes per month`,
            `Assumes ${httpDeliveries.toLocaleString()} HTTP/S deliveries per month`,
          ],
        };
      }

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private async getPublishPrice(
    pricingClient: PricingClient,
    normalizedRegion: string,
    regionPrefix: string,
  ): Promise<number | null> {
    const usageType = regionPrefix ? `${regionPrefix}-PublishRequests` : 'PublishRequests';
    return pricingClient.getPrice({
      serviceCode: 'AmazonSNS',
      region: normalizedRegion,
      filters: [
        { field: 'productFamily', value: 'Notification' },
        { field: 'usagetype', value: usageType },
      ],
    });
  }

  private async getHttpDeliveryPrice(
    pricingClient: PricingClient,
    normalizedRegion: string,
    regionPrefix: string,
  ): Promise<number | null> {
    const usageType = regionPrefix ? `${regionPrefix}-DeliveryAttempts-HTTP` : 'DeliveryAttempts-HTTP';
    return pricingClient.getPrice({
      serviceCode: 'AmazonSNS',
      region: normalizedRegion,
      filters: [
        { field: 'productFamily', value: 'Notification' },
        { field: 'usagetype', value: usageType },
      ],
    });
  }

  private async getEmailDeliveryPrice(
    pricingClient: PricingClient,
    normalizedRegion: string,
    regionPrefix: string,
  ): Promise<number | null> {
    const usageType = regionPrefix ? `${regionPrefix}-DeliveryAttempts-EMAIL` : 'DeliveryAttempts-EMAIL';
    return pricingClient.getPrice({
      serviceCode: 'AmazonSNS',
      region: normalizedRegion,
      filters: [
        { field: 'productFamily', value: 'Notification' },
        { field: 'usagetype', value: usageType },
      ],
    });
  }

  private async getSmsPrice(
    pricingClient: PricingClient,
    normalizedRegion: string,
    regionPrefix: string,
  ): Promise<number | null> {
    const usageType = regionPrefix ? `${regionPrefix}-DeliveryAttempts-SMS` : 'DeliveryAttempts-SMS';
    return pricingClient.getPrice({
      serviceCode: 'AmazonSNS',
      region: normalizedRegion,
      filters: [
        { field: 'productFamily', value: 'SMS' },
        { field: 'usagetype', value: usageType },
      ],
    });
  }

  private async getMobilePushPrice(
    pricingClient: PricingClient,
    normalizedRegion: string,
    regionPrefix: string,
  ): Promise<number | null> {
    const usageType = regionPrefix ? `${regionPrefix}-DeliveryAttempts-APNS` : 'DeliveryAttempts-APNS';
    return pricingClient.getPrice({
      serviceCode: 'AmazonSNS',
      region: normalizedRegion,
      filters: [
        { field: 'productFamily', value: 'Mobile Push Notification' },
        { field: 'usagetype', value: usageType },
      ],
    });
  }

  private calculateCostBreakdown(
    monthlyPublishes: number,
    httpDeliveries: number,
    emailDeliveries: number,
    smsDeliveries: number,
    mobilePushDeliveries: number,
    publishPrice: number | null,
    httpDeliveryPrice: number | null,
    emailDeliveryPrice: number | null,
    smsPrice: number | null,
    mobilePushPrice: number | null,
  ): SNSCostBreakdown {
    // Use API prices if available, otherwise fallback
    const effectivePublishPrice = publishPrice ?? this.FALLBACK_PUBLISH_PRICE_PER_MILLION;
    const effectiveHttpDeliveryPrice = httpDeliveryPrice ?? this.FALLBACK_HTTP_DELIVERY_PRICE_PER_MILLION;
    const effectiveEmailDeliveryPrice = emailDeliveryPrice ?? this.FALLBACK_EMAIL_DELIVERY_PRICE_PER_100K;
    const effectiveSmsPrice = smsPrice ?? this.FALLBACK_SMS_PRICE_PER_MESSAGE;
    const effectiveMobilePushPrice = mobilePushPrice ?? this.FALLBACK_MOBILE_PUSH_PRICE_PER_MILLION;

    // Calculate publish cost (first 1M free)
    const billablePublishes = Math.max(0, monthlyPublishes - this.FREE_TIER_PUBLISHES);
    const publishCost = (billablePublishes / 1_000_000) * effectivePublishPrice;

    // HTTP/S delivery cost: $X per million
    const httpDeliveryCost = (httpDeliveries / 1_000_000) * effectiveHttpDeliveryPrice;

    // Email delivery cost: $X per 100,000
    const emailDeliveryCost = (emailDeliveries / 100_000) * effectiveEmailDeliveryPrice;

    // SMS delivery cost: $X per message (varies by country, using US rate)
    const smsDeliveryCost = smsDeliveries * effectiveSmsPrice;

    // Mobile push delivery cost: $X per million
    const mobilePushDeliveryCost = (mobilePushDeliveries / 1_000_000) * effectiveMobilePushPrice;

    const totalCost = publishCost + httpDeliveryCost + emailDeliveryCost + smsDeliveryCost + mobilePushDeliveryCost;

    return {
      publishCost,
      httpDeliveryCost,
      emailDeliveryCost,
      smsDeliveryCost,
      mobilePushDeliveryCost,
      totalCost,
    };
  }

  private buildAssumptions(
    monthlyPublishes: number,
    httpDeliveries: number,
    emailDeliveries: number,
    smsDeliveries: number,
    mobilePushDeliveries: number,
    costBreakdown: SNSCostBreakdown,
    allPricesAvailable: boolean,
    publishPrice: number | null,
    httpDeliveryPrice: number | null,
    emailDeliveryPrice: number | null,
    smsPrice: number | null,
    mobilePushPrice: number | null,
  ): string[] {
    const assumptions: string[] = [];

    // Add usage assumptions
    assumptions.push(`Assumes ${monthlyPublishes.toLocaleString()} publishes per month`);
    assumptions.push(`Assumes ${httpDeliveries.toLocaleString()} HTTP/S deliveries per month`);

    if (emailDeliveries > 0) {
      assumptions.push(`Assumes ${emailDeliveries.toLocaleString()} email deliveries per month`);
    }
    if (smsDeliveries > 0) {
      assumptions.push(`Assumes ${smsDeliveries.toLocaleString()} SMS deliveries per month (using US rate)`);
    }
    if (mobilePushDeliveries > 0) {
      assumptions.push(`Assumes ${mobilePushDeliveries.toLocaleString()} mobile push deliveries per month`);
    }

    // Add free tier information
    if (monthlyPublishes <= this.FREE_TIER_PUBLISHES) {
      assumptions.push(`First ${this.FREE_TIER_PUBLISHES.toLocaleString()} publishes are free`);
    } else {
      const billablePublishes = monthlyPublishes - this.FREE_TIER_PUBLISHES;
      assumptions.push(`${this.FREE_TIER_PUBLISHES.toLocaleString()} free tier publishes applied, ${billablePublishes.toLocaleString()} billable`);
    }

    // Add cost breakdown
    if (costBreakdown.publishCost > 0) {
      assumptions.push(`Publish cost: $${costBreakdown.publishCost.toFixed(2)}`);
    }
    if (costBreakdown.httpDeliveryCost > 0) {
      assumptions.push(`HTTP/S delivery cost: $${costBreakdown.httpDeliveryCost.toFixed(2)}`);
    }
    if (costBreakdown.emailDeliveryCost > 0) {
      assumptions.push(`Email delivery cost: $${costBreakdown.emailDeliveryCost.toFixed(2)}`);
    }
    if (costBreakdown.smsDeliveryCost > 0) {
      assumptions.push(`SMS delivery cost: $${costBreakdown.smsDeliveryCost.toFixed(2)}`);
    }
    if (costBreakdown.mobilePushDeliveryCost > 0) {
      assumptions.push(`Mobile push delivery cost: $${costBreakdown.mobilePushDeliveryCost.toFixed(2)}`);
    }

    // Add fallback pricing notes
    if (!allPricesAvailable) {
      if (publishPrice === null) {
        assumptions.push('Using fallback publish pricing (API unavailable)');
      }
      if (httpDeliveryPrice === null) {
        assumptions.push('Using fallback HTTP delivery pricing (API unavailable)');
      }
      if (emailDeliveryPrice === null && emailDeliveries > 0) {
        assumptions.push('Using fallback email delivery pricing (API unavailable)');
      }
      if (smsPrice === null && smsDeliveries > 0) {
        assumptions.push('Using fallback SMS pricing (API unavailable)');
      }
      if (mobilePushPrice === null && mobilePushDeliveries > 0) {
        assumptions.push('Using fallback mobile push pricing (API unavailable)');
      }
    }

    // Add custom assumption notes
    if (this.customMonthlyPublishes !== undefined) {
      assumptions.push('Using custom publish count from configuration');
    }
    if (this.customHttpDeliveries !== undefined) {
      assumptions.push('Using custom HTTP delivery count from configuration');
    }
    if (this.customEmailDeliveries !== undefined) {
      assumptions.push('Using custom email delivery count from configuration');
    }
    if (this.customSmsDeliveries !== undefined) {
      assumptions.push('Using custom SMS delivery count from configuration');
    }
    if (this.customMobilePushDeliveries !== undefined) {
      assumptions.push('Using custom mobile push delivery count from configuration');
    }

    return assumptions;
  }

  private hasCustomAssumptions(): boolean {
    return (
      this.customMonthlyPublishes !== undefined ||
      this.customHttpDeliveries !== undefined ||
      this.customEmailDeliveries !== undefined ||
      this.customSmsDeliveries !== undefined ||
      this.customMobilePushDeliveries !== undefined
    );
  }
}
