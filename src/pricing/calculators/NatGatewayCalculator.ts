import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

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
      // Get hourly rate
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'NAT Gateway' },
          { field: 'usagetype', value: `${this.getRegionPrefix(region)}NatGateway-Hours` },
        ],
      });

      // Get data processing rate
      const dataProcessingRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'NAT Gateway' },
          { field: 'usagetype', value: `${this.getRegionPrefix(region)}NatGateway-Bytes` },
        ],
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
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private normalizeRegion(region: string): string {
    const regionMap: Record<string, string> = {
      'us-east-1': 'US East (N. Virginia)',
      'us-east-2': 'US East (Ohio)',
      'us-west-1': 'US West (N. California)',
      'us-west-2': 'US West (Oregon)',
      'eu-west-1': 'EU (Ireland)',
      'eu-west-2': 'EU (London)',
      'eu-west-3': 'EU (Paris)',
      'eu-central-1': 'EU (Frankfurt)',
      'eu-north-1': 'EU (Stockholm)',
      'ap-south-1': 'Asia Pacific (Mumbai)',
      'ap-southeast-1': 'Asia Pacific (Singapore)',
      'ap-southeast-2': 'Asia Pacific (Sydney)',
      'ap-northeast-1': 'Asia Pacific (Tokyo)',
      'ap-northeast-2': 'Asia Pacific (Seoul)',
    };

    return regionMap[region] || region;
  }

  private getRegionPrefix(region: string): string {
    // AWS uses region prefixes in usage types (e.g., USE1 for us-east-1)
    const prefixMap: Record<string, string> = {
      'us-east-1': 'USE1',
      'us-east-2': 'USE2',
      'us-west-1': 'USW1',
      'us-west-2': 'USW2',
      'eu-west-1': 'EUW1',
      'eu-west-2': 'EUW2',
      'eu-west-3': 'EUW3',
      'eu-central-1': 'EUC1',
      'eu-north-1': 'EUN1',
      'ap-south-1': 'APS1',
      'ap-southeast-1': 'APS2',
      'ap-southeast-2': 'APS3',
      'ap-northeast-1': 'APN1',
      'ap-northeast-2': 'APN2',
    };

    return prefixMap[region] || '';
  }
}
