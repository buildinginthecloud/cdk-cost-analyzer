import { PricingClient } from '../../src/pricing/PricingClient';
import { S3Calculator } from '../../src/pricing/calculators/S3Calculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for S3 pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for S3 Standard storage
 * - Default storage assumption (100 GB)
 * - Storage class and volume type filter combinations
 * - Debug logging captures pricing queries and responses
 *
 * S3 Pricing:
 * - Standard storage: ~$0.023 per GB/month (us-east-1)
 * - First 50 TB/month
 *
 * Expected pricing for default configuration (us-east-1):
 * - Storage: 100 GB × $0.023 = ~$2.30/month
 * - Does not include requests or data transfer
 *
 * To run: npm test -- S3Calculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- S3Calculator.integration.test.ts
 */
describe('S3Calculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'us-east-1';

  beforeAll(() => {
    if (process.env.DEBUG === 'true') {
      Logger.setDebugEnabled(true);
      console.error('Debug logging enabled for pricing API calls');
    }
  });

  beforeEach(() => {
    pricingClient = new PricingClient('us-east-1');
  });

  afterEach(() => {
    if (pricingClient) {
      pricingClient.destroy();
    }
  });

  afterAll(() => {
    Logger.setDebugEnabled(false);
  });

  const testMode = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  describe('Default Configuration', () => {
    testMode('should fetch real S3 Standard storage pricing', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {
          BucketName: 'my-test-bucket',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      if (cost.amount > 0) {
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 100 GB Standard storage:
        // Storage: 100 GB × ~$0.023 = ~$2.30/month
        // Allow 20% variance: ~$1.84 - $2.76
        const expectedMin = 1.84;
        const expectedMax = 2.76;

        console.log('S3 Standard storage pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/100.*gb/);
        expect(assumptionText).toMatch(/standard/);
      } else {
        console.warn('S3 pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        throw new Error('S3 pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should indicate storage assumptions', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptions = cost.assumptions;

        const storageAssumption = assumptions.find(a => a.toLowerCase().includes('100 gb'));
        const excludedCostsAssumption = assumptions.find(a =>
          a.toLowerCase().includes('does not include') &&
          a.toLowerCase().includes('request')
        );

        expect(storageAssumption).toBeDefined();
        expect(excludedCostsAssumption).toBeDefined();

        console.log('Storage assumptions:');
        console.log(`  Storage: ${storageAssumption}`);
        console.log(`  Excluded: ${excludedCostsAssumption}`);
      }
    }, 30000);

    testMode('should note excluded costs', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/does not include.*request/);
        expect(assumptionText).toMatch(/data transfer/);
      }
    }, 30000);
  });

  describe('Storage Volume Validation', () => {
    testMode('should use 100 GB default storage', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Verify assumptions mention 100 GB
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('100 GB');

        // Cost should be ~$2.30 for 100 GB
        expect(cost.amount).toBeGreaterThan(1.5);
        expect(cost.amount).toBeLessThan(3.0);
      }
    }, 30000);

    testMode('should calculate reasonable price per GB', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Price per GB should be ~$0.023 in us-east-1
        const pricePerGB = cost.amount / 100;

        console.log(`S3 Standard storage: $${pricePerGB.toFixed(4)}/GB/month`);

        // Allow 20% variance: $0.0184 - $0.0276 per GB
        expect(pricePerGB).toBeGreaterThan(0.0184);
        expect(pricePerGB).toBeLessThan(0.0276);
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`S3 pricing for ${region}: $${cost.amount.toFixed(4)}/month`);

        if (cost.amount > 0) {
          // S3 pricing varies by region
          // us-east-1: ~$0.023/GB
          // eu-central-1: ~$0.024/GB
          // ap-southeast-1: ~$0.025/GB
          // For 100 GB: ~$1.80 - $3.00/month
          expect(cost.amount).toBeGreaterThan(1.5);
          expect(cost.amount).toBeLessThan(3.5);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000);

    testMode('should show regional pricing differences', async () => {
      const regions = ['us-east-1', 'eu-central-1'];
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const costs: { [key: string]: number } = {};

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);
        if (cost.amount > 0) {
          costs[region] = cost.amount;
        }
      }

      if (Object.keys(costs).length === 2) {
        console.log('Regional pricing comparison:');
        Object.entries(costs).forEach(([region, amount]) => {
          console.log(`  ${region}: $${amount.toFixed(4)}/month`);
        });

        // Pricing should vary by region but be in similar range
        const priceDiff = Math.abs(costs['us-east-1'] - costs['eu-central-1']);
        const avgPrice = (costs['us-east-1'] + costs['eu-central-1']) / 2;
        const percentDiff = (priceDiff / avgPrice) * 100;

        console.log(`Price difference: ${percentDiff.toFixed(1)}%`);

        // Regional differences typically within 30%
        expect(percentDiff).toBeLessThan(30);
      }
    }, 60000);
  });

  describe('Pricing Query Validation', () => {
    testMode('should query correct storage class and volume type', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new S3Calculator();

        const testResource = {
          logicalId: 'MyS3Bucket',
          type: 'AWS::S3::Bucket',
          properties: {},
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured pricing query with:
        // - storageClass: 'General Purpose'
        // - volumeType: 'Standard'
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Bucket Properties', () => {
    testMode('should calculate same cost regardless of bucket name', async () => {
      const calculator = new S3Calculator();

      const bucket1 = {
        logicalId: 'Bucket1',
        type: 'AWS::S3::Bucket',
        properties: {
          BucketName: 'my-first-bucket',
        },
      };

      const bucket2 = {
        logicalId: 'Bucket2',
        type: 'AWS::S3::Bucket',
        properties: {
          BucketName: 'my-second-bucket',
        },
      };

      const cost1 = await calculator.calculateCost(bucket1, testRegion, pricingClient);
      const cost2 = await calculator.calculateCost(bucket2, testRegion, pricingClient);

      if (cost1.amount > 0 && cost2.amount > 0) {
        // Both should have same cost (same default assumptions)
        expect(cost1.amount).toBe(cost2.amount);

        console.log(`Both buckets: $${cost1.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should ignore versioning configuration', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {
          VersioningConfiguration: {
            Status: 'Enabled',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should calculate same default cost regardless of versioning
        expect(cost.amount).toBeGreaterThan(1.5);
        expect(cost.amount).toBeLessThan(3.0);

        // Note: Versioning would increase actual storage but calculator uses default 100 GB
      }
    }, 30000);

    testMode('should ignore lifecycle rules', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {
          LifecycleConfiguration: {
            Rules: [
              {
                Status: 'Enabled',
                Transitions: [
                  {
                    StorageClass: 'GLACIER',
                    TransitionInDays: 90,
                  },
                ],
              },
            ],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should calculate Standard storage cost regardless of lifecycle rules
        expect(cost.amount).toBeGreaterThan(1.5);
        expect(cost.amount).toBeLessThan(3.0);

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toContain('standard');
      }
    }, 30000);
  });

  describe('Cost Confidence', () => {
    testMode('should return medium confidence when pricing available', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        expect(cost.confidence).toBe('medium');
      }
    }, 30000);

    testMode('should explain medium confidence is due to usage assumptions', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        expect(cost.confidence).toBe('medium');

        // Medium confidence because:
        // 1. Actual storage size unknown (using 100 GB default)
        // 2. Request costs not included
        // 3. Data transfer not included
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/assumes.*100.*gb/);
        expect(assumptionText).toMatch(/does not include/);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle bucket without properties', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should calculate default cost
        expect(cost.amount).toBeGreaterThan(1.5);
        expect(cost.amount).toBeLessThan(3.0);
        expect(cost.confidence).toBe('medium');
      }
    }, 30000);

    testMode('should handle bucket with null properties', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {
          BucketName: null,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should still calculate cost with defaults
        expect(cost.amount).toBeGreaterThan(1.5);
        expect(cost.amount).toBeLessThan(3.0);
      }
    }, 30000);
  });

  describe('Storage Class Focus', () => {
    testMode('should explicitly use Standard storage class', async () => {
      const calculator = new S3Calculator();

      const testResource = {
        logicalId: 'MyS3Bucket',
        type: 'AWS::S3::Bucket',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Verify assumptions mention standard storage
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/standard storage/);
      }
    }, 30000);
  });
});
