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

      const costPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'API Calls' },
          { field: 'groupDescription', value: 'ApiGatewayRequest' },
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

      const costPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'API Calls' },
          { field: 'groupDescription', value: 'ApiGatewayHttpRequest' },
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

      const messageCostPerMillion = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'WebSocket' },
          { field: 'groupDescription', value: 'ApiGatewayMessage' },
        ],
      });

      const connectionCostPerMinute = await pricingClient.getPrice({
        serviceCode: 'AmazonApiGateway',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'WebSocket' },
          { field: 'groupDescription', value: 'ApiGatewayConnectionMinute' },
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

}
