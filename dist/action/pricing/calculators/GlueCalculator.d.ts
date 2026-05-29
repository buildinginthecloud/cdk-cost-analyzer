import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
/**
 * Calculator for AWS Glue job and crawler costs.
 *
 * Estimates monthly costs based on DPU-hours consumed:
 *   DPUs × hoursPerMonth × $0.44/DPU-hour
 *
 * DPUs are derived from CloudFormation properties when available:
 * - Jobs: `WorkerType` + `NumberOfWorkers`, or legacy `MaxCapacity`
 * - Crawlers: not in the resource properties — defaults to 2 DPU
 *
 * @see https://aws.amazon.com/glue/pricing/
 */
export declare class GlueCalculator implements ResourceCostCalculator {
    private readonly customHoursPerMonth?;
    private readonly DPU_HOUR_COST;
    private readonly DEFAULT_HOURS_PER_MONTH;
    /**
     * @param customHoursPerMonth - Hours per month the job/crawler runs (default: 50)
     */
    constructor(customHoursPerMonth?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, _region: string, _pricingClient: PricingClient): Promise<MonthlyCost>;
    private resolveDpus;
}
