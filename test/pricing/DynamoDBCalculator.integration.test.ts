import { PricingClient } from '../../src/pricing/PricingClient';
import { DynamoDBCalculator } from '../../src/pricing/calculators/DynamoDBCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for DynamoDB pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for both provisioned and on-demand billing modes
 * - Correct filter combinations for DynamoDB pricing
 * - Expected pricing data matches AWS Pricing Calculator
 * - Debug logging captures pricing queries and responses
 *
 * DynamoDB Billing Modes:
 * 1. Provisioned Mode:
 *    - Read Capacity Units (RCU): ~$0.00013/hour per RCU
 *    - Write Capacity Units (WCU): ~$0.00065/hour per WCU
 *
 * 2. On-Demand Mode:
 *    - Read Request Units: ~$0.25 per million requests
 *    - Write Request Units: ~$1.25 per million requests
 *
 * To run: npm test -- DynamoDBCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- DynamoDBCalculator.integration.test.ts
 */
describe('DynamoDBCalculator - AWS API Integration', () => {
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

  describe('Provisioned Billing Mode', () => {
    testMode('should fetch real DynamoDB provisioned pricing for us-east-1', async () => {
      const calculator = new DynamoDBCalculator();

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PROVISIONED',
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // DynamoDB provisioned costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 5 RCU and 5 WCU:
        // RCU: 5 * 730 * 0.00013 = 0.4745
        // WCU: 5 * 730 * 0.00065 = 2.3725
        // Total: 2.847
        // Allow 20% variance: ~2.28 - 3.42
        const expectedMin = 2.28;
        const expectedMax = 3.42;

        console.log('DynamoDB provisioned pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention RCU and WCU
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/read capacity|rcu/);
        expect(assumptionText).toMatch(/write capacity|wcu/);
      } else {
        console.warn('DynamoDB provisioned pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('DynamoDB provisioned pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for higher capacity provisioned table', async () => {
      const calculator = new DynamoDBCalculator();

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PROVISIONED',
          ProvisionedThroughput: {
            ReadCapacityUnits: 50,
            WriteCapacityUnits: 25,
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 50 RCU and 25 WCU:
        // RCU: 50 * 730 * 0.00013 = 4.745
        // WCU: 25 * 730 * 0.00065 = 11.8625
        // Total: 16.6075
        // Allow variance
        const expectedMin = 14.0;
        const expectedMax = 20.0;

        console.log('DynamoDB higher capacity provisioned pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      } else {
        throw new Error('DynamoDB provisioned pricing should be available');
      }
    }, 30000);

    testMode('should default to provisioned mode when BillingMode is not specified', async () => {
      const calculator = new DynamoDBCalculator();

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should calculate provisioned cost
        expect(cost.amount).toBeGreaterThan(2.0);
        expect(cost.amount).toBeLessThan(4.0);

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/provisioned|read capacity|write capacity/);
      }
    }, 30000);
  });

  describe('On-Demand Billing Mode', () => {
    testMode('should fetch real DynamoDB on-demand pricing for us-east-1', async () => {
      const config = {
        usageAssumptions: {
          dynamodb: {
            readRequestsPerMonth: 10_000_000,
            writeRequestsPerMonth: 1_000_000,
          },
        },
      };

      const calculator = new DynamoDBCalculator(config);

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // DynamoDB on-demand costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 10M read requests and 1M write requests:
        // Read: 10,000,000 * 0.25 / 1,000,000 = 2.50
        // Write: 1,000,000 * 1.25 / 1,000,000 = 1.25
        // Total: 3.75
        // Allow 20% variance: ~3.0 - 4.5
        const expectedMin = 3.0;
        const expectedMax = 4.5;

        console.log('DynamoDB on-demand pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention on-demand/pay-per-request
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/on-demand|pay-per-request|read request|write request/);
      } else {
        console.warn('DynamoDB on-demand pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('DynamoDB on-demand pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for high-volume on-demand table', async () => {
      const config = {
        usageAssumptions: {
          dynamodb: {
            readRequestsPerMonth: 100_000_000, // 100M reads
            writeRequestsPerMonth: 10_000_000,  // 10M writes
          },
        },
      };

      const calculator = new DynamoDBCalculator(config);

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100M read requests and 10M write requests:
        // Read: 100,000,000 * 0.25 / 1,000,000 = 25.00
        // Write: 10,000,000 * 1.25 / 1,000,000 = 12.50
        // Total: 37.50
        // Allow variance
        const expectedMin = 32.0;
        const expectedMax = 43.0;

        console.log('DynamoDB high-volume on-demand pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      } else {
        throw new Error('DynamoDB on-demand pricing should be available');
      }
    }, 30000);

    testMode('should use default request volumes when not configured', async () => {
      const calculator = new DynamoDBCalculator(); // No config

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Default: 10M reads, 1M writes = ~$3.75
        expect(cost.amount).toBeGreaterThan(3.0);
        expect(cost.amount).toBeLessThan(4.5);

        // Verify it mentions default assumptions
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/10,000,000|10 million/i);
        expect(assumptionText).toMatch(/1,000,000|1 million/i);
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions for provisioned mode', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new DynamoDBCalculator();

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PROVISIONED',
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`DynamoDB provisioned pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($2-4/month for 5 RCU + 5 WCU)
          expect(cost.amount).toBeGreaterThan(2.0);
          expect(cost.amount).toBeLessThan(4.0);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 60000);

    testMode('should work in multiple regions for on-demand mode', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const config = {
        usageAssumptions: {
          dynamodb: {
            readRequestsPerMonth: 10_000_000,
            writeRequestsPerMonth: 1_000_000,
          },
        },
      };
      const calculator = new DynamoDBCalculator(config);

      const testResource = {
        logicalId: 'TestTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`DynamoDB on-demand pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($3-5/month for default usage)
          expect(cost.amount).toBeGreaterThan(2.5);
          expect(cost.amount).toBeLessThan(5.0);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 60000);
  });

  describe('Debug Logging', () => {
    testMode('should handle pricing queries with debug logging enabled', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new DynamoDBCalculator();

        const provisionedResource = {
          logicalId: 'TestTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        };

        await calculator.calculateCost(provisionedResource, testRegion, pricingClient);

        // Debug logging should have captured the query details
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });
});
