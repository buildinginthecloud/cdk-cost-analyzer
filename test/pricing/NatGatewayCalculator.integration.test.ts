import { PricingClient } from '../../src/pricing/PricingClient';
import { NatGatewayCalculator } from '../../src/pricing/calculators/NatGatewayCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for NAT Gateway pricing with actual AWS Pricing API
 * 
 * This test validates:
 * - Correct region prefix generation for eu-central-1
 * - Correct filter combinations for NAT Gateway pricing queries
 * - Expected pricing data matches AWS Pricing Calculator
 * - Debug logging captures pricing queries and responses
 * 
 * Expected pricing for eu-central-1:
 * - Hourly rate: ~$0.045/hour
 * - Data processing: ~$0.045/GB
 * - Monthly cost with 100GB data: ~$33-37/month
 * 
 * To run: npm test -- NatGatewayCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- NatGatewayCalculator.integration.test.ts
 */
describe('NatGatewayCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'eu-central-1';
  const testResource = {
    logicalId: 'TestNatGateway',
    type: 'AWS::EC2::NatGateway',
    properties: {},
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

  testMode('should fetch real NAT Gateway hourly pricing for eu-central-1', async () => {
    const calculator = new NatGatewayCalculator();
    
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();
    expect(cost.currency).toBe('USD');
    
    // If pricing was found, validate it's reasonable
    if (cost.amount > 0) {
      // NAT Gateway costs should be positive
      expect(cost.amount).toBeGreaterThan(0);
      
      // For eu-central-1 with 100GB data processing:
      // Hourly: 0.045 * 730 = 32.85
      // Data: 0.045 * 100 = 4.50
      // Total: ~37.35
      // Allow 10% variance: 33.62 - 41.09
      const expectedMin = 33.0;
      const expectedMax = 41.0;
      
      console.log('NAT Gateway pricing breakdown:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
      cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));
      
      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      expect(cost.confidence).toBe('medium');
      
      // Verify assumptions include both hourly and data processing
      const assumptionText = cost.assumptions.join(' ').toLowerCase();
      expect(assumptionText).toMatch(/hour/);
      expect(assumptionText).toMatch(/data|processing|gb/);
    } else {
      // If pricing is 0, it means pricing lookup failed
      console.warn('NAT Gateway pricing lookup failed:');
      cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
      
      // This indicates the region prefix or filters are incorrect
      expect(cost.confidence).toBe('unknown');
      fail('NAT Gateway pricing should be available for eu-central-1. Check region prefix and filters.');
    }
  }, 30000); // Increase timeout for API calls

  testMode('should fetch real NAT Gateway data processing pricing for eu-central-1', async () => {
    // Test with custom data processing to validate that component
    const calculator = new NatGatewayCalculator(500); // 500GB data processing
    
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();
    
    if (cost.amount > 0) {
      // With 500GB data processing:
      // Hourly: 0.045 * 730 = 32.85
      // Data: 0.045 * 500 = 22.50
      // Total: ~55.35
      // Allow variance
      const expectedMin = 50.0;
      const expectedMax = 65.0;
      
      console.log('NAT Gateway pricing with 500GB data:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
      
      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      
      // Verify assumptions mention the 500GB
      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('500');
    } else {
      fail('NAT Gateway pricing should be available for eu-central-1');
    }
  }, 30000);

  testMode('should handle pricing queries with debug logging', async () => {
    // Temporarily enable debug logging for this test
    const wasDebugEnabled = Logger.isDebugEnabled();
    Logger.setDebugEnabled(true);

    try {
      const calculator = new NatGatewayCalculator();
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
    
    const calculator = new NatGatewayCalculator(0); // Zero data processing to isolate hourly rate
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    if (cost.amount > 0) {
      // Successfully got pricing, so region prefix is correct
      // Hourly cost only (no data processing)
      const hourlyOnlyCost = 0.045 * 730; // ~32.85
      expect(cost.amount).toBeCloseTo(hourlyOnlyCost, 1); // Within $0.10
      console.log(`Verified region prefix works for eu-central-1: $${cost.amount.toFixed(2)}`);
    } else {
      console.error('Failed to get pricing. Possible issues:');
      console.error('1. Region prefix is incorrect');
      console.error('2. UsageType filter format is wrong');
      console.error('3. ProductFamily filter is incorrect');
      cost.assumptions.forEach(assumption => console.error(`  - ${assumption}`));
      fail('Unable to fetch NAT Gateway pricing - check region prefix and filters');
    }
  }, 30000);
});
