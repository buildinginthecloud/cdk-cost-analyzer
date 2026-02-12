import { Logger } from '../utils/Logger';

/**
 * Map of AWS region codes to Pricing API region names
 */
const REGION_MAP: Record<string, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'eu-west-1': 'EU (Ireland)',
  'eu-west-2': 'EU (London)',
  'eu-west-3': 'EU (Paris)',
  'eu-central-1': 'EU (Frankfurt)',
  'eu-central-2': 'EU (Zurich)',
  'eu-north-1': 'EU (Stockholm)',
  'eu-south-1': 'EU (Milan)',
  'eu-south-2': 'EU (Spain)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'ap-south-2': 'Asia Pacific (Hyderabad)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-southeast-3': 'Asia Pacific (Jakarta)',
  'ap-southeast-4': 'Asia Pacific (Melbourne)',
  'ap-southeast-5': 'Asia Pacific (Malaysia)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-northeast-3': 'Asia Pacific (Osaka)',
  'ap-east-1': 'Asia Pacific (Hong Kong)',
  'ca-central-1': 'Canada (Central)',
  'ca-west-1': 'Canada West (Calgary)',
  'sa-east-1': 'South America (Sao Paulo)',
  'me-south-1': 'Middle East (Bahrain)',
  'me-central-1': 'Middle East (UAE)',
  'af-south-1': 'Africa (Cape Town)',
  'il-central-1': 'Israel (Tel Aviv)',
};

/**
 * Map of AWS region codes to usagetype prefixes used in AWS Pricing API
 * Reference: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-region-billing-codes.html
 */
const REGION_PREFIX_MAP: Record<string, string> = {
  // US Regions
  'us-east-1': 'USE1',
  'us-east-2': 'USE2',
  'us-west-1': 'USW1',
  'us-west-2': 'USW2',
  // EU Regions
  'eu-west-1': 'EUW1',
  'eu-west-2': 'EUW2',
  'eu-west-3': 'EUW3',
  'eu-central-1': 'EUC1',
  'eu-central-2': 'EUC2',
  'eu-north-1': 'EUN1',
  'eu-south-1': 'EUS1',
  'eu-south-2': 'EUS2',
  // Asia Pacific Regions
  'ap-south-1': 'APS1',       // Mumbai
  'ap-south-2': 'APS2',       // Hyderabad
  'ap-southeast-1': 'APS3',   // Singapore
  'ap-southeast-2': 'APS4',   // Sydney
  'ap-southeast-3': 'APS5',   // Jakarta
  'ap-southeast-4': 'APS6',   // Melbourne
  'ap-southeast-5': 'APS7',   // Malaysia
  'ap-northeast-1': 'APN1',   // Tokyo
  'ap-northeast-2': 'APN2',   // Seoul
  'ap-northeast-3': 'APN3',   // Osaka
  'ap-east-1': 'APE1',        // Hong Kong
  // Canada Regions
  'ca-central-1': 'CAN1',
  'ca-west-1': 'CAW1',
  // South America Regions
  'sa-east-1': 'SAE1',
  // Middle East Regions
  'me-south-1': 'MES1',
  'me-central-1': 'MEC1',
  // Africa Regions
  'af-south-1': 'AFS1',
  // Israel Regions
  'il-central-1': 'ILC1',
  // AWS GovCloud Regions
  'us-gov-west-1': 'UGW1',
  'us-gov-east-1': 'UGE1',
  // EU Sovereign Cloud (ISOE)
  'eu-isoe-west-1': 'EIW1',
};

/**
 * Normalize AWS region code to Pricing API region name
 * Logs the normalization step when debug mode is enabled
 */
export function normalizeRegion(region: string): string {
  const normalized = REGION_MAP[region] || region;
  Logger.logRegionNormalization(region, normalized);
  return normalized;
}

/**
 * Get the AWS region prefix for pricing usagetype values.
 * AWS uses region prefixes in usagetype values (e.g., USE1-ApiGatewayRequest).
 * Reference: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-region-billing-codes.html
 *
 * @param region - AWS region code (e.g., 'us-east-1', 'eu-west-1')
 * @returns The usagetype prefix for the region, or empty string for unknown regions
 */
export function getRegionPrefix(region: string): string {
  return REGION_PREFIX_MAP[region] || '';
}
