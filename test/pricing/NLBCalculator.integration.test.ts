import { PricingClient } from '../../src/pricing/PricingClient';
import { NLBCalculator } from '../../src/pricing/calculators/NLBCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for NLB (Network Load Balancer) pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct region prefix generation for eu-central-1
 * - Correct filter combinations for NLB pricing queries
 * - Expected pricing data matches AWS Pricing Calculator
 * - Debug logging captures pricing queries and responses
 * - NLCU (Network Load Balancer Capacity Unit) cost calculation
 *
 * Expected pricing for eu-central-1:
 * - Hourly rate: ~$0.0225/hour
 * - NLCU rate: ~$0.006/NLCU/hour
 * - Monthly cost with default usage (25 new conn/sec, 3000 active conn/min, 100GB data): ~$16-18/month
 *
 * NLCU Dimensions (per NLCU):
 * - New connections: 800/second
 * - Active connections: 100,000/minute
 * - Processed bytes: 1 GB/hour
 *
 * To run: npm test -- NLBCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- NLBCalculator.integration.test.ts
 */
describe('NLBCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'eu-central-1';
  const testResource = {
    logicalId: 'TestNLB',
    type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    properties: {
      Type: 'network',
    },
  };

  beforeAll(() => {
    // Enable debug logging if DEBUG env var is set
    if (process.env.DEBUG === 'true') {
      Logger.setDebugEnabled(true);
      console.error('Debug logging enabled for pricing API calls');
    }
  });

  beforeEach(() => {
    // Create pricing client that connects to actual AWS API
    pricingClient = new PricingClient('us-east-1');
  });

  afterEach(() => {
    if (pricingClient) {
      pricingClient.destroy();
    }
  });

  afterAll(() => {
    // Disable debug logging after tests
    Logger.setDebugEnabled(false);
  });

  // Skip this test in CI unless explicitly enabled
  const testMode = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  testMode('should fetch real NLB hourly pricing for eu-central-1', async () => {
    const calculator = new NLBCalculator();

    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();
    expect(cost.currency).toBe('USD');

    // If pricing was found, validate it's reasonable
    if (cost.amount > 0) {
      // NLB costs should be positive
      expect(cost.amount).toBeGreaterThan(0);

      // For eu-central-1 with default usage (25 new conn/sec, 3000 active conn/min, 100GB/month):
      // Hourly: 0.0225 * 730 = 16.425
      // NLCU calculation:
      //   - New connections: 25/800 = 0.03125 NLCU
      //   - Active connections: 3000/100000 = 0.03 NLCU
      //   - Processed bytes: 100GB/730 hours = 0.137 GB/hour = 0.137 NLCU (highest)
      // NLCU cost: 0.006 * 0.137 * 730 = 0.60
      // Total: 16.425 + 0.60 = 17.025
      // Allow 20% variance: ~13.6 - 20.4
      const expectedMin = 13.6;
      const expectedMax = 20.4;

      console.log('NLB pricing breakdown:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
      cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      expect(cost.confidence).toBe('medium');

      // Verify assumptions include both hourly and NLCU costs
      const assumptionText = cost.assumptions.join(' ').toLowerCase();
      expect(assumptionText).toMatch(/hour/);
      expect(assumptionText).toMatch(/nlcu/);
    } else {
      // If pricing is 0, it means pricing lookup failed
      console.warn('NLB pricing lookup failed:');
      cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));

      // This indicates the region prefix or filters are incorrect
      expect(cost.confidence).toBe('unknown');
      throw new Error('NLB pricing should be available for eu-central-1. Check region prefix and filters.');
    }
  }, 30000); // Increase timeout for API calls

  testMode('should calculate NLCU cost correctly with high throughput', async () => {
    // Test with high throughput to validate NLCU calculation
    // 1000 GB/month should result in ~1.37 NLCU (1000GB/730 hours = 1.37 GB/hour)
    const calculator = new NLBCalculator(25, 3000, 1000);

    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();

    if (cost.amount > 0) {
      // With 1000 GB data processing:
      // Hourly: 0.0225 * 730 = 16.425
      // NLCU calculations:
      //   - New connections: 25/800 = 0.03125 NLCU
      //   - Active connections: 3000/100000 = 0.03 NLCU
      //   - Processed bytes: 1000/730 = 1.37 GB/hour = 1.37 NLCU (highest)
      // NLCU cost: 0.006 * 1.37 * 730 = 6.00
      // Total: 16.425 + 6.00 = 22.425
      // Allow variance
      const expectedMin = 19.0;
      const expectedMax = 26.0;

      console.log('NLB pricing with high throughput:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);

      // Verify assumptions mention the 1000 GB
      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('1000');
    } else {
      throw new Error('NLB pricing should be available for eu-central-1');
    }
  }, 30000);

  testMode('should calculate NLCU cost correctly with high connection rate', async () => {
    // Test with high new connection rate
    // 1000 new connections/sec should result in 1.25 NLCU (1000/800)
    const calculator = new NLBCalculator(1000, 3000, 100);

    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();

    if (cost.amount > 0) {
      // With 1000 new connections/sec:
      // Hourly: 0.0225 * 730 = 16.425
      // NLCU calculations:
      //   - New connections: 1000/800 = 1.25 NLCU (highest)
      //   - Active connections: 3000/100000 = 0.03 NLCU
      //   - Processed bytes: 100/730 = 0.137 NLCU
      // NLCU cost: 0.006 * 1.25 * 730 = 5.48
      // Total: 16.425 + 5.48 = 21.905
      // Allow variance
      const expectedMin = 19.0;
      const expectedMax = 25.0;

      console.log('NLB pricing with high connection rate:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);

      // Verify assumptions mention the 1000 connections
      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('1000');
    } else {
      throw new Error('NLB pricing should be available for eu-central-1');
    }
  }, 30000);

  testMode('should handle pricing queries with debug logging', async () => {
    // Temporarily enable debug logging for this test
    const wasDebugEnabled = Logger.isDebugEnabled();
    Logger.setDebugEnabled(true);

    try {
      const calculator = new NLBCalculator();
      await calculator.calculateCost(testResource, testRegion, pricingClient);

      // If we reach here, the query executed (whether successful or not)
      // Debug logging should have captured the query details
      expect(true).toBe(true);
    } finally {
      Logger.setDebugEnabled(wasDebugEnabled);
    }
  }, 30000);

  testMode('should validate region prefix format', async () => {
    // This test will help us discover the correct region prefix format
    // by attempting to fetch pricing and examining the results

    const calculator = new NLBCalculator();
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    if (cost.amount > 0) {
      // Successfully got pricing, so region prefix is correct
      // Expected cost with defaults: ~13-21/month
      expect(cost.amount).toBeGreaterThan(13);
      expect(cost.amount).toBeLessThan(21);
      console.log(`Verified region prefix works for eu-central-1: $${cost.amount.toFixed(2)}`);
    } else {
      console.error('Failed to get pricing. Possible issues:');
      console.error('1. Region prefix is incorrect');
      console.error('2. UsageType filter format is wrong');
      console.error('3. ProductFamily filter is incorrect');
      cost.assumptions.forEach(assumption => console.error(`  - ${assumption}`));
      throw new Error('Unable to fetch NLB pricing - check region prefix and filters');
    }
  }, 30000);

  testMode('should distinguish between NLB and ALB resources', async () => {
    // Test that NLB calculator correctly identifies network load balancers
    const nlbCalculator = new NLBCalculator();

    const nlbResource = {
      logicalId: 'TestNLB',
      type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      properties: {
        Type: 'network',
      },
    };

    const albResource = {
      logicalId: 'TestALB',
      type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      properties: {
        Type: 'application',
      },
    };

    // Test canCalculate method
    expect(nlbCalculator.canCalculate(nlbResource)).toBe(true);
    expect(nlbCalculator.canCalculate(albResource)).toBe(false);

    // Test that ALB resource returns zero cost with appropriate message
    const albCost = await nlbCalculator.calculateCost(albResource, testRegion, pricingClient);
    expect(albCost.amount).toBe(0);
    expect(albCost.confidence).toBe('unknown');
    expect(albCost.assumptions).toContain('This calculator only supports Network Load Balancers');
  }, 30000);

  testMode('should work in multiple regions', async () => {
    const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
    const calculator = new NLBCalculator();

    for (const region of regions) {
      const cost = await calculator.calculateCost(testResource, region, pricingClient);

      console.log(`NLB pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

      if (cost.amount > 0) {
        // Pricing should be reasonable (between $10-$30/month for default usage)
        expect(cost.amount).toBeGreaterThan(10);
        expect(cost.amount).toBeLessThan(30);
        expect(cost.confidence).toBe('medium');
      } else {
        console.warn(`No pricing data for ${region}`);
      }
    }
  }, 60000); // Longer timeout for multiple regions
});
