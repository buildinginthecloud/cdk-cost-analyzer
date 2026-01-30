import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';
import { CostAnalyzerConfig } from '../../config/types';

export class DynamoDBCalculator implements ResourceCostCalculator {
  private config?: CostAnalyzerConfig;

  constructor(config?: CostAnalyzerConfig) {
    this.config = config;
  }

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::DynamoDB::Table';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const billingMode = (resource.properties.BillingMode as string) || 'PROVISIONED';
    const hasProvisionedThroughput = resource.properties.ProvisionedThroughput !== undefined;

    // Per requirement 1.4: When ProvisionedThroughput is defined, treat as provisioned mode
    if (hasProvisionedThroughput || billingMode === 'PROVISIONED') {
      return this.calculateProvisionedCost(resource, region, pricingClient);
    } else {
      return this.calculateOnDemandCost(resource, region, pricingClient);
    }
  }

  private getUsageAssumptions(): { readRequests: number; writeRequests: number } {
    return {
      readRequests: this.config?.usageAssumptions?.dynamodb?.readRequestsPerMonth ?? 10_000_000,
      writeRequests: this.config?.usageAssumptions?.dynamodb?.writeRequestsPerMonth ?? 1_000_000,
    };
  }

  private async calculateOnDemandCost(
    _resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      // Get usage assumptions from config or use defaults
      const { readRequests: assumedReadRequests, writeRequests: assumedWriteRequests } = this.getUsageAssumptions();

      // Normalize region for pricing queries
      const normalizedRegion = normalizeRegion(region);

      const readCostPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: normalizedRegion,
        filters: [
          { field: 'group', value: 'DDB-ReadUnits', type: 'TERM_MATCH' },
          { field: 'groupDescription', value: 'OnDemand ReadRequestUnits', type: 'TERM_MATCH' },
        ],
      });

      const writeCostPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: normalizedRegion,
        filters: [
          { field: 'group', value: 'DDB-WriteUnits', type: 'TERM_MATCH' },
          { field: 'groupDescription', value: 'OnDemand WriteRequestUnits', type: 'TERM_MATCH' },
        ],
      });

      if (readCostPerMillion === null || writeCostPerMillion === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            'Pricing data not available for DynamoDB on-demand mode',
            'On-demand billing mode',
          ],
        };
      }

      const readCost = (assumedReadRequests / 1_000_000) * readCostPerMillion;
      const writeCost = (assumedWriteRequests / 1_000_000) * writeCostPerMillion;
      const monthlyCost = readCost + writeCost;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Assumes ${assumedReadRequests.toLocaleString()} read requests per month`,
          `Assumes ${assumedWriteRequests.toLocaleString()} write requests per month`,
          'On-demand billing mode',
          'Does not include storage costs or other features (streams, backups, etc.)',
        ],
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
          'On-demand billing mode',
        ],
      };
    }
  }

  private async calculateProvisionedCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const provisionedThroughput = resource.properties.ProvisionedThroughput as any;
      const readCapacity = provisionedThroughput?.ReadCapacityUnits || 5;
      const writeCapacity = provisionedThroughput?.WriteCapacityUnits || 5;

      // Normalize region for pricing queries
      const normalizedRegion = normalizeRegion(region);

      const readCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: normalizedRegion,
        filters: [
          { field: 'usagetype', value: `${region}-ReadCapacityUnit-Hrs`, type: 'TERM_MATCH' },
        ],
      });

      const writeCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: normalizedRegion,
        filters: [
          { field: 'usagetype', value: `${region}-WriteCapacityUnit-Hrs`, type: 'TERM_MATCH' },
        ],
      });

      if (readCostPerHour === null || writeCostPerHour === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            'Pricing data not available for DynamoDB provisioned mode',
            'Provisioned billing mode',
          ],
        };
      }

      const hoursPerMonth = 730;
      const readCost = readCapacity * hoursPerMonth * readCostPerHour;
      const writeCost = writeCapacity * hoursPerMonth * writeCostPerHour;
      const monthlyCost = readCost + writeCost;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'high',
        assumptions: [
          `${readCapacity} provisioned read capacity units`,
          `${writeCapacity} provisioned write capacity units`,
          `Assumes ${hoursPerMonth} hours per month (24/7 operation)`,
          'Provisioned billing mode',
          'Does not include storage costs or other features (streams, backups, etc.)',
        ],
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
          'Provisioned billing mode',
        ],
      };
    }
  }

}
