import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class APIGatewayCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::ApiGateway::RestApi' ||
           resourceType === 'AWS::ApiGatewayV2::Api';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const isV2 = resource.type === 'AWS::ApiGatewayV2::Api';
    const protocolType = isV2 ? (resource.properties.ProtocolType as string) : 'REST';

    if (protocolType === 'WEBSOCKET') {
      return this.calculateWebSocketCost(region, pricingClient);
    } else if (protocolType === 'HTTP') {
      return this.calculateHttpApiCost(region, pricingClient);
    } else {
      return this.calculateRestApiCost(region, pricingClient);
    }
  }

  private async calculateRestApiCost(
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const assumedRequests = 1_000_000; // 1M requests per month
      const regionPrefix = this.getRegionPrefix(region);
      const usageType = regionPrefix ? `${regionPrefix}-ApiGatewayRequest` : 'ApiGatewayRequest';

      const costPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'API Calls' },
          { field: 'usagetype', value: usageType },
        ],
      });

      if (costPerMillion === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: ['Pricing data not available for API Gateway REST API'],
        };
      }

      const monthlyCost = (assumedRequests / 1_000_000) * costPerMillion;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Assumes ${assumedRequests.toLocaleString()} REST API requests per month`,
          'REST API type',
          'Does not include data transfer, caching, or other features',
          'First 333M requests may have tiered pricing (not calculated)',
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

  private async calculateHttpApiCost(
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const assumedRequests = 1_000_000; // 1M requests per month
      const regionPrefix = this.getRegionPrefix(region);
      const usageType = regionPrefix ? `${regionPrefix}-ApiGatewayHttpRequest` : 'ApiGatewayHttpRequest';

      const costPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'API Calls' },
          { field: 'usagetype', value: usageType },
        ],
      });

      if (costPerMillion === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: ['Pricing data not available for API Gateway HTTP API'],
        };
      }

      const monthlyCost = (assumedRequests / 1_000_000) * costPerMillion;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Assumes ${assumedRequests.toLocaleString()} HTTP API requests per month`,
          'HTTP API type',
          'Does not include data transfer costs',
          'First 300M requests may have tiered pricing (not calculated)',
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

  private async calculateWebSocketCost(
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      const assumedMessages = 1_000_000; // 1M messages per month
      const assumedConnectionMinutes = 100_000; // 100K connection minutes
      const regionPrefix = this.getRegionPrefix(region);
      const messageUsageType = regionPrefix ? `${regionPrefix}-ApiGatewayMessage` : 'ApiGatewayMessage';
      const minuteUsageType = regionPrefix ? `${regionPrefix}-ApiGatewayMinute` : 'ApiGatewayMinute';

      const messageCostPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'WebSocket' },
          { field: 'usagetype', value: messageUsageType },
        ],
      });

      const connectionCostPerMinute = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'WebSocket' },
          { field: 'usagetype', value: minuteUsageType },
        ],
      });

      if (messageCostPerMillion === null || connectionCostPerMinute === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: ['Pricing data not available for API Gateway WebSocket API'],
        };
      }

      const messageCost = (assumedMessages / 1_000_000) * messageCostPerMillion;
      const connectionCost = assumedConnectionMinutes * connectionCostPerMinute;
      const monthlyCost = messageCost + connectionCost;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Assumes ${assumedMessages.toLocaleString()} WebSocket messages per month`,
          `Assumes ${assumedConnectionMinutes.toLocaleString()} connection minutes per month`,
          'WebSocket API type',
          'Does not include data transfer costs',
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

  /**
   * Get the AWS region prefix for API Gateway pricing usagetype.
   * AWS uses region prefixes in usagetype values (e.g., USE1-ApiGatewayRequest).
   * Reference: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-region-billing-codes.html
   */
  private getRegionPrefix(region: string): string {
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
      'ap-south-1': 'APS3',       // Mumbai
      'ap-south-2': 'APS5',       // Hyderabad
      'ap-southeast-1': 'APS1',   // Singapore
      'ap-southeast-2': 'APS2',   // Sydney
      'ap-southeast-3': 'APS6',   // Jakarta
      'ap-southeast-4': 'APS7',   // Melbourne
      'ap-northeast-1': 'APN1',   // Tokyo
      'ap-northeast-2': 'APN2',   // Seoul
      'ap-northeast-3': 'APN3',   // Osaka
      'ap-east-1': 'APE1',        // Hong Kong
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
      // GovCloud Regions
      'us-gov-west-1': 'UGW1',
      'us-gov-east-1': 'UGE1',
    };

    return prefixMap[region] || '';
  }
}
