import * as fc from 'fast-check';
import { ResourceWithId } from '../../../src/diff/types';
import { NLBCalculator } from '../../../src/pricing/calculators/NLBCalculator';
import { PricingClient } from '../../../src/pricing/types';

describe('NLBCalculator Property Tests', () => {
  // Mock pricing client for property tests
  class MockPricingClient implements PricingClient {
    private hourlyRate = 0.0225;

    async getPrice(): Promise<number | null> {
      return this.hourlyRate;
    }

    setHourlyRate(rate: number): void {
      this.hourlyRate = rate;
    }
  }

  const mockPricingClient = new MockPricingClient();

  const createNetworkLoadBalancer = (): ResourceWithId => ({
    logicalId: 'TestNLB',
    type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    properties: {
      Type: 'network',
      Scheme: 'internet-facing',
    },
  });

  it('should always return non-negative costs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // newConnectionsPerSecond
        fc.integer({ min: 1, max: 1000000 }), // activeConnectionsPerMinute
        fc.integer({ min: 1, max: 10000 }), // processedBytesGB
        async (newConnections, activeConnections, processedBytes) => {
          const calculator = new NLBCalculator(newConnections, activeConnections, processedBytes);
          const resource = createNetworkLoadBalancer();
          const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

          return result.amount >= 0;
        },
      ),
    );
  });
});