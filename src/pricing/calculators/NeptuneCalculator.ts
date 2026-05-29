import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { calculateDatabaseInstanceCost } from './internal/databaseInstanceCost';

const DEFAULT_INSTANCE_CLASS = 'db.r5.large';
const FALLBACK_HOURLY_RATE = 0.348;

export class NeptuneCalculator implements ResourceCostCalculator {
  constructor(private readonly customStorageGB?: number) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::Neptune::DBCluster' ||
      resourceType === 'AWS::Neptune::DBInstance'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    if (resource.type === 'AWS::Neptune::DBCluster') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          'Neptune cluster cost is calculated on individual AWS::Neptune::DBInstance resources',
        ],
      };
    }

    return calculateDatabaseInstanceCost(resource, region, pricingClient, {
      serviceCode: 'AmazonNeptune',
      defaultInstanceClass: DEFAULT_INSTANCE_CLASS,
      fallbackHourlyRate: FALLBACK_HOURLY_RATE,
      productFamily: 'Database Instance',
      customStorageGB: this.customStorageGB,
    });
  }
}
