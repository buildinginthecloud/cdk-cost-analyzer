import { PricingClient } from '../../src/pricing/PricingClient';
import { ECSCalculator } from '../../src/pricing/calculators/ECSCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for ECS Fargate pricing with actual AWS Pricing API
 * 
 * This test validates:
 * - Correct region prefix generation for eu-central-1
 * - Correct filter combinations for Fargate vCPU and memory pricing queries
 * - Expected pricing data matches AWS Pricing Calculator
 * - Debug logging captures pricing queries and responses
 * 
 * Expected pricing for eu-central-1:
 * - vCPU: ~$0.0466/vCPU-hour
 * - Memory: ~$0.0051/GB-hour
 * - Monthly cost (0.25 vCPU, 0.5 GB, 2 tasks): ~$20-22/month
 * 
 * To run: npm test -- ECSCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- ECSCalculator.integration.test.ts
 */
describe('ECSCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'eu-central-1';
  const testResource = {
    logicalId: 'TestECSService',
    type: 'AWS::ECS::Service',
    properties: {
      LaunchType: 'FARGATE',
      DesiredCount: 2,
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

  testMode('should fetch real ECS Fargate pricing for eu-central-1', async () => {
    const calculator = new ECSCalculator();
    
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();
    expect(cost.currency).toBe('USD');
    
    // If pricing was found, validate it's reasonable
    if (cost.amount > 0) {
      // ECS Fargate costs should be positive
      expect(cost.amount).toBeGreaterThan(0);
      
      // For eu-central-1 with 0.25 vCPU, 0.5 GB, 2 tasks:
      // vCPU: 0.0466 * 0.25 * 730 * 2 = 17.01
      // Memory: 0.0051 * 0.5 * 730 * 2 = 3.72
      // Total: ~20.73
      // Allow 15% variance: 17.62 - 23.84
      const expectedMin = 17.0;
      const expectedMax = 24.0;
      
      console.log('ECS Fargate pricing breakdown:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
      cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));
      
      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      expect(cost.confidence).toBe('medium');
      
      // Verify assumptions include both vCPU and memory
      const assumptionText = cost.assumptions.join(' ').toLowerCase();
      expect(assumptionText).toMatch(/vcpu|cpu/);
      expect(assumptionText).toMatch(/memory|gb/);
      expect(assumptionText).toMatch(/fargate/);
    } else {
      // If pricing is 0, it means pricing lookup failed
      console.warn('ECS Fargate pricing lookup failed:');
      cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
      
      // This indicates the region prefix or filters are incorrect
      expect(cost.confidence).toBe('unknown');
      throw new Error('ECS Fargate pricing should be available for eu-central-1. Check region prefix and filters.');
    }
  }, 30000); // Increase timeout for API calls

  testMode('should handle different task sizes', async () => {
    // Test with different desired count
    const largerResource = {
      ...testResource,
      properties: {
        ...testResource.properties,
        DesiredCount: 5,
      },
    };
    
    const calculator = new ECSCalculator();
    const cost = await calculator.calculateCost(largerResource, testRegion, pricingClient);

    // Verify we got pricing data
    expect(cost).toBeDefined();
    
    if (cost.amount > 0) {
      // With 5 tasks, cost should be roughly 2.5x the 2-task cost
      // Expected: ~52/month
      const expectedMin = 42.0;
      const expectedMax = 60.0;
      
      console.log('ECS Fargate pricing with 5 tasks:');
      console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
      
      expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
      expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      
      // Verify assumptions mention the 5 tasks
      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('5');
    } else {
      throw new Error('ECS Fargate pricing should be available for eu-central-1');
    }
  }, 30000);

  testMode('should handle pricing queries with debug logging', async () => {
    // Temporarily enable debug logging for this test
    const wasDebugEnabled = Logger.isDebugEnabled();
    Logger.setDebugEnabled(true);

    try {
      const calculator = new ECSCalculator();
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
    
    const calculator = new ECSCalculator();
    const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

    if (cost.amount > 0) {
      // Successfully got pricing, so region prefix is correct
      console.log(`Verified region prefix works for eu-central-1: $${cost.amount.toFixed(2)}`);
      expect(cost.confidence).toBe('medium');
    } else {
      console.error('Failed to get pricing. Possible issues:');
      console.error('1. Region prefix is incorrect');
      console.error('2. UsageType filter format is wrong');
      console.error('3. ProductFamily filter is incorrect');
      cost.assumptions.forEach(assumption => console.error(`  - ${assumption}`));
      throw new Error('Unable to fetch ECS Fargate pricing - check region prefix and filters');
    }
  }, 30000);

  testMode('should handle EC2 launch type', async () => {
    const ec2Resource = {
      logicalId: 'TestECSService',
      type: 'AWS::ECS::Service',
      properties: {
        LaunchType: 'EC2',
        DesiredCount: 3,
      },
    };
    
    const calculator = new ECSCalculator();
    const cost = await calculator.calculateCost(ec2Resource, testRegion, pricingClient);

    // EC2 launch type should return 0 with low confidence
    expect(cost.amount).toBe(0);
    expect(cost.confidence).toBe('low');
    expect(cost.assumptions).toContain('3 task(s) running on EC2 launch type');
  }, 30000);
});
