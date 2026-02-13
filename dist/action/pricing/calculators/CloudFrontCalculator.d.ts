import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
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
export declare class CloudFrontCalculator implements ResourceCostCalculator {
    private readonly dataTransferGB?;
    private readonly requests?;
    private readonly DEFAULT_DATA_TRANSFER_GB;
    private readonly DEFAULT_REQUESTS;
    /**
     * Creates a CloudFront cost calculator.
     *
     * @param dataTransferGB - Optional custom data transfer volume in GB per month
     * @param requests - Optional custom request count per month
     */
    constructor(dataTransferGB?: number | undefined, requests?: number | undefined);
    /**
     * Checks if this calculator supports the given resource type.
     *
     * @param resourceType - CloudFormation resource type
     * @returns true if resource type is AWS::CloudFront::Distribution
     */
    supports(resourceType: string): boolean;
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
    calculateCost(_resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
