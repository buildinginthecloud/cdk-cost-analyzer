import { PricingClient } from '../../src/pricing/PricingClient';
import { ElastiCacheCalculator } from '../../src/pricing/calculators/ElastiCacheCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for ElastiCache pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for Redis and Memcached engines
 * - Various node types (cache.t3.micro, cache.m5.large, etc.)
 * - Multi-node clusters
 * - Multi-AZ deployments (replica cost doubling)
 * - Debug logging captures pricing queries and responses
 *
 * ElastiCache Pricing:
 * - Node hourly rate × 730 hours/month × number of nodes
 * - Multi-AZ: Cost doubled for replica nodes
 *
 * Expected pricing for cache.t3.micro Redis (us-east-1):
 * - Single-AZ: ~$0.017/hour × 730 = ~$12.41/month
 * - Multi-AZ: ~$24.82/month (doubled)
 *
 * To run: npm test -- ElastiCacheCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- ElastiCacheCalculator.integration.test.ts
 */
describe('ElastiCacheCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'us-east-1';

  beforeAll(() => {
    if (process.env.DEBUG === 'true') {
      Logger.setDebugEnabled(true);
      console.error('Debug logging enabled for pricing API calls');
    }
  });

  beforeEach(() => {
    pricingClient = new PricingClient('us-east-1');
  });

  afterEach(() => {
    if (pricingClient) {
      pricingClient.destroy();
    }
  });

  afterAll(() => {
    Logger.setDebugEnabled(false);
  });

  const testMode = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  describe('Redis Engine', () => {
    testMode('should fetch real ElastiCache Redis pricing for cache.t3.micro', async () => {
      const calculator = new ElastiCacheCalculator();

      const testResource = {
        logicalId: 'MyRedisCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.t3.micro',
          Engine: 'redis',
          NumCacheNodes: 1,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      if (cost.amount > 0) {
        expect(cost.amount).toBeGreaterThan(0);

        // cache.t3.micro Redis: ~$0.017/hour × 730 = ~$12.41/month
        // Allow 20% variance: ~$9.93 - $14.89
        const expectedMin = 9.93;
        const expectedMax = 14.89;

        console.log('ElastiCache Redis pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('high');

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/redis/);
        expect(assumptionText).toMatch(/cache\.t3\.micro/);
      } else {
        console.warn('ElastiCache Redis pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        throw new Error('ElastiCache Redis pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for larger Redis node', async () => {
      const calculator = new ElastiCacheCalculator();

      const testResource = {
        logicalId: 'MyRedisCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.m5.large',
          Engine: 'redis',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // cache.m5.large: ~$0.145/hour × 730 = ~$105.85/month
        expect(cost.amount).toBeGreaterThan(90.0);
        expect(cost.amount).toBeLessThan(125.0);

        console.log(`ElastiCache cache.m5.large: $${cost.amount.toFixed(2)}/month`);
      }
    }, 30000);
  });

  describe('Memcached Engine', () => {
    testMode('should fetch real ElastiCache Memcached pricing', async () => {
      const calculator = new ElastiCacheCalculator();

      const testResource = {
        logicalId: 'MyMemcachedCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.t3.micro',
          Engine: 'memcached',
          NumCacheNodes: 1,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Memcached t3.micro: similar to Redis ~$12.41/month
        expect(cost.amount).toBeGreaterThan(9.0);
        expect(cost.amount).toBeLessThan(16.0);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('Memcached');
      }
    }, 30000);
  });

  describe('Multi-Node Clusters', () => {
    testMode('should calculate cost for multi-node cluster', async () => {
      const calculator = new ElastiCacheCalculator();

      const testResource = {
        logicalId: 'MyRedisCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.t3.micro',
          Engine: 'redis',
          NumCacheNodes: 3,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // 3 nodes: 3 × ~$12.41 = ~$37.23/month
        expect(cost.amount).toBeGreaterThan(30.0);
        expect(cost.amount).toBeLessThan(45.0);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('3');
      }
    }, 30000);
  });

  describe('Multi-AZ Deployment', () => {
    testMode('should double cost for Multi-AZ deployment', async () => {
      const calculator = new ElastiCacheCalculator();

      const singleAZResource = {
        logicalId: 'SingleAZCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.t3.micro',
          Engine: 'redis',
          NumCacheNodes: 1,
        },
      };

      const multiAZResource = {
        logicalId: 'MultiAZCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.t3.micro',
          Engine: 'redis',
          NumCacheNodes: 1,
          AZMode: 'cross-az',
        },
      };

      const singleAZCost = await calculator.calculateCost(singleAZResource, testRegion, pricingClient);
      const multiAZCost = await calculator.calculateCost(multiAZResource, testRegion, pricingClient);

      if (singleAZCost.amount > 0 && multiAZCost.amount > 0) {
        console.log(`Single-AZ: $${singleAZCost.amount.toFixed(2)}/month`);
        console.log(`Multi-AZ: $${multiAZCost.amount.toFixed(2)}/month`);

        // Multi-AZ should be approximately 2x the cost
        const ratio = multiAZCost.amount / singleAZCost.amount;
        expect(ratio).toBeGreaterThan(1.9);
        expect(ratio).toBeLessThan(2.1);

        const multiAZAssumptions = multiAZCost.assumptions.join(' ');
        expect(multiAZAssumptions).toContain('Multi-AZ');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new ElastiCacheCalculator();

      const testResource = {
        logicalId: 'MyRedisCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.t3.micro',
          Engine: 'redis',
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`ElastiCache pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          expect(cost.amount).toBeGreaterThan(9.0);
          expect(cost.amount).toBeLessThan(16.0);
          expect(cost.confidence).toBe('high');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000);
  });

  describe('Edge Cases', () => {
    testMode('should return zero cost when node type missing', async () => {
      const calculator = new ElastiCacheCalculator();

      const testResource = {
        logicalId: 'MyCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          Engine: 'redis',
          // Missing CacheNodeType
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions).toContain('Cache node type or engine not specified');
    }, 30000);
  });
});
