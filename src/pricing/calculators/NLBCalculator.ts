import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';

export class NLBCalculator implements ResourceCostCalculator {
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
    // Only handle Network Load Balancers
    const loadBalancerType = resource.properties?.Type;
    return this.supports(resource.type) && loadBalancerType === 'network';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    // Check if this is a Network Load Balancer
    const loadBalancerType = resource.properties?.Type;
    if (loadBalancerType && loadBalancerType !== 'network') {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: ['This calculator only supports Network Load Balancers'],
      };
    }

    try {
      const regionPrefix = getRegionPrefix(region);
      
      // Get hourly rate
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AWSELB',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Load Balancer-Network' },
          { field: 'usagetype', value: `${regionPrefix}-LoadBalancerUsage` },
        ],
      });

      // Get NLCU rate
      const nlcuRate = await pricingClient.getPrice({
        serviceCode: 'AWSELB',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Load Balancer-Network' },
          { field: 'usagetype', value: `${regionPrefix}-LCUUsage` },
        ],
      });

      if (hourlyRate === null || nlcuRate === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for Network Load Balancer in region ${region}`,
          ],
        };
      }

      const newConnectionsPerSecond =
        this.customNewConnectionsPerSecond || this.DEFAULT_NEW_CONNECTIONS_PER_SECOND;
      const activeConnectionsPerMinute =
        this.customActiveConnectionsPerMinute || this.DEFAULT_ACTIVE_CONNECTIONS_PER_MINUTE;
      const processedBytesGB =
        this.customProcessedBytesGB || this.DEFAULT_PROCESSED_BYTES_GB;

      // Calculate NLCU consumption
      // 1 NLCU provides: 800 new connections/sec, 100,000 active connections/min, 1 GB processed/hour
      const nlcuFromNewConnections = newConnectionsPerSecond / 800;
      const nlcuFromActiveConnections = activeConnectionsPerMinute / 100000;
      const gbPerHour = processedBytesGB / this.HOURS_PER_MONTH;
      const nlcuFromProcessedBytes = gbPerHour;

      // Use the highest NLCU consumption
      const nlcuPerHour = Math.max(
        nlcuFromNewConnections,
        nlcuFromActiveConnections,
        nlcuFromProcessedBytes,
      );

      const hourlyCost = hourlyRate * this.HOURS_PER_MONTH;
      const nlcuCost = nlcuRate * nlcuPerHour * this.HOURS_PER_MONTH;
      const totalCost = hourlyCost + nlcuCost;

      return {
        amount: totalCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `Hourly rate: $${hourlyRate.toFixed(4)}/hour × ${this.HOURS_PER_MONTH} hours = $${hourlyCost.toFixed(2)}/month`,
          `NLCU consumption: ${nlcuPerHour.toFixed(2)} NLCU/hour based on:`,
          `  - New connections: ${newConnectionsPerSecond}/sec → ${nlcuFromNewConnections.toFixed(2)} NLCU`,
          `  - Active connections: ${activeConnectionsPerMinute}/min → ${nlcuFromActiveConnections.toFixed(2)} NLCU`,
          `  - Processed data: ${processedBytesGB} GB/month → ${nlcuFromProcessedBytes.toFixed(2)} NLCU`,
          `NLCU cost: $${nlcuRate.toFixed(4)}/NLCU/hour × ${nlcuPerHour.toFixed(2)} NLCU × ${this.HOURS_PER_MONTH} hours = $${nlcuCost.toFixed(2)}/month`,
          `Total: $${totalCost.toFixed(2)}/month`,
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
