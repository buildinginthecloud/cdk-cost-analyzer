import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';

export class VPCEndpointCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_DATA_PROCESSED_GB = 100;
  private readonly HOURS_PER_MONTH = 730;

  constructor(private customDataProcessedGB?: number) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::EC2::VPCEndpoint';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const explicitEndpointType = resource.properties?.VpcEndpointType as string | undefined;
    const serviceName = (resource.properties?.ServiceName as string | undefined) || '';

    // Determine if this is a Gateway endpoint
    // Priority: explicit type > inferred from service name
    const isGatewayEndpoint =
      explicitEndpointType === 'Gateway' ||
      (explicitEndpointType === undefined &&
        (serviceName.includes('s3') || serviceName.includes('dynamodb')));

    // Gateway endpoints (S3 and DynamoDB) are free
    if (isGatewayEndpoint) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          'Gateway VPC endpoints for S3 and DynamoDB are free',
          'No data processing charges for gateway endpoints',
        ],
      };
    }

    // Interface endpoints have hourly and data processing costs
    try {
      const regionPrefix = getRegionPrefix(region);
      
      // Get hourly rate per endpoint
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonVPC',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'VpcEndpoint' },
          { field: 'usagetype', value: `${regionPrefix}VpcEndpoint-Hours` },
        ],
      });

      // Get data processing rate
      const dataProcessingRate = await pricingClient.getPrice({
        serviceCode: 'AmazonVPC',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'VpcEndpoint' },
          { field: 'usagetype', value: `${regionPrefix}VpcEndpoint-Bytes` },
        ],
      });

      if (hourlyRate === null || dataProcessingRate === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for VPC Endpoint in region ${region}`,
          ],
        };
      }

      const dataProcessedGB = this.customDataProcessedGB || this.DEFAULT_DATA_PROCESSED_GB;
      const hourlyCost = hourlyRate * this.HOURS_PER_MONTH;
      const dataProcessingCost = dataProcessingRate * dataProcessedGB;
      const totalCost = hourlyCost + dataProcessingCost;

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          'Interface VPC Endpoint type',
          `Hourly rate: $${hourlyRate.toFixed(4)}/hour × ${this.HOURS_PER_MONTH} hours = $${hourlyCost.toFixed(2)}/month`,
          `Data processing: $${dataProcessingRate.toFixed(4)}/GB × ${dataProcessedGB} GB = $${dataProcessingCost.toFixed(2)}/month`,
          `Total: $${totalCost.toFixed(2)}/month`,
        ],
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
}
