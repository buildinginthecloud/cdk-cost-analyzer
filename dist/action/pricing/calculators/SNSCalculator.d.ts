import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
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
export declare class SNSCalculator implements ResourceCostCalculator {
    private readonly customMonthlyPublishes?;
    private readonly customHttpDeliveries?;
    private readonly customEmailDeliveries?;
    private readonly customSmsDeliveries?;
    private readonly customMobilePushDeliveries?;
    private readonly DEFAULT_MONTHLY_PUBLISHES;
    private readonly DEFAULT_HTTP_DELIVERIES;
    private readonly DEFAULT_EMAIL_DELIVERIES;
    private readonly DEFAULT_SMS_DELIVERIES;
    private readonly DEFAULT_MOBILE_PUSH_DELIVERIES;
    private readonly FALLBACK_PUBLISH_PRICE_PER_MILLION;
    private readonly FALLBACK_HTTP_DELIVERY_PRICE_PER_MILLION;
    private readonly FALLBACK_EMAIL_DELIVERY_PRICE_PER_100K;
    private readonly FALLBACK_SMS_PRICE_PER_MESSAGE;
    private readonly FALLBACK_MOBILE_PUSH_PRICE_PER_MILLION;
    private readonly FREE_TIER_PUBLISHES;
    constructor(customMonthlyPublishes?: number | undefined, customHttpDeliveries?: number | undefined, customEmailDeliveries?: number | undefined, customSmsDeliveries?: number | undefined, customMobilePushDeliveries?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private getPublishPrice;
    private getHttpDeliveryPrice;
    private getEmailDeliveryPrice;
    private getSmsPrice;
    private getMobilePushPrice;
    private calculateCostBreakdown;
    private buildAssumptions;
    private hasCustomAssumptions;
}
