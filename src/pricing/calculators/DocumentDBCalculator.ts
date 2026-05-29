import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { calculateDatabaseInstanceCost } from './internal/databaseInstanceCost';

const DEFAULT_INSTANCE_CLASS = 'db.r6g.large';
const FALLBACK_HOURLY_RATE = 0.24;

export class DocumentDBCalculator implements ResourceCostCalculator {
  constructor(private readonly customStorageGB?: number) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::DocDB::DBCluster' ||
      resourceType === 'AWS::DocDB::DBInstance'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    if (resource.type === 'AWS::DocDB::DBCluster') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          'DocumentDB cluster cost is calculated on individual AWS::DocDB::DBInstance resources',
        ],
      };
    }

    return calculateDatabaseInstanceCost(resource, region, pricingClient, {
      serviceCode: 'AmazonDocDB',
      defaultInstanceClass: DEFAULT_INSTANCE_CLASS,
      fallbackHourlyRate: FALLBACK_HOURLY_RATE,
      productFamily: 'Database Instance',
      customStorageGB: this.customStorageGB,
    });
  }
}
