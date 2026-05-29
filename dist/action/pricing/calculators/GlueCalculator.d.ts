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
export declare class GlueCalculator implements ResourceCostCalculator {
    private readonly customDPUHoursPerMonth?;
    private readonly DPU_HOUR_COST;
    private readonly DEFAULT_DPU_HOURS_PER_MONTH;
    /**
     * Creates a Glue cost calculator.
     *
     * @param customDPUHoursPerMonth - Optional custom DPU-hours per month
     */
    constructor(customDPUHoursPerMonth?: number | undefined);
    /**
     * Checks if this calculator supports the given resource type.
     *
     * @param resourceType - CloudFormation resource type
     * @returns true if resource type is AWS::Glue::Job or AWS::Glue::Crawler
     */
    supports(resourceType: string): boolean;
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
    calculateCost(_resource: ResourceWithId, _region: string, _pricingClient: PricingClient): Promise<MonthlyCost>;
}
