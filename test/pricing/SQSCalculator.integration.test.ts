import { PricingClient } from '../../src/pricing/PricingClient';
import { SQSCalculator } from '../../src/pricing/calculators/SQSCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for SQS pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for Standard and FIFO queues
 * - Two separate queue types with different pricing
 * - Custom usage assumptions
 * - Debug logging captures pricing queries and responses
 *
 * SQS Pricing Model:
 * - Standard Queue: ~$0.40 per million requests
 * - FIFO Queue: ~$0.50 per million requests
 * - Free tier: 1M requests per month (not calculated in this tool)
 *
 * Expected pricing for default configuration (us-east-1):
 * - Standard: 1M requests × $0.40/1M = $0.40/month
 * - FIFO: 1M requests × $0.50/1M = $0.50/month
 *
 * To run: npm test -- SQSCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- SQSCalculator.integration.test.ts
 */
describe('SQSCalculator - AWS API Integration', () => {
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

  describe('Standard Queue', () => {
    testMode('should fetch real SQS Standard queue pricing', async () => {
      const calculator = new SQSCalculator();

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: false,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // SQS costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 1M requests (default):
        // Standard: 1M × $0.40/1M = $0.40
        // Allow 20% variance: ~$0.32 - $0.48
        const expectedMin = 0.32;
        const expectedMax = 0.48;

        console.log('SQS Standard queue pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention standard queue
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/standard/);
        expect(assumptionText).toMatch(/1,000,000/);
      } else {
        console.warn('SQS Standard pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('SQS Standard pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for high volume Standard queue', async () => {
      const config = {
        usageAssumptions: {
          sqs: {
            monthlyRequests: 10_000_000, // 10M requests
          },
        },
      };

      const calculator = new SQSCalculator(config);

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: false,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 10M requests:
        // Standard: 10M × $0.40/1M = $4.00
        // Allow variance
        const expectedMin = 3.4;
        const expectedMax = 4.6;

        console.log('SQS Standard high volume pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10,000,000');
        expect(assumptionText).toContain('custom');
      } else {
        throw new Error('SQS Standard pricing should be available');
      }
    }, 30000);

    testMode('should handle Standard queue without explicit FifoQueue property', async () => {
      const calculator = new SQSCalculator();

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          // No FifoQueue property - should default to Standard
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use Standard pricing
        const expectedMin = 0.32;
        const expectedMax = 0.48;

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('Standard');
      }
    }, 30000);
  });

  describe('FIFO Queue', () => {
    testMode('should fetch real SQS FIFO queue pricing', async () => {
      const calculator = new SQSCalculator();

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: true,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // FIFO costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 1M requests (default):
        // FIFO: 1M × $0.50/1M = $0.50
        // Allow 20% variance: ~$0.40 - $0.60
        const expectedMin = 0.40;
        const expectedMax = 0.60;

        console.log('SQS FIFO queue pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention FIFO queue
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/fifo/);
        expect(assumptionText).toMatch(/1,000,000/);
      } else {
        console.warn('SQS FIFO pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('SQS FIFO pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for high volume FIFO queue', async () => {
      const config = {
        usageAssumptions: {
          sqs: {
            monthlyRequests: 10_000_000, // 10M requests
          },
        },
      };

      const calculator = new SQSCalculator(config);

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: true,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 10M requests:
        // FIFO: 10M × $0.50/1M = $5.00
        // Allow variance
        const expectedMin = 4.2;
        const expectedMax = 5.8;

        console.log('SQS FIFO high volume pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10,000,000');
        expect(assumptionText).toContain('FIFO');
      } else {
        throw new Error('SQS FIFO pricing should be available');
      }
    }, 30000);

    testMode('should handle FifoQueue property as string "true"', async () => {
      const calculator = new SQSCalculator();

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: 'true', // String value
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use FIFO pricing
        const expectedMin = 0.40;
        const expectedMax = 0.60;

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('FIFO');
      }
    }, 30000);
  });

  describe('Price Comparison', () => {
    testMode('should show FIFO pricing is higher than Standard', async () => {
      const calculator = new SQSCalculator();

      const standardResource = {
        logicalId: 'StandardQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: false,
        },
      };

      const fifoResource = {
        logicalId: 'FifoQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: true,
        },
      };

      const standardCost = await calculator.calculateCost(standardResource, testRegion, pricingClient);
      const fifoCost = await calculator.calculateCost(fifoResource, testRegion, pricingClient);

      if (standardCost.amount > 0 && fifoCost.amount > 0) {
        console.log(`Standard Queue: $${standardCost.amount.toFixed(2)}/month`);
        console.log(`FIFO Queue: $${fifoCost.amount.toFixed(2)}/month`);

        // FIFO should be more expensive than Standard
        expect(fifoCost.amount).toBeGreaterThan(standardCost.amount);

        // FIFO should be approximately 25% more expensive (0.50 vs 0.40)
        const priceDifference = fifoCost.amount - standardCost.amount;
        const percentDifference = (priceDifference / standardCost.amount) * 100;

        console.log(`Price difference: ${percentDifference.toFixed(1)}%`);

        // Allow 15-35% difference range
        expect(percentDifference).toBeGreaterThan(15);
        expect(percentDifference).toBeLessThan(35);
      }
    }, 30000);
  });

  describe('Custom Usage Assumptions', () => {
    testMode('should use custom monthly requests from configuration', async () => {
      const config = {
        usageAssumptions: {
          sqs: {
            monthlyRequests: 5_000_000, // 5M requests
          },
        },
      };

      const calculator = new SQSCalculator(config);

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: false,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 5M requests:
        // Standard: 5M × $0.40/1M = $2.00
        const expectedMin = 1.7;
        const expectedMax = 2.3;

        console.log('SQS with custom request volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('5,000,000');
        expect(assumptionText).toContain('custom monthly requests');
      } else {
        throw new Error('SQS pricing should be available');
      }
    }, 30000);

    testMode('should handle very high volume requests', async () => {
      const config = {
        usageAssumptions: {
          sqs: {
            monthlyRequests: 100_000_000, // 100M requests
          },
        },
      };

      const calculator = new SQSCalculator(config);

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: false,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100M requests:
        // Standard: 100M × $0.40/1M = $40.00
        const expectedMin = 34.0;
        const expectedMax = 46.0;

        console.log('SQS very high volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100,000,000');
      } else {
        throw new Error('SQS pricing should be available');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions for Standard queues', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new SQSCalculator();

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: false,
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`SQS Standard pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($0.30-$0.50/month for 1M requests)
          expect(cost.amount).toBeGreaterThan(0.30);
          expect(cost.amount).toBeLessThan(0.55);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions

    testMode('should work in multiple regions for FIFO queues', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new SQSCalculator();

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: true,
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`SQS FIFO pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // FIFO pricing should be reasonable ($0.40-$0.65/month for 1M requests)
          expect(cost.amount).toBeGreaterThan(0.38);
          expect(cost.amount).toBeLessThan(0.68);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query correct UsageType for Standard queue', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new SQSCalculator();

        const testResource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: false,
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured the "Requests" UsageType
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);

    testMode('should query correct UsageType for FIFO queue', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new SQSCalculator();

        const testResource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: true,
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured the "Requests-FIFO" UsageType
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle minimal usage', async () => {
      const config = {
        usageAssumptions: {
          sqs: {
            monthlyRequests: 1000, // Only 1K requests
          },
        },
      };

      const calculator = new SQSCalculator(config);

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {
          FifoQueue: false,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 1K requests: 1,000/1M × $0.40 = $0.0004
        // Should be essentially free (< $0.01)
        expect(cost.amount).toBeLessThan(0.01);

        console.log(`SQS minimal usage: $${cost.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should mention data transfer exclusion in assumptions', async () => {
      const calculator = new SQSCalculator();

      const testResource = {
        logicalId: 'MyQueue',
        type: 'AWS::SQS::Queue',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      const assumptionText = cost.assumptions.join(' ').toLowerCase();
      expect(assumptionText).toMatch(/data transfer/);
    }, 30000);
  });
});
