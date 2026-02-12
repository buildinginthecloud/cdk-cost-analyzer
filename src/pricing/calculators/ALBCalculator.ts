import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';

export class ALBCalculator implements ResourceCostCalculator {
  private readonly DEFAULT_NEW_CONNECTIONS_PER_SECOND = 25;
  private readonly DEFAULT_ACTIVE_CONNECTIONS_PER_MINUTE = 3000;
  private readonly DEFAULT_PROCESSED_BYTES_GB = 100;
  private readonly HOURS_PER_MONTH = 730;

  constructor(
    private customNewConnectionsPerSecond?: number,
    private customActiveConnectionsPerMinute?: number,
    private customProcessedBytesGB?: number,
  ) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::ElasticLoadBalancingV2::LoadBalancer';
  }

  canCalculate(resource: ResourceWithId): boolean {
    // Only handle Application Load Balancers
    const loadBalancerType = resource.properties?.Type;
    return this.supports(resource.type) && loadBalancerType === 'application';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    // Check if this is an Application Load Balancer (not Network Load Balancer)
    const loadBalancerType = resource.properties?.Type;
    if (loadBalancerType && loadBalancerType !== 'application') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: ['This calculator only supports Application Load Balancers'],
      };
    }

    try {
      const regionPrefix = getRegionPrefix(region);
      
      // Get hourly rate
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AWSELB',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Load Balancer-Application' },
          { field: 'usagetype', value: `${regionPrefix}-LoadBalancerUsage` },
        ],
      });

      // Get LCU rate
      const lcuRate = await pricingClient.getPrice({
        serviceCode: 'AWSELB',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Load Balancer-Application' },
          { field: 'usagetype', value: `${regionPrefix}-LCUUsage` },
        ],
      });

      const newConnectionsPerSecond =
        this.customNewConnectionsPerSecond || this.DEFAULT_NEW_CONNECTIONS_PER_SECOND;
      const activeConnectionsPerMinute =
        this.customActiveConnectionsPerMinute || this.DEFAULT_ACTIVE_CONNECTIONS_PER_MINUTE;
      const processedBytesGB =
        this.customProcessedBytesGB || this.DEFAULT_PROCESSED_BYTES_GB;

      if (hourlyRate === null || lcuRate === null) {
        // Calculate LCU consumption for assumptions even when pricing fails
        const lcuFromNewConnections = newConnectionsPerSecond / 25;
        const lcuFromActiveConnections = activeConnectionsPerMinute / 3000;
        const gbPerHour = processedBytesGB / this.HOURS_PER_MONTH;
        const lcuFromProcessedBytes = gbPerHour;
        const lcuPerHour = Math.max(
          lcuFromNewConnections,
          lcuFromActiveConnections,
          lcuFromProcessedBytes,
        );

        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for Application Load Balancer in region ${region}`,
            `Would use LCU consumption: ${lcuPerHour.toFixed(2)} LCU/hour based on:`,
            `  - New connections: ${newConnectionsPerSecond}/sec → ${lcuFromNewConnections.toFixed(2)} LCU`,
            `  - Active connections: ${activeConnectionsPerMinute}/min → ${lcuFromActiveConnections.toFixed(2)} LCU`,
            `  - Processed data: ${processedBytesGB} GB/month → ${lcuFromProcessedBytes.toFixed(2)} LCU`,
          ],
        };
      }

      // Calculate LCU consumption
      // 1 LCU provides: 25 new connections/sec, 3000 active connections/min, 1 GB processed/hour, 1000 rule evaluations/sec
      const lcuFromNewConnections = newConnectionsPerSecond / 25;
      const lcuFromActiveConnections = activeConnectionsPerMinute / 3000;
      const gbPerHour = processedBytesGB / this.HOURS_PER_MONTH;
      const lcuFromProcessedBytes = gbPerHour;

      // Use the highest LCU consumption
      const lcuPerHour = Math.max(
        lcuFromNewConnections,
        lcuFromActiveConnections,
        lcuFromProcessedBytes,
      );

      const hourlyCost = hourlyRate * this.HOURS_PER_MONTH;
      const lcuCost = lcuRate * lcuPerHour * this.HOURS_PER_MONTH;
      const totalCost = hourlyCost + lcuCost;

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Hourly rate: $${hourlyRate.toFixed(4)}/hour × ${this.HOURS_PER_MONTH} hours = $${hourlyCost.toFixed(2)}/month`,
          `LCU consumption: ${lcuPerHour.toFixed(2)} LCU/hour based on:`,
          `  - New connections: ${newConnectionsPerSecond}/sec → ${lcuFromNewConnections.toFixed(2)} LCU`,
          `  - Active connections: ${activeConnectionsPerMinute}/min → ${lcuFromActiveConnections.toFixed(2)} LCU`,
          `  - Processed data: ${processedBytesGB} GB/month → ${lcuFromProcessedBytes.toFixed(2)} LCU`,
          `LCU cost: $${lcuRate.toFixed(4)}/LCU/hour × ${lcuPerHour.toFixed(2)} LCU × ${this.HOURS_PER_MONTH} hours = $${lcuCost.toFixed(2)}/month`,
          `Total: $${totalCost.toFixed(2)}/month`,
        ],
      };
    } catch (error) {
      const newConnectionsPerSecond =
        this.customNewConnectionsPerSecond || this.DEFAULT_NEW_CONNECTIONS_PER_SECOND;
      const activeConnectionsPerMinute =
        this.customActiveConnectionsPerMinute || this.DEFAULT_ACTIVE_CONNECTIONS_PER_MINUTE;
      const processedBytesGB =
        this.customProcessedBytesGB || this.DEFAULT_PROCESSED_BYTES_GB;

      // Calculate LCU consumption for assumptions even when error occurs
      const lcuFromNewConnections = newConnectionsPerSecond / 25;
      const lcuFromActiveConnections = activeConnectionsPerMinute / 3000;
      const gbPerHour = processedBytesGB / this.HOURS_PER_MONTH;
      const lcuFromProcessedBytes = gbPerHour;
      const lcuPerHour = Math.max(
        lcuFromNewConnections,
        lcuFromActiveConnections,
        lcuFromProcessedBytes,
      );

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
          `Would use LCU consumption: ${lcuPerHour.toFixed(2)} LCU/hour based on:`,
          `  - New connections: ${newConnectionsPerSecond}/sec → ${lcuFromNewConnections.toFixed(2)} LCU`,
          `  - Active connections: ${activeConnectionsPerMinute}/min → ${lcuFromActiveConnections.toFixed(2)} LCU`,
          `  - Processed data: ${processedBytesGB} GB/month → ${lcuFromProcessedBytes.toFixed(2)} LCU`,
        ],
      };
    }
  }
}
