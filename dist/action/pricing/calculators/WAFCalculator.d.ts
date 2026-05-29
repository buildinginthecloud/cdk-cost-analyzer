import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
/**
 * Calculator for AWS WAFv2 Web ACL costs.
 *
 * Estimates monthly costs based on fixed rates for Web ACL, rules, and requests.
 * WAF pricing includes:
 * - Web ACL: $5.00/month (fixed)
 * - Rules: $1.00/month per rule
 * - Requests: $0.60 per million requests
 *
 * @see https://aws.amazon.com/waf/pricing/
 */
export declare class WAFCalculator implements ResourceCostCalculator {
    private readonly customRequestsPerMonth?;
    private readonly WEB_ACL_COST;
    private readonly RULE_COST_PER_RULE;
    private readonly REQUEST_COST_PER_MILLION;
    private readonly DEFAULT_REQUESTS_PER_MONTH;
    /**
     * Creates a WAF cost calculator.
     *
     * @param customRequestsPerMonth - Optional custom monthly request count
     */
    constructor(customRequestsPerMonth?: number | undefined);
    /**
     * Checks if this calculator supports the given resource type.
     *
     * @param resourceType - CloudFormation resource type
     * @returns true if resource type is AWS::WAFv2::WebACL
     */
    supports(resourceType: string): boolean;
    /**
     * Calculates monthly cost for a WAFv2 Web ACL.
     *
     * Cost components:
     * - Fixed Web ACL charge: $5.00/month
     * - Per rule charge: $1.00/month per rule
     * - Request charge: $0.60 per million requests
     *
     * Default assumptions:
     * - 0 rules (read from resource properties if available)
     * - 1,000,000 requests per month
     *
     * @param resource - CloudFormation resource (reads Rules array length)
     * @param _region - AWS region (not used; WAF pricing is uniform)
     * @param _pricingClient - Pricing client (not called; fixed pricing model)
     * @returns Monthly cost estimate with assumptions and confidence level
     */
    calculateCost(resource: ResourceWithId, _region: string, _pricingClient: PricingClient): Promise<MonthlyCost>;
}
