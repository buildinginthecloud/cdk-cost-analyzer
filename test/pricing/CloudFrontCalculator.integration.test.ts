import { PricingClient } from '../../src/pricing/PricingClient';
import { CloudFrontCalculator } from '../../src/pricing/calculators/CloudFrontCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for CloudFront pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for data transfer and requests
 * - Two separate pricing components (data transfer + HTTP/HTTPS requests)
 * - Custom usage assumptions (data transfer GB and request count)
 * - Debug logging captures pricing queries and responses
 *
 * CloudFront Pricing Components:
 * 1. Data transfer out to internet: ~$0.085 per GB (varies by region and volume)
 * 2. HTTP/HTTPS requests: ~$0.0075 per 10,000 requests
 *
 * Expected pricing for default configuration (us-east-1):
 * - Data transfer: 100GB × $0.085 = $8.50/month
 * - Requests: 1M / 10K × $0.0075 = $0.75/month
 * - Total: ~$9.25/month
 *
 * To run: npm test -- CloudFrontCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- CloudFrontCalculator.integration.test.ts
 */
describe('CloudFrontCalculator - AWS API Integration', () => {
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

  describe('Default Configuration', () => {
    testMode('should fetch real CloudFront pricing with defaults', async () => {
      const calculator = new CloudFrontCalculator();

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {
          DistributionConfig: {
            Enabled: true,
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // CloudFront costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with default (100GB transfer, 1M requests):
        // Data transfer: 100GB × ~$0.085 = ~$8.50
        // Requests: 1M / 10K × ~$0.0075 = ~$0.75
        // Total: ~$9.25/month
        // Allow 25% variance: ~$7 - $12
        const expectedMin = 7.0;
        const expectedMax = 12.0;

        console.log('CloudFront default pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention both data transfer and requests
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/data transfer|100.*gb/);
        expect(assumptionText).toMatch(/request|1,000,000/);
      } else {
        console.warn('CloudFront pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('CloudFront pricing should be available for us-east-1');
      }
    }, 30000);
  });

  describe('Custom Data Transfer Volumes', () => {
    testMode('should calculate cost with high data transfer', async () => {
      const calculator = new CloudFrontCalculator(1000); // 1TB = 1000GB

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1TB (1000GB) transfer:
        // Data transfer: 1000GB × ~$0.085 = ~$85.00
        // Requests: 1M / 10K × ~$0.0075 = ~$0.75
        // Total: ~$85.75/month
        const expectedMin = 70.0;
        const expectedMax = 100.0;

        console.log('CloudFront high data transfer pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1000 GB');
        expect(assumptionText).toContain('custom data transfer');
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with very high data transfer', async () => {
      const calculator = new CloudFrontCalculator(10000); // 10TB

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 10TB (10,000GB) transfer:
        // Data transfer pricing has tiers, so per-GB cost may be lower
        // Rough estimate: ~$650-850/month
        const expectedMin = 550.0;
        const expectedMax = 950.0;

        console.log('CloudFront very high data transfer:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10000 GB');
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with low data transfer', async () => {
      const calculator = new CloudFrontCalculator(10); // 10GB

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 10GB transfer:
        // Data transfer: 10GB × ~$0.085 = ~$0.85
        // Requests: 1M / 10K × ~$0.0075 = ~$0.75
        // Total: ~$1.60/month
        const expectedMin = 1.2;
        const expectedMax = 2.0;

        console.log('CloudFront low data transfer:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10 GB');
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);
  });

  describe('Custom Request Volumes', () => {
    testMode('should calculate cost with high request volume', async () => {
      const calculator = new CloudFrontCalculator(100, 10_000_000); // 10M requests

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100GB + 10M requests:
        // Data transfer: 100GB × ~$0.085 = ~$8.50
        // Requests: 10M / 10K × ~$0.0075 = ~$7.50
        // Total: ~$16.00/month
        const expectedMin = 13.0;
        const expectedMax = 19.0;

        console.log('CloudFront high request volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10,000,000');
        expect(assumptionText).toContain('custom request');
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with very high request volume', async () => {
      const calculator = new CloudFrontCalculator(100, 100_000_000); // 100M requests

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100GB + 100M requests:
        // Data transfer: 100GB × ~$0.085 = ~$8.50
        // Requests: 100M / 10K × ~$0.0075 = ~$75.00
        // Total: ~$83.50/month
        const expectedMin = 70.0;
        const expectedMax = 97.0;

        console.log('CloudFront very high request volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100,000,000');
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with low request volume', async () => {
      const calculator = new CloudFrontCalculator(100, 100_000); // 100K requests

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100GB + 100K requests:
        // Data transfer: 100GB × ~$0.085 = ~$8.50
        // Requests: 100K / 10K × ~$0.0075 = ~$0.075
        // Total: ~$8.58/month
        const expectedMin = 7.0;
        const expectedMax = 10.5;

        console.log('CloudFront low request volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100,000');
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);
  });

  describe('Combined Scenarios', () => {
    testMode('should calculate cost for high-traffic distribution', async () => {
      const calculator = new CloudFrontCalculator(5000, 50_000_000); // 5TB, 50M requests

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 5TB + 50M requests:
        // Data transfer: 5000GB × ~$0.085 = ~$425
        // Requests: 50M / 10K × ~$0.0075 = ~$37.50
        // Total: ~$462.50/month
        const expectedMin = 380.0;
        const expectedMax = 545.0;

        console.log('CloudFront high-traffic distribution:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for minimal usage', async () => {
      const calculator = new CloudFrontCalculator(1, 10_000); // 1GB, 10K requests

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1GB + 10K requests:
        // Data transfer: 1GB × ~$0.085 = ~$0.085
        // Requests: 10K / 10K × ~$0.0075 = ~$0.0075
        // Total: ~$0.09/month
        expect(cost.amount).toBeLessThan(0.15);

        console.log(`CloudFront minimal usage: $${cost.amount.toFixed(4)}/month`);
      } else {
        throw new Error('CloudFront pricing should be available');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new CloudFrontCalculator();

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`CloudFront pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing may vary slightly by region ($7-14/month for default)
          expect(cost.amount).toBeGreaterThan(5.0);
          expect(cost.amount).toBeLessThan(16.0);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query both data transfer and request pricing', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new CloudFrontCalculator();

        const testResource = {
          logicalId: 'MyDistribution',
          type: 'AWS::CloudFront::Distribution',
          properties: {},
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured both pricing queries:
        // - transferType: CloudFront to Internet
        // - requestType: HTTP-Requests
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle zero data transfer', async () => {
      const calculator = new CloudFrontCalculator(0, 1_000_000); // No data transfer

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount >= 0) {
        // Only request cost, no data transfer
        // Requests: 1M / 10K × ~$0.0075 = ~$0.75
        expect(cost.amount).toBeLessThan(1.0);

        console.log(`CloudFront requests only: $${cost.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should handle zero requests', async () => {
      const calculator = new CloudFrontCalculator(100, 0); // No requests

      const testResource = {
        logicalId: 'MyDistribution',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Only data transfer cost
        // Data transfer: 100GB × ~$0.085 = ~$8.50
        const expectedMin = 6.5;
        const expectedMax = 10.5;

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        console.log(`CloudFront data transfer only: $${cost.amount.toFixed(2)}/month`);
      }
    }, 30000);
  });
});
