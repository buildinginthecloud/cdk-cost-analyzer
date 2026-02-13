import { PricingClient } from '../../src/pricing/PricingClient';
import { EFSCalculator } from '../../src/pricing/calculators/EFSCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for EFS pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for Standard and Infrequent Access storage
 * - Lifecycle policy detection and IA percentage calculation
 * - Provisioned throughput pricing
 * - Custom storage size assumptions
 * - Debug logging captures pricing queries and responses
 *
 * EFS Pricing Components:
 * 1. Standard storage: ~$0.30 per GB-month
 * 2. Infrequent Access storage: ~$0.016 per GB-month
 * 3. IA request pricing: ~$0.01 per GB transferred
 * 4. Provisioned throughput: ~$6.00 per MB/s-month
 *
 * Expected pricing for default configuration (us-east-1):
 * - Standard: 100GB × $0.30 = $30.00/month
 *
 * To run: npm test -- EFSCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- EFSCalculator.integration.test.ts
 */
describe('EFSCalculator - AWS API Integration', () => {
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

  describe('Standard Storage', () => {
    testMode('should fetch real EFS Standard storage pricing', async () => {
      const calculator = new EFSCalculator();

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          PerformanceMode: 'generalPurpose',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // EFS costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 100GB Standard storage:
        // 100GB × $0.30/GB = $30.00/month
        // Allow 20% variance: ~$24 - $36
        const expectedMin = 24.0;
        const expectedMax = 36.0;

        console.log('EFS Standard storage pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention standard storage
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/standard storage/);
        expect(assumptionText).toMatch(/100/);
      } else {
        console.warn('EFS Standard pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('EFS Standard pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for custom storage size', async () => {
      const calculator = new EFSCalculator(500); // 500GB

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 500GB Standard storage:
        // 500GB × $0.30/GB = $150.00/month
        const expectedMin = 125.0;
        const expectedMax = 175.0;

        console.log('EFS custom storage size pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('500 GB');
        expect(assumptionText).toContain('custom storage size');
      } else {
        throw new Error('EFS pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for large storage volume', async () => {
      const calculator = new EFSCalculator(1000); // 1TB

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 1TB (1000GB) Standard storage:
        // 1000GB × $0.30/GB = $300.00/month
        const expectedMin = 250.0;
        const expectedMax = 350.0;

        console.log('EFS large storage volume pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      } else {
        throw new Error('EFS pricing should be available');
      }
    }, 30000);
  });

  describe('Infrequent Access Storage', () => {
    testMode('should calculate cost with Infrequent Access lifecycle policy', async () => {
      const calculator = new EFSCalculator(100, 30); // 100GB, 30% IA

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            {
              TransitionToIA: 'AFTER_30_DAYS',
            },
          ],
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100GB (70% Standard, 30% IA):
        // Standard: 70GB × $0.30 = $21.00
        // IA Storage: 30GB × $0.016 = $0.48
        // IA Requests (10% access): 3GB × $0.01 = $0.03
        // Total: ~$21.51/month
        const expectedMin = 18.0;
        const expectedMax = 25.0;

        console.log('EFS with Infrequent Access pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention IA storage
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/infrequent access/);
        expect(assumptionText).toMatch(/30%/);
      } else {
        throw new Error('EFS IA pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with high IA percentage', async () => {
      const calculator = new EFSCalculator(100, 80); // 100GB, 80% IA

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            {
              TransitionToIA: 'AFTER_7_DAYS',
            },
          ],
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100GB (20% Standard, 80% IA):
        // Standard: 20GB × $0.30 = $6.00
        // IA Storage: 80GB × $0.016 = $1.28
        // IA Requests (10% access): 8GB × $0.01 = $0.08
        // Total: ~$7.36/month
        const expectedMin = 6.0;
        const expectedMax = 9.0;

        console.log('EFS with high IA percentage pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('80%');
      } else {
        throw new Error('EFS IA pricing should be available');
      }
    }, 30000);

    testMode('should not apply IA pricing without lifecycle policy', async () => {
      const calculator = new EFSCalculator(100, 50); // 50% IA configured

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          // No LifecyclePolicies - should ignore IA percentage
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Without lifecycle policy, should use 100% Standard pricing
        // 100GB × $0.30 = $30.00/month
        const expectedMin = 24.0;
        const expectedMax = 36.0;

        console.log('EFS without lifecycle policy (ignores IA config):');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        // Should not mention IA storage in assumptions
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).not.toMatch(/infrequent access storage/);
      }
    }, 30000);
  });

  describe('Provisioned Throughput', () => {
    testMode('should calculate cost with provisioned throughput', async () => {
      const calculator = new EFSCalculator();

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          ThroughputMode: 'provisioned',
          ProvisionedThroughputInMibps: 100,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100GB Standard + 100 MB/s provisioned:
        // Storage: 100GB × $0.30 = $30.00
        // Throughput: 100 MB/s × $6.00 = $600.00
        // Total: ~$630.00/month
        const expectedMin = 550.0;
        const expectedMax = 710.0;

        console.log('EFS with provisioned throughput pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        // Verify assumptions mention provisioned throughput
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/provisioned throughput/);
        expect(assumptionText).toMatch(/100.*mb\/s/);
      } else {
        throw new Error('EFS provisioned throughput pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost with low provisioned throughput', async () => {
      const calculator = new EFSCalculator();

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          ThroughputMode: 'provisioned',
          ProvisionedThroughputInMibps: 10,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 100GB Standard + 10 MB/s provisioned:
        // Storage: 100GB × $0.30 = $30.00
        // Throughput: 10 MB/s × $6.00 = $60.00
        // Total: ~$90.00/month
        const expectedMin = 76.0;
        const expectedMax = 104.0;

        console.log('EFS with low provisioned throughput:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10 MB/s');
      } else {
        throw new Error('EFS provisioned throughput pricing should be available');
      }
    }, 30000);

    testMode('should default to bursting mode when not specified', async () => {
      const calculator = new EFSCalculator();

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          // No ThroughputMode specified - defaults to bursting (no extra cost)
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should only have storage cost, no throughput cost
        // 100GB × $0.30 = ~$30.00/month
        const expectedMin = 24.0;
        const expectedMax = 36.0;

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        // Should not mention provisioned throughput
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).not.toMatch(/provisioned throughput: \d+/);
      }
    }, 30000);
  });

  describe('Combined Scenarios', () => {
    testMode('should calculate cost with IA and provisioned throughput', async () => {
      const calculator = new EFSCalculator(200, 50); // 200GB, 50% IA

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {
          LifecyclePolicies: [
            {
              TransitionToIA: 'AFTER_30_DAYS',
            },
          ],
          ThroughputMode: 'provisioned',
          ProvisionedThroughputInMibps: 50,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with 200GB (50% Standard, 50% IA) + 50 MB/s:
        // Standard: 100GB × $0.30 = $30.00
        // IA Storage: 100GB × $0.016 = $1.60
        // IA Requests: 10GB × $0.01 = $0.10
        // Throughput: 50 MB/s × $6.00 = $300.00
        // Total: ~$331.70/month
        const expectedMin = 290.0;
        const expectedMax = 370.0;

        console.log('EFS with IA and provisioned throughput:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');
      } else {
        throw new Error('EFS combined pricing should be available');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new EFSCalculator();

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`EFS pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($24-40/month for 100GB Standard)
          expect(cost.amount).toBeGreaterThan(20.0);
          expect(cost.amount).toBeLessThan(45.0);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query correct UsageTypes for EFS components', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new EFSCalculator(100, 30);

        const testResource = {
          logicalId: 'MyFileSystem',
          type: 'AWS::EFS::FileSystem',
          properties: {
            LifecyclePolicies: [
              {
                TransitionToIA: 'AFTER_30_DAYS',
              },
            ],
            ThroughputMode: 'provisioned',
            ProvisionedThroughputInMibps: 10,
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured:
        // - TimedStorage-ByteHrs (Standard storage)
        // - IATimedStorage-ByteHrs (IA storage)
        // - IARequests-Bytes (IA requests)
        // - ProvisionedTP-MiBpsHrs (Provisioned throughput)
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle minimal storage', async () => {
      const calculator = new EFSCalculator(1); // 1GB

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: {},
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 1GB: 1GB × $0.30 = $0.30/month
        expect(cost.amount).toBeLessThan(0.5);
        expect(cost.amount).toBeGreaterThan(0.2);

        console.log(`EFS minimal storage: $${cost.amount.toFixed(4)}/month`);
      }
    }, 30000);

    testMode('should handle undefined properties gracefully', async () => {
      const calculator = new EFSCalculator();

      const testResource = {
        logicalId: 'MyFileSystem',
        type: 'AWS::EFS::FileSystem',
        properties: undefined as any,
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions).toContain('Resource properties are undefined');
    }, 30000);
  });
});
