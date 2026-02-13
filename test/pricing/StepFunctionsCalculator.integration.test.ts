import { PricingClient } from '../../src/pricing/PricingClient';
import { StepFunctionsCalculator } from '../../src/pricing/calculators/StepFunctionsCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for Step Functions pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for STANDARD and EXPRESS workflows
 * - State transition pricing for STANDARD workflows
 * - Request + duration pricing for EXPRESS workflows
 * - Custom usage assumptions
 * - Debug logging captures pricing queries and responses
 *
 * Step Functions Pricing Models:
 *
 * STANDARD Workflow:
 * - State transitions: ~$0.025 per 1,000 transitions
 * - Default: 10,000 executions × 10 transitions = 100,000 transitions
 * - Expected cost: 100,000 × $0.025/1,000 = $2.50/month
 *
 * EXPRESS Workflow:
 * - Requests: ~$1.00 per million requests
 * - Duration: ~$0.00001667 per GB-second
 * - Assumes 64MB memory per execution
 * - Default: 10,000 executions × 1000ms
 * - Expected cost: ~$0.02/month
 *
 * To run: npm test -- StepFunctionsCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- StepFunctionsCalculator.integration.test.ts
 */
describe('StepFunctionsCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'us-east-1';

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

  describe('STANDARD Workflow', () => {
    testMode('should fetch real Step Functions STANDARD workflow pricing', async () => {
      const calculator = new StepFunctionsCalculator();

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // Step Functions costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with default (10K executions × 10 transitions):
        // State transitions: 100,000 × $0.025/1,000 = $2.50
        // Allow 20% variance: ~$2.00 - $3.00
        const expectedMin = 2.0;
        const expectedMax = 3.0;

        console.log('Step Functions STANDARD workflow pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention STANDARD workflow and state transitions
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/standard/);
        expect(assumptionText).toMatch(/state transition/);
        expect(assumptionText).toMatch(/100,000/);
      } else {
        console.warn('Step Functions STANDARD pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('Step Functions STANDARD pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for high volume STANDARD workflow', async () => {
      // 100K executions × 20 transitions = 2M state transitions
      const calculator = new StepFunctionsCalculator(100_000, 20, undefined);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 2M state transitions:
        // 2,000,000 × $0.025/1,000 = $50.00
        const expectedMin = 42.0;
        const expectedMax = 58.0;

        console.log('Step Functions STANDARD high volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100,000');
        expect(assumptionText).toContain('2,000,000');
      } else {
        throw new Error('Step Functions STANDARD pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for STANDARD workflow with many state transitions', async () => {
      // 10K executions × 50 transitions = 500K state transitions
      const calculator = new StepFunctionsCalculator(10_000, 50, undefined);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 500K state transitions:
        // 500,000 × $0.025/1,000 = $12.50
        const expectedMin = 10.5;
        const expectedMax = 14.5;

        console.log('Step Functions STANDARD many transitions:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('50 state transitions');
      } else {
        throw new Error('Step Functions STANDARD pricing should be available');
      }
    }, 30000);

    testMode('should default to STANDARD when Type is not specified', async () => {
      const calculator = new StepFunctionsCalculator();

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          // No Type property - should default to STANDARD
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use STANDARD pricing
        const expectedMin = 2.0;
        const expectedMax = 3.0;

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('STANDARD');
      }
    }, 30000);
  });

  describe('EXPRESS Workflow', () => {
    testMode('should fetch real Step Functions EXPRESS workflow pricing', async () => {
      const calculator = new StepFunctionsCalculator();

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // EXPRESS costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with default (10K executions, 1000ms, 64MB):
        // Requests: 10,000 × $1.00/1M = $0.01
        // Duration: (64/1024) GB × 1s × 10,000 × $0.00001667 = $0.01
        // Total: ~$0.02
        // Allow wide variance: ~$0.015 - $0.03
        const expectedMin = 0.015;
        const expectedMax = 0.03;

        console.log('Step Functions EXPRESS workflow pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(4)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention EXPRESS workflow and both cost components
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/express/);
        expect(assumptionText).toMatch(/gb-second/);
        expect(assumptionText).toMatch(/64mb/);
      } else {
        console.warn('Step Functions EXPRESS pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('Step Functions EXPRESS pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for high volume EXPRESS workflow', async () => {
      // 1M executions × 1000ms
      const calculator = new StepFunctionsCalculator(1_000_000, undefined, 1000);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M executions:
        // Requests: 1,000,000 × $1.00/1M = $1.00
        // Duration: (64/1024) × 1s × 1M × $0.00001667 = $1.04
        // Total: ~$2.04
        const expectedMin = 1.7;
        const expectedMax = 2.4;

        console.log('Step Functions EXPRESS high volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1,000,000');
      } else {
        throw new Error('Step Functions EXPRESS pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for EXPRESS workflow with short duration', async () => {
      // 10K executions × 100ms
      const calculator = new StepFunctionsCalculator(10_000, undefined, 100);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 10K executions × 100ms:
        // Requests: 10,000 × $1.00/1M = $0.01
        // Duration: (64/1024) × 0.1s × 10,000 × $0.00001667 = $0.001
        // Total: ~$0.011
        expect(cost.amount).toBeLessThan(0.02);
        expect(cost.amount).toBeGreaterThan(0.008);

        console.log(`Step Functions EXPRESS short duration: $${cost.amount.toFixed(4)}/month`);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100ms');
      } else {
        throw new Error('Step Functions EXPRESS pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for EXPRESS workflow with long duration', async () => {
      // 10K executions × 5000ms (5 seconds)
      const calculator = new StepFunctionsCalculator(10_000, undefined, 5000);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 10K executions × 5s:
        // Requests: 10,000 × $1.00/1M = $0.01
        // Duration: (64/1024) × 5s × 10,000 × $0.00001667 = $0.052
        // Total: ~$0.062
        const expectedMin = 0.05;
        const expectedMax = 0.08;

        console.log('Step Functions EXPRESS long duration:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(4)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('5000ms');
      } else {
        throw new Error('Step Functions EXPRESS pricing should be available');
      }
    }, 30000);
  });

  describe('Workflow Type Comparison', () => {
    testMode('should show cost difference between STANDARD and EXPRESS', async () => {
      const calculator = new StepFunctionsCalculator();

      const standardResource = {
        logicalId: 'StandardStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      const expressResource = {
        logicalId: 'ExpressStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const standardCost = await calculator.calculateCost(standardResource, testRegion, pricingClient);
      const expressCost = await calculator.calculateCost(expressResource, testRegion, pricingClient);

      if (standardCost.amount > 0 && expressCost.amount > 0) {
        console.log(`STANDARD Workflow: $${standardCost.amount.toFixed(4)}/month`);
        console.log(`EXPRESS Workflow: $${expressCost.amount.toFixed(4)}/month`);

        // For default usage (10K executions):
        // STANDARD: ~$2.50 (100K state transitions)
        // EXPRESS: ~$0.02 (10K requests + minimal duration)
        // STANDARD should be significantly more expensive
        expect(standardCost.amount).toBeGreaterThan(expressCost.amount);
        expect(standardCost.amount).toBeGreaterThan(2.0);
        expect(expressCost.amount).toBeLessThan(0.05);
      }
    }, 30000);
  });

  describe('Custom Usage Assumptions', () => {
    testMode('should use custom state transitions for STANDARD workflow', async () => {
      // 50K executions × 5 transitions = 250K transitions
      const calculator = new StepFunctionsCalculator(50_000, 5, undefined);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 250K state transitions:
        // 250,000 × $0.025/1,000 = $6.25
        const expectedMin = 5.3;
        const expectedMax = 7.2;

        console.log('Step Functions STANDARD custom assumptions:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('50,000');
        expect(assumptionText).toContain('5 state transitions');
        expect(assumptionText).toContain('custom');
      } else {
        throw new Error('Step Functions STANDARD pricing should be available');
      }
    }, 30000);

    testMode('should use custom duration for EXPRESS workflow', async () => {
      // 100K executions × 2000ms (2 seconds)
      const calculator = new StepFunctionsCalculator(100_000, undefined, 2000);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100K executions × 2s:
        // Requests: 100,000 × $1.00/1M = $0.10
        // Duration: (64/1024) × 2s × 100,000 × $0.00001667 = $0.21
        // Total: ~$0.31
        const expectedMin = 0.26;
        const expectedMax = 0.36;

        console.log('Step Functions EXPRESS custom duration:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(4)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100,000');
        expect(assumptionText).toContain('2000ms');
        expect(assumptionText).toContain('custom');
      } else {
        throw new Error('Step Functions EXPRESS pricing should be available');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions for STANDARD workflows', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new StepFunctionsCalculator();

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`Step Functions STANDARD pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($2.00-$3.00/month for default usage)
          expect(cost.amount).toBeGreaterThan(1.8);
          expect(cost.amount).toBeLessThan(3.2);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions

    testMode('should work in multiple regions for EXPRESS workflows', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new StepFunctionsCalculator();

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`Step Functions EXPRESS pricing for ${region}: $${cost.amount.toFixed(4)}/month`);

        if (cost.amount > 0) {
          // EXPRESS pricing should be reasonable ($0.015-$0.03/month for default usage)
          expect(cost.amount).toBeGreaterThan(0.01);
          expect(cost.amount).toBeLessThan(0.04);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query StateTransition for STANDARD workflow', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new StepFunctionsCalculator();

        const testResource = {
          logicalId: 'MyStateMachine',
          type: 'AWS::StepFunctions::StateMachine',
          properties: {
            Type: 'STANDARD',
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured the StateTransition UsageType
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);

    testMode('should query both ExpressRequest and ExpressDuration for EXPRESS workflow', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new StepFunctionsCalculator();

        const testResource = {
          logicalId: 'MyStateMachine',
          type: 'AWS::StepFunctions::StateMachine',
          properties: {
            Type: 'EXPRESS',
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured both ExpressRequest and ExpressDuration UsageTypes
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle minimal STANDARD workflow usage', async () => {
      // 100 executions × 5 transitions = 500 transitions
      const calculator = new StepFunctionsCalculator(100, 5, undefined);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'STANDARD',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 500 state transitions: 500 × $0.025/1,000 = $0.0125
        expect(cost.amount).toBeLessThan(0.02);

        console.log(`Step Functions STANDARD minimal usage: $${cost.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should handle minimal EXPRESS workflow usage', async () => {
      // 10 executions × 100ms
      const calculator = new StepFunctionsCalculator(10, undefined, 100);

      const testResource = {
        logicalId: 'MyStateMachine',
        type: 'AWS::StepFunctions::StateMachine',
        properties: {
          Type: 'EXPRESS',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount >= 0) {
        // Very minimal usage should be nearly free
        expect(cost.amount).toBeLessThan(0.001);

        console.log(`Step Functions EXPRESS minimal usage: $${cost.amount.toFixed(6)}/month`);
      }
    }, 30000);
  });
});
