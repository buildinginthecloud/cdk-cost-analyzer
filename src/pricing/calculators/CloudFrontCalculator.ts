import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

/**
 * Calculator for AWS CloudFront distribution costs.
 *
 * Estimates monthly costs based on data transfer and request volumes.
 * CloudFront pricing includes:
 * - Data transfer out to internet (per GB)
 * - HTTP/HTTPS requests (per 10,000 requests)
 *
 * @see https://aws.amazon.com/cloudfront/pricing/
 */
export class CloudFrontCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_DATA_TRANSFER_GB = 100;
  private readonly DEFAULT_REQUESTS = 1000000;

  /**
   * Creates a CloudFront cost calculator.
   *
   * @param dataTransferGB - Optional custom data transfer volume in GB per month
   * @param requests - Optional custom request count per month
   */
  constructor(
    private readonly dataTransferGB?: number,
    private readonly requests?: number,
  ) {}

  /**
   * Checks if this calculator supports the given resource type.
   *
   * @param resourceType - CloudFormation resource type
   * @returns true if resource type is AWS::CloudFront::Distribution
   */
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::CloudFront::Distribution';
  }

  /**
   * Calculates monthly cost for a CloudFront distribution.
   *
   * Cost components:
   * - Data transfer out to internet (based on volume in GB)
   * - HTTP/HTTPS requests (per 10,000 requests)
   *
   * Default assumptions:
   * - 100 GB data transfer per month
   * - 1,000,000 requests per month
   *
   * @param _resource - CloudFormation resource (properties not used for CloudFront)
   * @param region - AWS region for pricing (CloudFront is global but pricing varies by region)
   * @param pricingClient - Client for querying AWS Pricing API
   * @returns Monthly cost estimate with assumptions and confidence level
   */
  async calculateCost(
    _resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const dataTransfer = this.dataTransferGB ?? this.DEFAULT_DATA_TRANSFER_GB;
    const requestCount = this.requests ?? this.DEFAULT_REQUESTS;

    try {
      // Query pricing for data transfer out to internet
      const dataTransferPrice = await pricingClient.getPrice({
        serviceCode: 'AmazonCloudFront',
        region: normalizeRegion(region),
        filters: [{ field: 'transferType', value: 'CloudFront to Internet' }],
      });

      // Query pricing for HTTP/HTTPS requests
      const requestPrice = await pricingClient.getPrice({
        serviceCode: 'AmazonCloudFront',
        region: normalizeRegion(region),
        filters: [{ field: 'requestType', value: 'HTTP-Requests' }],
      });

      if (dataTransferPrice === null || requestPrice === null) {
        const assumptions = [
          `Pricing data not available for CloudFront in region ${region}`,
          `Would assume ${dataTransfer} GB of data transfer out to internet`,
          `Would assume ${requestCount.toLocaleString()} HTTP/HTTPS requests per month`,
        ];

        if (this.dataTransferGB !== undefined) {
          assumptions.push(
            `Using custom data transfer assumption: ${dataTransfer} GB from configuration`,
          );
        }
        if (this.requests !== undefined) {
          assumptions.push(
            `Using custom request count assumption: ${requestCount.toLocaleString()} requests from configuration`,
          );
        }

        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions,
        };
      }

      // Calculate costs
      const dataTransferCost = dataTransfer * dataTransferPrice;
      const requestCost = (requestCount / 10000) * requestPrice; // Pricing is per 10,000 requests

      const totalCost = dataTransferCost + requestCost;

      const assumptions = [
        `Assumes ${dataTransfer} GB of data transfer out to internet`,
        `Assumes ${requestCount.toLocaleString()} HTTP/HTTPS requests per month`,
      ];

      if (this.dataTransferGB !== undefined) {
        assumptions.push(
          `Using custom data transfer assumption: ${dataTransfer} GB from configuration`,
        );
      }
      if (this.requests !== undefined) {
        assumptions.push(
          `Using custom request count assumption: ${requestCount.toLocaleString()} requests from configuration`,
        );
      }

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions,
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Normalizes AWS region code to AWS Pricing API region name.
   *
   * CloudFront is a global service, but pricing varies by region and the
   * AWS Pricing API requires region names in specific format.
   *
   * @param region - AWS region code (e.g., 'us-east-1')
   * @returns AWS Pricing API region name (e.g., 'US East (N. Virginia)')
   */
}
