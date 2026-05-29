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
export class WAFCalculator implements ResourceCostCalculator {
  private readonly WEB_ACL_COST = 5.00;
  private readonly RULE_COST_PER_RULE = 1.00;
  private readonly REQUEST_COST_PER_MILLION = 0.60;
  private readonly DEFAULT_REQUESTS_PER_MONTH = 1_000_000;

  /**
   * Creates a WAF cost calculator.
   *
   * @param customRequestsPerMonth - Optional custom monthly request count
   */
  constructor(private readonly customRequestsPerMonth?: number) {}

  /**
   * Checks if this calculator supports the given resource type.
   *
   * @param resourceType - CloudFormation resource type
   * @returns true if resource type is AWS::WAFv2::WebACL
   */
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::WAFv2::WebACL';
  }

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
  async calculateCost(
    resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const rules = (resource.properties.Rules as unknown[])?.length ?? 0;
    const requests = this.customRequestsPerMonth ?? this.DEFAULT_REQUESTS_PER_MONTH;

    const webACLCost = this.WEB_ACL_COST;
    const rulesCost = rules * this.RULE_COST_PER_RULE;
    const requestCost = (requests / 1_000_000) * this.REQUEST_COST_PER_MILLION;
    const totalCost = webACLCost + rulesCost + requestCost;

    const assumptions = [
      `Web ACL fixed cost: $${webACLCost.toFixed(2)}/month`,
      `Rules: ${rules} × $${this.RULE_COST_PER_RULE.toFixed(2)}/rule = $${rulesCost.toFixed(2)}/month`,
      `Requests: ${requests.toLocaleString()} × $${this.REQUEST_COST_PER_MILLION}/million = $${requestCost.toFixed(2)}/month`,
      'Using fixed pricing model (WAF pricing is uniform across regions)',
    ];

    if (this.customRequestsPerMonth !== undefined) {
      assumptions.push(
        `Using custom request count assumption: ${requests.toLocaleString()} requests from configuration`,
      );
    }

    return {
      amount: totalCost,
      currency: 'USD',
      confidence: 'medium',
      assumptions,
    };
  }
}
