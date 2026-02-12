import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';
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
      const regionPrefix = getRegionPrefix(region);
      
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
          { field: 'usagetype', value: `${regionPrefix}-RegionalNatGateway-Hours` },
        ],
      });

      Logger.debug('NAT Gateway hourly rate retrieved', {
        hourlyRate,
        usageType: `${regionPrefix}-RegionalNatGateway-Hours`,
      });

      // Get data processing rate
      const dataProcessingRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'NAT Gateway' },
          { field: 'usagetype', value: `${regionPrefix}-RegionalNatGateway-Bytes` },
        ],
      });

      Logger.debug('NAT Gateway data processing rate retrieved', {
        dataProcessingRate,
        usageType: `${regionPrefix}-RegionalNatGateway-Bytes`,
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
}
