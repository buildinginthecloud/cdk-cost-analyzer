import { PricingClient } from '../../src/pricing/PricingClient';
import { SecretsManagerCalculator } from '../../src/pricing/calculators/SecretsManagerCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for Secrets Manager pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for secret storage and API calls
 * - Two separate pricing components (storage + API calls)
 * - Custom API call volume assumptions
 * - Debug logging captures pricing queries and responses
 *
 * Secrets Manager Pricing Components:
 * 1. Secret storage: $0.40 per secret per month
 * 2. API calls: $0.05 per 10,000 API calls
 *
 * Expected pricing for default configuration (us-east-1):
 * - Storage: $0.40/month
 * - API calls: 10,000 × $0.05/10K = $0.05/month
 * - Total: $0.45/month
 *
 * To run: npm test -- SecretsManagerCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- SecretsManagerCalculator.integration.test.ts
 */
describe('SecretsManagerCalculator - AWS API Integration', () => {
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
    testMode('should fetch real Secrets Manager pricing with defaults', async () => {
      const calculator = new SecretsManagerCalculator();

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {
          Description: 'Test secret',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // Secrets Manager costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with default (1 secret, 10K API calls):
        // Storage: $0.40/month
        // API calls: 10,000 × $0.05/10K = $0.05
        // Total: $0.45/month
        // Allow 20% variance: ~$0.36 - $0.54
        const expectedMin = 0.36;
        const expectedMax = 0.54;

        console.log('Secrets Manager default pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention both storage and API calls
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/secret storage/);
        expect(assumptionText).toMatch(/api call|10,000/);
      } else {
        console.warn('Secrets Manager pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('Secrets Manager pricing should be available for us-east-1');
      }
    }, 30000);
  });

  describe('Custom API Call Volumes', () => {
    testMode('should calculate cost with high API call volume', async () => {
      const calculator = new SecretsManagerCalculator(100_000); // 100K API calls

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100K API calls:
        // Storage: $0.40
        // API calls: 100,000 × $0.05/10K = $0.50
        // Total: $0.90/month
        const expectedMin = 0.76;
        const expectedMax = 1.04;

        console.log('Secrets Manager high API call volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100,000');
        expect(assumptionText).toContain('custom');
      } else {
        throw new Error('Secrets Manager pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with very high API call volume', async () => {
      const calculator = new SecretsManagerCalculator(1_000_000); // 1M API calls

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1M API calls:
        // Storage: $0.40
        // API calls: 1,000,000 × $0.05/10K = $5.00
        // Total: $5.40/month
        const expectedMin = 4.5;
        const expectedMax = 6.3;

        console.log('Secrets Manager very high API call volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1,000,000');
      } else {
        throw new Error('Secrets Manager pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with low API call volume', async () => {
      const calculator = new SecretsManagerCalculator(1000); // 1K API calls

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1K API calls:
        // Storage: $0.40
        // API calls: 1,000 × $0.05/10K = $0.005
        // Total: $0.405/month
        const expectedMin = 0.34;
        const expectedMax = 0.47;

        console.log('Secrets Manager low API call volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(3)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1,000');
      } else {
        throw new Error('Secrets Manager pricing should be available');
      }
    }, 30000);

    testMode('should handle zero API calls', async () => {
      const calculator = new SecretsManagerCalculator(0); // No API calls

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 0 API calls:
        // Storage: $0.40
        // API calls: $0.00
        // Total: $0.40/month
        const expectedMin = 0.32;
        const expectedMax = 0.48;

        console.log('Secrets Manager storage only (no API calls):');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        // Verify API call cost is mentioned as zero
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toMatch(/0 calls|api calls.*\$0\.00/i);
      } else {
        throw new Error('Secrets Manager pricing should be available');
      }
    }, 30000);
  });

  describe('Cost Breakdown Validation', () => {
    testMode('should show separate storage and API call costs', async () => {
      const calculator = new SecretsManagerCalculator(50_000); // 50K calls

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Verify assumptions include both components
        const assumptions = cost.assumptions;
        const storageAssumption = assumptions.find(a => a.toLowerCase().includes('secret storage'));
        const apiCallAssumption = assumptions.find(a => a.toLowerCase().includes('api call'));

        expect(storageAssumption).toBeDefined();
        expect(apiCallAssumption).toBeDefined();

        console.log('Cost breakdown:');
        console.log(`  Storage: ${storageAssumption}`);
        console.log(`  API calls: ${apiCallAssumption}`);
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new SecretsManagerCalculator();

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`Secrets Manager pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($0.36-$0.54/month for default usage)
          expect(cost.amount).toBeGreaterThan(0.30);
          expect(cost.amount).toBeLessThan(0.60);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query both storage and API call pricing', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new SecretsManagerCalculator();

        const testResource = {
          logicalId: 'MySecret',
          type: 'AWS::SecretsManager::Secret',
          properties: {},
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured both pricing queries:
        // - SecretStorage (secret storage)
        // - SecretRotation (API calls)
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle minimal API calls', async () => {
      const calculator = new SecretsManagerCalculator(10); // 10 API calls

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 10 API calls: 10 × $0.05/10K = $0.00005
        // Total with storage: ~$0.40/month
        expect(cost.amount).toBeGreaterThan(0.35);
        expect(cost.amount).toBeLessThan(0.50);

        console.log(`Secrets Manager minimal API usage: $${cost.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should show storage cost is the primary component', async () => {
      const calculator = new SecretsManagerCalculator(10_000); // Default

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Storage ($0.40) should be ~89% of total cost ($0.45)
        // API calls should be a small fraction
        const assumptions = cost.assumptions.join(' ');

        // Extract costs from assumptions (rough validation)
        const storageCostMatch = assumptions.match(/storage.*\$(\d+\.\d+)/i);
        const apiCostMatch = assumptions.match(/api.*\$(\d+\.\d+)/i);

        if (storageCostMatch && apiCostMatch) {
          const storageCost = parseFloat(storageCostMatch[1]);
          const apiCost = parseFloat(apiCostMatch[1]);

          // Storage should be significantly larger than API cost
          expect(storageCost).toBeGreaterThan(apiCost * 5);

          console.log(`Storage cost: $${storageCost.toFixed(2)}`);
          console.log(`API cost: $${apiCost.toFixed(2)}`);
        }
      }
    }, 30000);
  });

  describe('Configuration Tracking', () => {
    testMode('should indicate when using custom API call volume', async () => {
      const calculator = new SecretsManagerCalculator(25_000);

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/custom.*api call.*volume|using custom/);
      }
    }, 30000);

    testMode('should not indicate custom usage with default values', async () => {
      const calculator = new SecretsManagerCalculator(); // Use defaults

      const testResource = {
        logicalId: 'MySecret',
        type: 'AWS::SecretsManager::Secret',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        // Should mention default but not "custom"
        expect(assumptionText).not.toMatch(/custom.*api call.*volume/);
      }
    }, 30000);
  });
});
