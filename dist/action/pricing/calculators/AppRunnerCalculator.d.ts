import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
/**
 * Calculator for AWS App Runner service costs.
 *
 * NOTE: AWS App Runner is in maintenance mode as of 2026. No new customers
 * are accepted after April 30, 2026. Existing services continue to operate.
 * The AWS-recommended replacement is Amazon ECS Express Mode.
 *
 * @see https://aws.amazon.com/apprunner/pricing/
 */
export declare class AppRunnerCalculator implements ResourceCostCalculator {
    private readonly customRequestsPerMonth?;
    private readonly customHoursPerMonth?;
    private readonly VCPU_HOURLY_RATE;
    private readonly MEMORY_HOURLY_RATE;
    private readonly REQUEST_RATE_PER_MILLION;
    private readonly DEFAULT_REQUESTS_PER_MONTH;
    constructor(customRequestsPerMonth?: number | undefined, customHoursPerMonth?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, _region: string, _pricingClient: PricingClient): Promise<MonthlyCost>;
    private parseCPU;
    private parseMemory;
}
