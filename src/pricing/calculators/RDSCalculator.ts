import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class RDSCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_STORAGE_GB = 100;

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::RDS::DBInstance';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const instanceClass = resource.properties.DBInstanceClass as string;
    const engine = resource.properties.Engine as string;

    if (!instanceClass || !engine) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: ['DB instance class or engine not specified'],
      };
    }

    try {
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonRDS',
        region: normalizeRegion(region),
        filters: [
          { field: 'instanceType', value: instanceClass },
          { field: 'databaseEngine', value: this.normalizeEngine(engine) },
          { field: 'deploymentOption', value: 'Single-AZ' },
        ],
      });

      const storagePrice = await pricingClient.getPrice({
        serviceCode: 'AmazonRDS',
        region: normalizeRegion(region),
        filters: [
          { field: 'volumeType', value: 'General Purpose' },
          { field: 'databaseEngine', value: this.normalizeEngine(engine) },
        ],
      });

      if (hourlyRate === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Pricing data not available for instance class ${instanceClass} in region ${region}`],
        };
      }

      const monthlyHours = 730;
      const instanceCost = hourlyRate * monthlyHours;
      const storageCost = (storagePrice || 0) * this.DEFAULT_STORAGE_GB;
      const totalCost = instanceCost + storageCost;

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          `Assumes ${monthlyHours} hours per month (24/7 operation)`,
          `Assumes ${this.DEFAULT_STORAGE_GB} GB of General Purpose (gp2) storage`,
          'Assumes Single-AZ deployment',
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

  private normalizeEngine(engine: string): string {
    const engineMap: Record<string, string> = {
      'mysql': 'MySQL',
      'postgres': 'PostgreSQL',
      'mariadb': 'MariaDB',
      'oracle-se2': 'Oracle',
      'sqlserver-ex': 'SQL Server',
      'aurora-mysql': 'Aurora MySQL',
      'aurora-postgresql': 'Aurora PostgreSQL',
    };

    return engineMap[engine.toLowerCase()] || engine;
  }

}
