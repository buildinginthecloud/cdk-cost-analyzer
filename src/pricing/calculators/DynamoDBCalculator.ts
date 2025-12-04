import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class DynamoDBCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::DynamoDB::Table';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient
  ): Promise<MonthlyCost> {
    const billingMode = (resource.properties.BillingMode as string) || 'PROVISIONED';
    
    if (billingMode === 'PAY_PER_REQUEST') {
      return this.calculateOnDemandCost(resource, region, pricingClient);
    } else {
      return this.calculateProvisionedCost(resource, region, pricingClient);
    }
  }

  private async calculateOnDemandCost(
    _resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient
  ): Promise<MonthlyCost> {
    try {
      // Default assumptions for on-demand mode
      const assumedReadRequests = 10_000_000; // 10M read requests per month
      const assumedWriteRequests = 1_000_000; // 1M write requests per month

      const readCostPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'group', value: 'DDB-ReadUnits' },
          { field: 'groupDescription', value: 'OnDemand ReadRequestUnits' },
        ],
      });

      const writeCostPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'group', value: 'DDB-WriteUnits' },
          { field: 'groupDescription', value: 'OnDemand WriteRequestUnits' },
        ],
      });

      if (readCostPerMillion === null || writeCostPerMillion === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: ['Pricing data not available for DynamoDB on-demand mode'],
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
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private async calculateProvisionedCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient
  ): Promise<MonthlyCost> {
    try {
      const provisionedThroughput = resource.properties.ProvisionedThroughput as any;
      const readCapacity = provisionedThroughput?.ReadCapacityUnits || 5;
      const writeCapacity = provisionedThroughput?.WriteCapacityUnits || 5;

      const readCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'group', value: 'DDB-ReadUnits' },
          { field: 'groupDescription', value: 'Provisioned ReadCapacityUnit-Hrs' },
        ],
      });

      const writeCostPerHour = await pricingClient.getPrice({
        serviceCode: 'AmazonDynamoDB',
        region: this.normalizeRegion(region),
        filters: [
          { field: 'group', value: 'DDB-WriteUnits' },
          { field: 'groupDescription', value: 'Provisioned WriteCapacityUnit-Hrs' },
        ],
      });

      if (readCostPerHour === null || writeCostPerHour === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: ['Pricing data not available for DynamoDB provisioned mode'],
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
}
