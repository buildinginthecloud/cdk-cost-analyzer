import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';
import { Logger } from '../../utils/Logger';

export class NatGatewayCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_DATA_PROCESSED_GB = 100;
  private readonly HOURS_PER_MONTH = 730;

  constructor(private customDataProcessedGB?: number) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::EC2::NatGateway';
  }

  async calculateCost(
    _resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const regionPrefix = this.getRegionPrefix(region);
      
      Logger.debug('NAT Gateway pricing calculation started', {
        region,
        regionPrefix,
        normalizedRegion: normalizeRegion(region),
        dataProcessedGB: this.customDataProcessedGB || this.DEFAULT_DATA_PROCESSED_GB,
      });
      
      // Get hourly rate
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'NAT Gateway' },
          { field: 'usagetype', value: `${regionPrefix}NatGateway-Hours` },
        ],
      });

      Logger.debug('NAT Gateway hourly rate retrieved', {
        hourlyRate,
        usageType: `${regionPrefix}NatGateway-Hours`,
      });

      // Get data processing rate
      const dataProcessingRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'NAT Gateway' },
          { field: 'usagetype', value: `${regionPrefix}NatGateway-Bytes` },
        ],
      });

      Logger.debug('NAT Gateway data processing rate retrieved', {
        dataProcessingRate,
        usageType: `${regionPrefix}NatGateway-Bytes`,
      });

      if (hourlyRate === null || dataProcessingRate === null) {
        const dataProcessedGB = this.customDataProcessedGB || this.DEFAULT_DATA_PROCESSED_GB;
        const assumptions = [
          `Pricing data not available for NAT Gateway in region ${region}`,
          `Would assume ${dataProcessedGB} GB of data processing per month`,
          `Would assume ${this.HOURS_PER_MONTH} hours per month`,
        ];

        if (this.customDataProcessedGB !== undefined) {
          assumptions.push('Using custom data processing assumption from configuration');
        }

        Logger.debug('NAT Gateway pricing not available', {
          region,
          regionPrefix,
          hourlyRateAvailable: hourlyRate !== null,
          dataProcessingRateAvailable: dataProcessingRate !== null,
        });

        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions,
        };
      }

      const dataProcessedGB = this.customDataProcessedGB || this.DEFAULT_DATA_PROCESSED_GB;
      const hourlyCost = hourlyRate * this.HOURS_PER_MONTH;
      const dataProcessingCost = dataProcessingRate * dataProcessedGB;
      const totalCost = hourlyCost + dataProcessingCost;

      Logger.debug('NAT Gateway cost calculated', {
        hourlyRate,
        dataProcessingRate,
        dataProcessedGB,
        hourlyCost,
        dataProcessingCost,
        totalCost,
      });

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Hourly rate: $${hourlyRate.toFixed(4)}/hour × ${this.HOURS_PER_MONTH} hours = $${hourlyCost.toFixed(2)}/month`,
          `Data processing: $${dataProcessingRate.toFixed(4)}/GB × ${dataProcessedGB} GB = $${dataProcessingCost.toFixed(2)}/month`,
          `Total: $${totalCost.toFixed(2)}/month`,
        ],
      };
    } catch (error) {
      Logger.debug('NAT Gateway pricing calculation failed', {
        error: error instanceof Error ? error.message : String(error),
        region,
      });
      
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }


  private getRegionPrefix(region: string): string {
    // AWS uses region prefixes in usage types for NAT Gateway
    // Format: {PREFIX}NatGateway-Hours or {PREFIX}NatGateway-Bytes
    // Reference: https://cur.vantage.sh/aws/nat-gateways/
    const prefixMap: Record<string, string> = {
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
      'ap-south-1': 'APS1',
      'ap-south-2': 'APS2',
      'ap-southeast-1': 'APS3',
      'ap-southeast-2': 'APS4',
      'ap-southeast-3': 'APS5',
      'ap-southeast-4': 'APS6',
      'ap-northeast-1': 'APN1',
      'ap-northeast-2': 'APN2',
      'ap-northeast-3': 'APN3',
      'ap-east-1': 'APE1',
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
      // Other Regions
      'ap-southeast-5': 'APS7',
      'eu-isoe-west-1': 'EIW1',
      'us-gov-west-1': 'UGW1',
      'us-gov-east-1': 'UGE1',
    };

    return prefixMap[region] || '';
  }
}
