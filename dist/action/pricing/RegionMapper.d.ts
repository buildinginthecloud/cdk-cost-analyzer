/**
 * Normalize AWS region code to Pricing API region name
 * Logs the normalization step when debug mode is enabled
 */
export declare function normalizeRegion(region: string): string;
/**
 * Get the AWS region prefix for pricing usagetype values.
 * AWS uses region prefixes in usagetype values (e.g., USE1-ApiGatewayRequest).
 * Reference: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-region-billing-codes.html
 *
 * @param region - AWS region code (e.g., 'us-east-1', 'eu-west-1')
 * @returns The usagetype prefix for the region, or empty string for unknown regions
 */
export declare function getRegionPrefix(region: string): string;
