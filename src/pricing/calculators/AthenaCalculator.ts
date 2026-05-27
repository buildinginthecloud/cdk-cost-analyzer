import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

/**
 * Calculator for Amazon Athena WorkGroup and NamedQuery costs.
 *
 * Estimates monthly costs based on data scanned.
 * Athena pricing includes:
 * - $5.00 per TB of data scanned
 * - DDL queries are free
 * - NamedQuery resources have no direct cost
 *
 * @see https://aws.amazon.com/athena/pricing/
 */
export class AthenaCalculator implements ResourceCostCalculator {
  private readonly COST_PER_TB_SCANNED = 5.00;
  private readonly DEFAULT_TB_SCANNED_PER_MONTH = 1;

  /**
   * Creates an Athena cost calculator.
   *
   * @param customTBScannedPerMonth - Optional custom TB of data scanned per month
   */
  constructor(private readonly customTBScannedPerMonth?: number) {}

  /**
   * Checks if this calculator supports the given resource type.
   *
   * @param resourceType - CloudFormation resource type
   * @returns true if resource type is AWS::Athena::WorkGroup or AWS::Athena::NamedQuery
   */
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::Athena::WorkGroup' || resourceType === 'AWS::Athena::NamedQuery';
  }

  /**
   * Calculates monthly cost for an Athena WorkGroup or NamedQuery.
   *
   * For NamedQuery resources: returns $0 cost since named queries have no direct cost.
   * For WorkGroup resources: calculates based on TB of data scanned.
   *
   * Cost components (WorkGroup):
   * - Data scanned: $5.00 per TB scanned
   *
   * Default assumptions (WorkGroup):
   * - 1 TB scanned per month
   * - DDL queries are free
   *
   * @param resource - CloudFormation resource (type used to distinguish WorkGroup vs NamedQuery)
   * @param _region - AWS region (not used for Athena fallback pricing)
   * @param _pricingClient - Pricing client (not called for Athena fallback pricing)
   * @returns Monthly cost estimate with assumptions and confidence level
   */
  async calculateCost(
    resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    if (resource.type === 'AWS::Athena::NamedQuery') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          'Named queries have no direct cost - cost is incurred at query execution time',
        ],
      };
    }

    // WorkGroup resource
    const tbScanned = this.customTBScannedPerMonth ?? this.DEFAULT_TB_SCANNED_PER_MONTH;
    const cost = tbScanned * this.COST_PER_TB_SCANNED;

    const assumptions = [
      `TB of data scanned per month: ${tbScanned}`,
      `Rate: $${this.COST_PER_TB_SCANNED}/TB scanned`,
      `Cost: ${tbScanned} TB × $${this.COST_PER_TB_SCANNED} = $${cost.toFixed(2)}/month`,
      'DDL queries are free (not included)',
      'Using fixed fallback pricing (Athena Pricing API is complex)',
    ];

    if (this.customTBScannedPerMonth !== undefined) {
      assumptions.push(
        `Using custom TB scanned assumption: ${tbScanned} TB from configuration`,
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
