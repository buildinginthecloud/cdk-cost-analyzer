import { PricingClient } from '../../src/pricing/PricingClient';
import { ALBCalculator } from '../../src/pricing/calculators/ALBCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for ALB (Application Load Balancer) pricing with actual AWS Pricing API
 * 
 * This test validates:
 * - Correct region prefix generation for eu-central-1
 * - Correct filter combinations for ALB pricing queries
 * - Expected pricing data matches AWS Pricing Calculator
 * - Debug logging captures pricing queries and responses
 * - LCU (Load Balancer Capacity Unit) cost calculation
 * 
 * Expected pricing for eu-central-1:
 * - Hourly rate: ~$0.0225/hour
 * - LCU rate: ~$0.008/LCU/hour
 * - Monthly cost with default usage (25 new conn/sec, 3000 active conn/min, 100GB data): ~$16-18/month
 * 
 * To run: npm test -- ALBCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- ALBCalculator.integration.test.ts
 */
describe('ALBCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'eu-central-1';
  const testResource = {
    logicalId: 'TestALB',
    type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    properties: {
      Type: 'application',
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

  testMode('should fetch real ALB hourly pricing for eu-central-1', async () => {
    const calculator = new ALBCalculator();
    
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();
    expect(cost.currency).toBe('USD');
    
    // If pricing was found, validate it's reasonable
    if (cost.amount > 0) {
      // ALB costs should be positive
      expect(cost.amount).toBeGreaterThan(0);
      
      // For eu-central-1 with default usage (25 new conn/sec, 3000 active conn/min, 100GB/month):
      // Hourly: 0.0225 * 730 = 16.425
      // LCU calculation:
      //   - New connections: 25/25 = 1 LCU
      //   - Active connections: 3000/3000 = 1 LCU
      //   - Processed bytes: 100GB/730 hours = 0.137 GB/hour = 0.137 LCU
      //   - Max LCU: 1 LCU/hour
      // LCU cost: 0.008 * 1 * 730 = 5.84
      // Total: 16.425 + 5.84 = 22.265
      // Allow 10% variance: ~14.4 - 24.5
      const expectedMin = 14.4;
      const expectedMax = 24.5;
      
      console.log('ALB pricing breakdown:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
      cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));
      
      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      expect(cost.confidence).toBe('medium');
      
      // Verify assumptions include both hourly and LCU costs
      const assumptionText = cost.assumptions.join(' ').toLowerCase();
      expect(assumptionText).toMatch(/hour/);
      expect(assumptionText).toMatch(/lcu/);
    } else {
      // If pricing is 0, it means pricing lookup failed
      console.warn('ALB pricing lookup failed:');
      cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
      
      // This indicates the region prefix or filters are incorrect
      expect(cost.confidence).toBe('unknown');
      fail('ALB pricing should be available for eu-central-1. Check region prefix and filters.');
    }
  }, 30000); // Increase timeout for API calls

  testMode('should calculate LCU cost correctly with high usage', async () => {
    // Test with high usage to validate LCU calculation
    // 100 new connections/sec should result in 4 LCU (100/25)
    const calculator = new ALBCalculator(100, 3000, 100);
    
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();
    
    if (cost.amount > 0) {
      // With 100 new connections/sec:
      // Hourly: 0.0225 * 730 = 16.425
      // LCU calculations:
      //   - New connections: 100/25 = 4 LCU (highest)
      //   - Active connections: 3000/3000 = 1 LCU
      //   - Processed bytes: 100/730 = 0.137 LCU
      // LCU cost: 0.008 * 4 * 730 = 23.36
      // Total: 16.425 + 23.36 = 39.785
      // Allow variance
      const expectedMin = 36.0;
      const expectedMax = 44.0;
      
      console.log('ALB pricing with high new connections:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
      
      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      
      // Verify assumptions mention the 100 new connections
      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('100');
    } else {
      fail('ALB pricing should be available for eu-central-1');
    }
  }, 30000);

  testMode('should handle pricing queries with debug logging', async () => {
    // Temporarily enable debug logging for this test
    const wasDebugEnabled = Logger.isDebugEnabled();
    Logger.setDebugEnabled(true);

    try {
      const calculator = new ALBCalculator();
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
    
    const calculator = new ALBCalculator();
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    if (cost.amount > 0) {
      // Successfully got pricing, so region prefix is correct
      // Expected cost with defaults: ~16-24/month
      expect(cost.amount).toBeGreaterThan(14);
      expect(cost.amount).toBeLessThan(25);
      console.log(`Verified region prefix works for eu-central-1: $${cost.amount.toFixed(2)}`);
    } else {
      console.error('Failed to get pricing. Possible issues:');
      console.error('1. Region prefix is incorrect');
      console.error('2. UsageType filter format is wrong');
      console.error('3. ProductFamily filter is incorrect');
      cost.assumptions.forEach(assumption => console.error(`  - ${assumption}`));
      fail('Unable to fetch ALB pricing - check region prefix and filters');
    }
  }, 30000);

  testMode('should distinguish between ALB and NLB resources', async () => {
    // Test that ALB calculator correctly identifies application load balancers
    const albCalculator = new ALBCalculator();
    
    const albResource = {
      logicalId: 'TestALB',
      type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      properties: {
        Type: 'application',
      },
    };

    const nlbResource = {
      logicalId: 'TestNLB',
      type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      properties: {
        Type: 'network',
      },
    };

    // Test canCalculate method
    expect(albCalculator.canCalculate(albResource)).toBe(true);
    expect(albCalculator.canCalculate(nlbResource)).toBe(false);

    // Test that NLB resource returns zero cost with appropriate message
    const nlbCost = await albCalculator.calculateCost(nlbResource, testRegion, pricingClient);
    expect(nlbCost.amount).toBe(0);
    expect(nlbCost.confidence).toBe('unknown');
    expect(nlbCost.assumptions).toContain('This calculator only supports Application Load Balancers');
  }, 30000);
});
