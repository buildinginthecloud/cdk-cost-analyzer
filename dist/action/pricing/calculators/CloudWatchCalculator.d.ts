import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
/**
 * Calculator for AWS::Logs::LogGroup resources.
 *
 * CloudWatch Logs Pricing Model:
 * - Ingestion: $0.50 per GB (us-east-1)
 * - Storage: $0.03 per GB-month
 * - No free tier for ingestion
 *
 * @see https://aws.amazon.com/cloudwatch/pricing/
 */
export declare class CloudWatchLogsCalculator implements ResourceCostCalculator {
    private readonly customMonthlyIngestionGB?;
    private readonly DEFAULT_MONTHLY_INGESTION_GB;
    private readonly FALLBACK_INGESTION_PRICE_PER_GB;
    private readonly FALLBACK_STORAGE_PRICE_PER_GB;
    constructor(customMonthlyIngestionGB?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
/**
 * Calculator for AWS::CloudWatch::Alarm resources.
 *
 * CloudWatch Alarms Pricing Model:
 * - Standard resolution alarms (>= 60s period): $0.10 per alarm per month
 * - High resolution alarms (< 60s period): $0.30 per alarm per month
 * - Anomaly detection alarms: $0.30 per alarm per month (3 metrics)
 *
 * @see https://aws.amazon.com/cloudwatch/pricing/
 */
export declare class CloudWatchAlarmCalculator implements ResourceCostCalculator {
    private readonly FALLBACK_STANDARD_ALARM_PRICE;
    private readonly FALLBACK_HIGH_RES_ALARM_PRICE;
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
/**
 * Calculator for AWS::CloudWatch::Dashboard resources.
 *
 * CloudWatch Dashboards Pricing Model:
 * - $3.00 per dashboard per month
 * - First 3 dashboards are free (up to 50 metrics)
 *
 * @see https://aws.amazon.com/cloudwatch/pricing/
 */
export declare class CloudWatchDashboardCalculator implements ResourceCostCalculator {
    private readonly FALLBACK_DASHBOARD_PRICE;
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
