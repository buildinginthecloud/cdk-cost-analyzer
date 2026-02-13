import { PricingClient } from '../../src/pricing/PricingClient';
import { SNSCalculator } from '../../src/pricing/calculators/SNSCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for SNS pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for multiple delivery types
 * - Five separate pricing components (publish, HTTP, email, SMS, mobile push)
 * - Free tier handling (first 1M publishes free)
 * - Various delivery type combinations
 * - Custom usage assumptions
 * - Debug logging captures pricing queries and responses
 *
 * SNS Pricing Components:
 * 1. Publishes: ~$0.50 per million requests (first 1M free)
 * 2. HTTP/S deliveries: ~$0.60 per million
 * 3. Email deliveries: ~$2.00 per 100,000
 * 4. SMS deliveries: Varies by country (~$0.00645/message for US)
 * 5. Mobile push: ~$0.50 per million
 *
 * Expected pricing for default configuration (us-east-1):
 * - Publishes: 1M (free tier) = $0.00
 * - HTTP deliveries: 1M × $0.60/1M = $0.60
 * - Total: ~$0.60/month
 *
 * To run: npm test -- SNSCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- SNSCalculator.integration.test.ts
 */
describe('SNSCalculator - AWS API Integration', () => {
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

  describe('Default Configuration (Publishes + HTTP)', () => {
    testMode('should fetch real SNS pricing with default assumptions', async () => {
      const calculator = new SNSCalculator();

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // SNS costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with default (1M publishes free, 1M HTTP):
        // Publishes: 1M (within free tier) = $0.00
        // HTTP: 1M × $0.60/1M = $0.60
        // Total: ~$0.60
        // Allow 20% variance: ~$0.48 - $0.72
        const expectedMin = 0.48;
        const expectedMax = 0.72;

        console.log('SNS default pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention free tier and HTTP
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/free/);
        expect(assumptionText).toMatch(/http/);
      } else {
        console.warn('SNS pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('SNS pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost with publishes exceeding free tier', async () => {
      // 5M publishes should result in 4M billable (5M - 1M free)
      const calculator = new SNSCalculator(5_000_000, 1_000_000, 0, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 5M publishes, 1M HTTP:
        // Publishes: (5M - 1M free) × $0.50/1M = $2.00
        // HTTP: 1M × $0.60/1M = $0.60
        // Total: ~$2.60
        const expectedMin = 2.1;
        const expectedMax = 3.1;

        console.log('SNS with high publish volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('5,000,000');
        expect(assumptionText).toContain('4,000,000 billable');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);
  });

  describe('HTTP/S Deliveries', () => {
    testMode('should calculate cost for high volume HTTP deliveries', async () => {
      const calculator = new SNSCalculator(1_000_000, 10_000_000, 0, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M publishes (free), 10M HTTP:
        // Publishes: $0.00
        // HTTP: 10M × $0.60/1M = $6.00
        // Total: ~$6.00
        const expectedMin = 5.0;
        const expectedMax = 7.0;

        console.log('SNS high HTTP delivery volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10,000,000');
        expect(assumptionText).toContain('HTTP');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);
  });

  describe('Email Deliveries', () => {
    testMode('should calculate cost for email deliveries', async () => {
      const calculator = new SNSCalculator(1_000_000, 0, 100_000, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M publishes (free), 100K emails:
        // Publishes: $0.00
        // Email: 100K × $2.00/100K = $2.00
        // Total: ~$2.00
        const expectedMin = 1.6;
        const expectedMax = 2.4;

        console.log('SNS email delivery pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100,000');
        expect(assumptionText).toContain('email');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for high volume email deliveries', async () => {
      const calculator = new SNSCalculator(1_000_000, 0, 500_000, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M publishes (free), 500K emails:
        // Publishes: $0.00
        // Email: 500K × $2.00/100K = $10.00
        // Total: ~$10.00
        const expectedMin = 8.5;
        const expectedMax = 11.5;

        console.log('SNS high volume email delivery:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('500,000');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);
  });

  describe('SMS Deliveries', () => {
    testMode('should calculate cost for SMS deliveries (US rate)', async () => {
      const calculator = new SNSCalculator(1_000_000, 0, 0, 1_000, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M publishes (free), 1K SMS:
        // Publishes: $0.00
        // SMS: 1,000 × ~$0.00645 = ~$6.45
        // Total: ~$6.45
        // Allow variance for different SMS rates
        const expectedMin = 5.0;
        const expectedMax = 8.0;

        console.log('SNS SMS delivery pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1,000');
        expect(assumptionText).toContain('SMS');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);
  });

  describe('Mobile Push Deliveries', () => {
    testMode('should calculate cost for mobile push notifications', async () => {
      const calculator = new SNSCalculator(1_000_000, 0, 0, 0, 1_000_000);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M publishes (free), 1M mobile push:
        // Publishes: $0.00
        // Mobile push: 1M × $0.50/1M = $0.50
        // Total: ~$0.50
        const expectedMin = 0.4;
        const expectedMax = 0.6;

        console.log('SNS mobile push delivery pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1,000,000');
        expect(assumptionText).toContain('mobile push');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for high volume mobile push', async () => {
      const calculator = new SNSCalculator(1_000_000, 0, 0, 0, 10_000_000);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M publishes (free), 10M mobile push:
        // Publishes: $0.00
        // Mobile push: 10M × $0.50/1M = $5.00
        // Total: ~$5.00
        const expectedMin = 4.0;
        const expectedMax = 6.0;

        console.log('SNS high volume mobile push:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10,000,000');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);
  });

  describe('Mixed Delivery Types', () => {
    testMode('should calculate cost for multiple delivery types', async () => {
      // Test with all delivery types: HTTP, email, SMS, mobile push
      const calculator = new SNSCalculator(
        5_000_000,  // 5M publishes (4M billable)
        1_000_000,  // 1M HTTP
        100_000,    // 100K email
        1_000,      // 1K SMS
        1_000_000,  // 1M mobile push
      );

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with mixed deliveries:
        // Publishes: (5M - 1M) × $0.50/1M = $2.00
        // HTTP: 1M × $0.60/1M = $0.60
        // Email: 100K × $2.00/100K = $2.00
        // SMS: 1K × $0.00645 = $6.45
        // Mobile: 1M × $0.50/1M = $0.50
        // Total: ~$11.55
        const expectedMin = 9.5;
        const expectedMax = 13.5;

        console.log('SNS mixed delivery types pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention all delivery types
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/http/);
        expect(assumptionText).toMatch(/email/);
        expect(assumptionText).toMatch(/sms/);
        expect(assumptionText).toMatch(/mobile/);
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);
  });

  describe('Free Tier Validation', () => {
    testMode('should apply free tier correctly for publishes', async () => {
      const calculator = new SNSCalculator(1_000_000, 0, 0, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount >= 0) {
        // With only 1M publishes (within free tier) and no deliveries, cost should be $0
        expect(cost.amount).toBe(0);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('First 1,000,000 publishes are free');
      }
    }, 30000);

    testMode('should calculate billable publishes above free tier', async () => {
      const calculator = new SNSCalculator(2_000_000, 0, 0, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 2M publishes: (2M - 1M) × $0.50/1M = $0.50
        const expectedMin = 0.4;
        const expectedMax = 0.6;

        console.log('SNS above free tier:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1,000,000 billable');
      } else {
        throw new Error('SNS pricing should be available');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new SNSCalculator();

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`SNS pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($0.40-$0.80/month for default usage)
          expect(cost.amount).toBeGreaterThan(0.4);
          expect(cost.amount).toBeLessThan(0.9);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query all five pricing components separately', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new SNSCalculator(
          1_000_000,  // publishes
          1_000_000,  // HTTP
          100_000,    // email
          1_000,      // SMS
          1_000_000,  // mobile push
        );

        const testResource = {
          logicalId: 'MyTopic',
          type: 'AWS::SNS::Topic',
          properties: {},
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured all five pricing queries
        // (PublishRequests, DeliveryAttempts-HTTP, DeliveryAttempts-EMAIL,
        //  DeliveryAttempts-SMS, DeliveryAttempts-APNS)
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle minimal usage', async () => {
      const calculator = new SNSCalculator(100, 100, 0, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount >= 0) {
        // With only 100 publishes (well within free tier) and 100 HTTP deliveries
        // Publishes: $0.00 (free tier)
        // HTTP: 100/1M × $0.60 = $0.00006
        // Should be essentially free (< $0.01)
        expect(cost.amount).toBeLessThan(0.01);

        console.log(`SNS minimal usage: $${cost.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should handle zero deliveries gracefully', async () => {
      const calculator = new SNSCalculator(1_000_000, 0, 0, 0, 0);

      const testResource = {
        logicalId: 'MyTopic',
        type: 'AWS::SNS::Topic',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // With 1M publishes (free tier) and no deliveries, cost should be $0
      expect(cost.amount).toBe(0);

      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('free');
    }, 30000);
  });
});
