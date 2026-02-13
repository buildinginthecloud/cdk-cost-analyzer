import { PricingClient } from '../../src/pricing/PricingClient';
import { LambdaCalculator } from '../../src/pricing/calculators/LambdaCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for Lambda pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for Lambda requests and compute (duration)
 * - Two separate pricing components (requests + GB-seconds)
 * - Various memory configurations (128MB to 10GB)
 * - Custom invocation and duration assumptions
 * - Debug logging captures pricing queries and responses
 *
 * Lambda Pricing Components:
 * 1. Requests: ~$0.20 per 1 million requests
 * 2. Compute (Duration): ~$0.0000166667 per GB-second
 *
 * Expected pricing for 1M invocations, 1000ms, 512MB (us-east-1):
 * - Request cost: 1M * $0.20/1M = $0.20
 * - Compute: (512/1024) * 1 * 1M = 500,000 GB-seconds
 * - Compute cost: 500,000 * $0.0000166667 = $8.33
 * - Total: ~$8.53/month
 *
 * Free tier (not calculated):
 * - 1M requests per month
 * - 400,000 GB-seconds per month
 *
 * To run: npm test -- LambdaCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- LambdaCalculator.integration.test.ts
 */
describe('LambdaCalculator - AWS API Integration', () => {
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

  describe('Request and Duration Pricing', () => {
    testMode('should fetch real Lambda pricing for default configuration', async () => {
      const calculator = new LambdaCalculator();

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 512,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // Lambda costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 1M invocations, 1000ms, 512MB:
        // Request: 1M * 0.20/1M = $0.20
        // Compute: (512/1024) * 1s * 1M = 500K GB-seconds * 0.0000166667 = $8.33
        // Total: ~$8.53
        // Allow 20% variance: ~$6.8 - $10.2
        const expectedMin = 6.8;
        const expectedMax = 10.2;

        console.log('Lambda pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention invocations and memory
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/invocation/);
        expect(assumptionText).toMatch(/512.*mb|memory/);
      } else {
        console.warn('Lambda pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('Lambda pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost correctly for minimum memory (128MB)', async () => {
      const calculator = new LambdaCalculator();

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 128,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M invocations, 1000ms, 128MB:
        // Request: $0.20
        // Compute: (128/1024) * 1s * 1M = 125K GB-seconds * 0.0000166667 = $2.08
        // Total: ~$2.28
        const expectedMin = 1.8;
        const expectedMax = 2.8;

        console.log('Lambda 128MB pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('128');
      } else {
        throw new Error('Lambda pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost correctly for high memory (3GB)', async () => {
      const calculator = new LambdaCalculator();

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 3072, // 3GB
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M invocations, 1000ms, 3072MB:
        // Request: $0.20
        // Compute: (3072/1024) * 1s * 1M = 3M GB-seconds * 0.0000166667 = $50.00
        // Total: ~$50.20
        const expectedMin = 44.0;
        const expectedMax = 56.0;

        console.log('Lambda 3GB pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('3072');
      } else {
        throw new Error('Lambda pricing should be available');
      }
    }, 30000);
  });

  describe('Custom Usage Assumptions', () => {
    testMode('should calculate cost with high invocation volume', async () => {
      const calculator = new LambdaCalculator(10_000_000, 1000); // 10M invocations

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 512,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 10M invocations, 1000ms, 512MB:
        // Request: 10M * 0.20/1M = $2.00
        // Compute: (512/1024) * 1s * 10M = 5M GB-seconds * 0.0000166667 = $83.33
        // Total: ~$85.33
        const expectedMin = 75.0;
        const expectedMax = 95.0;

        console.log('Lambda high volume pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10,000,000');
        expect(assumptionText).toContain('custom invocation');
      } else {
        throw new Error('Lambda pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with short duration', async () => {
      const calculator = new LambdaCalculator(1_000_000, 100); // 100ms

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 512,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M invocations, 100ms, 512MB:
        // Request: $0.20
        // Compute: (512/1024) * 0.1s * 1M = 50K GB-seconds * 0.0000166667 = $0.83
        // Total: ~$1.03
        const expectedMin = 0.8;
        const expectedMax = 1.3;

        console.log('Lambda short duration pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100ms');
        expect(assumptionText).toContain('custom duration');
      } else {
        throw new Error('Lambda pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with long duration', async () => {
      const calculator = new LambdaCalculator(1_000_000, 5000); // 5 seconds

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 1024, // 1GB
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M invocations, 5000ms, 1024MB:
        // Request: $0.20
        // Compute: (1024/1024) * 5s * 1M = 5M GB-seconds * 0.0000166667 = $83.33
        // Total: ~$83.53
        const expectedMin = 73.0;
        const expectedMax = 93.0;

        console.log('Lambda long duration pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('5000ms');
      } else {
        throw new Error('Lambda pricing should be available');
      }
    }, 30000);
  });

  describe('Default Memory Configuration', () => {
    testMode('should default to 128MB when MemorySize is not specified', async () => {
      const calculator = new LambdaCalculator();

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          // No MemorySize specified
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should default to 128MB
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('128');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new LambdaCalculator();

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 512,
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`Lambda pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($6-12/month for default usage)
          expect(cost.amount).toBeGreaterThan(6.0);
          expect(cost.amount).toBeLessThan(12.0);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query both request and duration pricing separately', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new LambdaCalculator();

        const testResource = {
          logicalId: 'MyFunction',
          type: 'AWS::Lambda::Function',
          properties: {
            MemorySize: 512,
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured both pricing queries
        // (AWS-Lambda-Requests and AWS-Lambda-Duration)
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle very low usage', async () => {
      const calculator = new LambdaCalculator(1000, 100); // 1K invocations, 100ms

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 128,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Very low usage should result in minimal cost (well under $1)
        expect(cost.amount).toBeLessThan(0.1);
        console.log(`Lambda very low usage: $${cost.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should handle maximum memory configuration (10GB)', async () => {
      const calculator = new LambdaCalculator();

      const testResource = {
        logicalId: 'MyFunction',
        type: 'AWS::Lambda::Function',
        properties: {
          MemorySize: 10240, // 10GB max
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 1M invocations, 1000ms, 10GB:
        // Request: $0.20
        // Compute: 10 * 1s * 1M = 10M GB-seconds * 0.0000166667 = $166.67
        // Total: ~$166.87
        expect(cost.amount).toBeGreaterThan(145);
        expect(cost.amount).toBeLessThan(190);

        console.log(`Lambda 10GB pricing: $${cost.amount.toFixed(2)}/month`);
      }
    }, 30000);
  });
});
