import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';
import { Logger } from '../../utils/Logger';

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
export class CloudWatchLogsCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_MONTHLY_INGESTION_GB = 10;

  private readonly FALLBACK_INGESTION_PRICE_PER_GB = 0.50;
  private readonly FALLBACK_STORAGE_PRICE_PER_GB = 0.03;

  constructor(private readonly customMonthlyIngestionGB?: number) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::Logs::LogGroup';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const monthlyIngestionGB = this.customMonthlyIngestionGB ?? this.DEFAULT_MONTHLY_INGESTION_GB;
    const retentionDays = Number(resource.properties?.RetentionInDays ?? 0); // 0 = never expire

    Logger.debug('CloudWatch Logs pricing calculation started', {
      region,
      logicalId: resource.logicalId,
      monthlyIngestionGB,
      retentionDays,
    });

    try {
      const normalizedRegion = normalizeRegion(region);

      // Query ingestion pricing
      const ingestionPrice = await pricingClient.getPrice({
        serviceCode: 'AmazonCloudWatch',
        region: normalizedRegion,
        filters: [
          { field: 'productFamily', value: 'Data Payload' },
          { field: 'group', value: 'Ingestion' },
        ],
      });

      // Query storage pricing
      const storagePrice = await pricingClient.getPrice({
        serviceCode: 'AmazonCloudWatch',
        region: normalizedRegion,
        filters: [
          { field: 'productFamily', value: 'Storage Snapshot' },
        ],
      });

      Logger.debug('CloudWatch Logs prices retrieved', {
        ingestionPrice,
        storagePrice,
        region: normalizedRegion,
      });

      if (ingestionPrice === null && storagePrice === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for CloudWatch Logs in region ${region}`,
          ],
        };
      }

      const ingestionCostPerGB = ingestionPrice ?? this.FALLBACK_INGESTION_PRICE_PER_GB;
      const storageCostPerGB = storagePrice ?? this.FALLBACK_STORAGE_PRICE_PER_GB;
      const usedFallback = ingestionPrice === null || storagePrice === null;

      // Ingestion cost
      const ingestionCost = monthlyIngestionGB * ingestionCostPerGB;

      // Storage cost: approximate steady-state storage based on retention
      // If retention = 0 (never expire), assume 365 days for cost estimation
      const effectiveRetentionDays = retentionDays === 0 ? 365 : retentionDays;
      const avgStorageGB = (monthlyIngestionGB * effectiveRetentionDays) / 30;
      const storageCost = avgStorageGB * storageCostPerGB;

      const totalCost = ingestionCost + storageCost;
      const confidence = usedFallback ? 'low' : 'medium';

      Logger.debug('CloudWatch Logs cost calculated', {
        ingestionCost,
        storageCost,
        totalCost,
        confidence,
      });

      const assumptions: string[] = [];

      if (usedFallback) {
        if (ingestionPrice === null) {
          assumptions.push('Using fallback ingestion pricing (API unavailable)');
        }
        if (storagePrice === null) {
          assumptions.push('Using fallback storage pricing (API unavailable)');
        }
      }

      assumptions.push(`Log ingestion: ${monthlyIngestionGB}GB × $${ingestionCostPerGB.toFixed(2)}/GB = $${ingestionCost.toFixed(2)}/month`);
      const retentionLabel = retentionDays === 0 ? 'never expire (estimated as 365 days)' : `${retentionDays} days`;
      assumptions.push(`Log storage: ${avgStorageGB.toFixed(0)}GB avg (retention: ${retentionLabel}) × $${storageCostPerGB.toFixed(2)}/GB = $${storageCost.toFixed(2)}/month`);
      assumptions.push(`Total: $${totalCost.toFixed(2)}/month`);

      if (this.customMonthlyIngestionGB !== undefined) {
        assumptions.push('Using custom log ingestion volume from configuration');
      }

      assumptions.push('Does not include Logs Insights query costs');

      return {
        amount: totalCost,
        currency: 'USD',
        confidence,
        assumptions,
      };
    } catch (error) {
      Logger.debug('CloudWatch Logs pricing calculation failed', {
        error: error instanceof Error ? error.message : String(error),
        region,
      });

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to calculate CloudWatch Logs cost: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
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
export class CloudWatchAlarmCalculator implements ResourceCostCalculator {
  private readonly FALLBACK_STANDARD_ALARM_PRICE = 0.10;
  private readonly FALLBACK_HIGH_RES_ALARM_PRICE = 0.30;

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::CloudWatch::Alarm';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const period = Number(resource.properties?.Period ?? 60);
    const isHighResolution = period < 60;
    const metrics = resource.properties?.Metrics;
    const metricsCount = Array.isArray(metrics) ? metrics.length : 1;

    Logger.debug('CloudWatch Alarm pricing calculation started', {
      region,
      logicalId: resource.logicalId,
      period,
      isHighResolution,
    });

    try {
      const normalizedRegion = normalizeRegion(region);

      const alarmPrice = await pricingClient.getPrice({
        serviceCode: 'AmazonCloudWatch',
        region: normalizedRegion,
        filters: [
          { field: 'productFamily', value: 'Alarm' },
        ],
      });

      Logger.debug('CloudWatch Alarm price retrieved', {
        alarmPrice,
        region: normalizedRegion,
      });

      if (alarmPrice === null) {
        // Use fallback pricing
        const fallbackPrice = isHighResolution
          ? this.FALLBACK_HIGH_RES_ALARM_PRICE
          : this.FALLBACK_STANDARD_ALARM_PRICE;
        const totalCost = fallbackPrice * metricsCount;
        const resolution = isHighResolution ? 'high-resolution' : 'standard';

        return {
          amount: totalCost,
          currency: 'USD',
          confidence: 'low',
          assumptions: [
            'Using fallback pricing (API unavailable)',
            `CloudWatch ${resolution} alarm: ${metricsCount} metric(s) × $${fallbackPrice.toFixed(2)} = $${totalCost.toFixed(2)}/month`,
          ],
        };
      }

      // API returns standard alarm price; high-res is 3x standard
      const effectivePrice = isHighResolution ? alarmPrice * 3 : alarmPrice;
      const totalCost = effectivePrice * metricsCount;
      const resolution = isHighResolution ? 'high-resolution' : 'standard';

      Logger.debug('CloudWatch Alarm cost calculated', {
        effectivePrice,
        totalCost,
        resolution,
      });

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `CloudWatch ${resolution} alarm: ${metricsCount} metric(s) × $${effectivePrice.toFixed(2)} = $${totalCost.toFixed(2)}/month`,
        ],
      };
    } catch (error) {
      Logger.debug('CloudWatch Alarm pricing calculation failed', {
        error: error instanceof Error ? error.message : String(error),
        region,
      });

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to calculate CloudWatch Alarm cost: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
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
export class CloudWatchDashboardCalculator implements ResourceCostCalculator {
  private readonly FALLBACK_DASHBOARD_PRICE = 3.00;

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::CloudWatch::Dashboard';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    Logger.debug('CloudWatch Dashboard pricing calculation started', {
      region,
      logicalId: resource.logicalId,
    });

    try {
      const normalizedRegion = normalizeRegion(region);

      const dashboardPrice = await pricingClient.getPrice({
        serviceCode: 'AmazonCloudWatch',
        region: normalizedRegion,
        filters: [
          { field: 'productFamily', value: 'Dashboard' },
        ],
      });

      Logger.debug('CloudWatch Dashboard price retrieved', {
        dashboardPrice,
        region: normalizedRegion,
      });

      const price = dashboardPrice ?? this.FALLBACK_DASHBOARD_PRICE;
      const usedFallback = dashboardPrice === null;

      const assumptions: string[] = [];
      if (usedFallback) {
        assumptions.push('Using fallback pricing (API unavailable)');
      }
      assumptions.push(`CloudWatch dashboard: $${price.toFixed(2)}/month`);
      assumptions.push('First 3 dashboards with up to 50 metrics are free (not deducted)');

      return {
        amount: price,
        currency: 'USD',
        confidence: usedFallback ? 'low' : 'high',
        assumptions,
      };
    } catch (error) {
      Logger.debug('CloudWatch Dashboard pricing calculation failed', {
        error: error instanceof Error ? error.message : String(error),
        region,
      });

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to calculate CloudWatch Dashboard cost: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
}
