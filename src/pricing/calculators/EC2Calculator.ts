import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class EC2Calculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::EC2::Instance';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const instanceType = resource.properties.InstanceType as string;

    if (!instanceType) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: ['Instance type not specified'],
      };
    }

    try {
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: normalizeRegion(region),
        filters: [
          { field: 'instanceType', value: instanceType },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });

      if (hourlyRate === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Pricing data not available for instance type ${instanceType} in region ${region}`],
        };
      }

      const monthlyHours = 730;
      const monthlyCost = hourlyRate * monthlyHours;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          `Assumes ${monthlyHours} hours per month (24/7 operation)`,
          'Assumes Linux OS, shared tenancy, on-demand pricing',
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
