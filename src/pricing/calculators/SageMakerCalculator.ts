import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class SageMakerCalculator implements ResourceCostCalculator {
  private readonly FALLBACK_ENDPOINT_HOURLY = 0.269; // ml.m5.large
  private readonly FALLBACK_NOTEBOOK_HOURLY = 0.0582; // ml.t3.medium

  constructor(private readonly customHoursPerMonth?: number) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::SageMaker::Endpoint' ||
      resourceType === 'AWS::SageMaker::NotebookInstance'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      switch (resource.type) {
        case 'AWS::SageMaker::Endpoint':
          return this.calculateEndpointCost(resource);
        case 'AWS::SageMaker::NotebookInstance':
          return await this.calculateNotebookCost(resource, region, pricingClient);
        default:
          return {
            amount: 0,
            currency: 'USD',
            confidence: 'unknown',
            assumptions: [`Unsupported SageMaker resource type: ${resource.type}`],
          };
      }
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private calculateEndpointCost(_resource: ResourceWithId): MonthlyCost {
    const hours = this.customHoursPerMonth ?? 730;
    const cost = this.FALLBACK_ENDPOINT_HOURLY * hours;

    return {
      amount: cost,
      currency: 'USD',
      confidence: 'low',
      assumptions: [
        'Instance type assumed ml.m5.large',
        `ml.m5.large: $${this.FALLBACK_ENDPOINT_HOURLY}/hour × ${hours} hours = $${cost.toFixed(2)}/month`,
        'Actual cost depends on endpoint configuration and instance type',
        'Instance type cannot be read from Endpoint resource - it is defined on the linked EndpointConfig',
      ],
    };
  }

  private async calculateNotebookCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const instanceType = (resource.properties.InstanceType as string) ?? 'ml.t3.medium';
    const hours = this.customHoursPerMonth ?? 730;

    const apiRate = await pricingClient.getPrice({
      serviceCode: 'AmazonSageMaker',
      region: normalizeRegion(region),
      filters: [{ field: 'instanceType', value: instanceType }],
    });

    const rate = apiRate ?? this.FALLBACK_NOTEBOOK_HOURLY;
    const cost = rate * hours;
    const usedFallback = apiRate === null;

    return {
      amount: cost,
      currency: 'USD',
      confidence: usedFallback ? 'medium' : 'high',
      assumptions: [
        `Notebook instance type: ${instanceType}`,
        `$${rate.toFixed(4)}/hour × ${hours} hours = $${cost.toFixed(2)}/month`,
        ...(usedFallback ? [`Using fallback pricing (API data not available for region ${region})`] : []),
      ],
    };
  }
}
