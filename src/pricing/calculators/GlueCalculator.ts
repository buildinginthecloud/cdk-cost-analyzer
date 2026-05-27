import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

/**
 * Calculator for AWS Glue job and crawler costs.
 *
 * Estimates monthly costs based on DPU-hours consumed.
 * Glue pricing includes:
 * - ETL jobs and crawlers: $0.44 per DPU-hour
 *
 * @see https://aws.amazon.com/glue/pricing/
 */
export class GlueCalculator implements ResourceCostCalculator {
  private readonly DPU_HOUR_COST = 0.44;
  private readonly DEFAULT_DPU_HOURS_PER_MONTH = 100;

  /**
   * Creates a Glue cost calculator.
   *
   * @param customDPUHoursPerMonth - Optional custom DPU-hours per month
   */
  constructor(private readonly customDPUHoursPerMonth?: number) {}

  /**
   * Checks if this calculator supports the given resource type.
   *
   * @param resourceType - CloudFormation resource type
   * @returns true if resource type is AWS::Glue::Job or AWS::Glue::Crawler
   */
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::Glue::Job' || resourceType === 'AWS::Glue::Crawler';
  }

  /**
   * Calculates monthly cost for a Glue job or crawler.
   *
   * Cost components:
   * - DPU-hours: $0.44 per DPU-hour
   *
   * Default assumptions:
   * - 100 DPU-hours per month
   * - Data Catalog: first 1M objects and requests are free
   *
   * @param _resource - CloudFormation resource (properties not used for Glue)
   * @param _region - AWS region (not used for Glue fallback pricing)
   * @param _pricingClient - Pricing client (not called for Glue fallback pricing)
   * @returns Monthly cost estimate with assumptions and confidence level
   */
  async calculateCost(
    _resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const dpuHours = this.customDPUHoursPerMonth ?? this.DEFAULT_DPU_HOURS_PER_MONTH;
    const cost = dpuHours * this.DPU_HOUR_COST;

    const assumptions = [
      `DPU-hours per month: ${dpuHours}`,
      `DPU-hour rate: $${this.DPU_HOUR_COST}/DPU-hour`,
      `Cost: ${dpuHours} DPU-hours × $${this.DPU_HOUR_COST} = $${cost.toFixed(2)}/month`,
      'Using fixed fallback pricing (Glue Pricing API is complex)',
      'Data Catalog: first 1M objects and requests are free (not included)',
    ];

    if (this.customDPUHoursPerMonth !== undefined) {
      assumptions.push(
        `Using custom DPU-hours assumption: ${dpuHours} DPU-hours from configuration`,
      );
    }

    return {
      amount: cost,
      currency: 'USD',
      confidence: 'medium',
      assumptions,
    };
  }
}
