import * as fc from 'fast-check';
// Jest imports are global
import { S3Calculator } from '../../src/pricing/calculators/S3Calculator';
import { PricingClient } from '../../src/pricing/types';

describe('S3Calculator - Property Tests', () => {
  // Feature: cdk-cost-analyzer, Property 7: S3 buckets receive cost estimates
  it('should return cost estimates greater than zero for S3 buckets', () => {
    const calculator = new S3Calculator();

    // Define regions for testing
    const regions = ['us-east-1', 'us-west-2', 'eu-central-1', 'eu-west-1', 'ap-southeast-1'];

    // Create a mock pricing client that returns realistic S3 pricing
    const createMockPricingClient = (): PricingClient => ({
      getPrice: jest.fn().mockImplementation(async (params) => {
        const region = params.region;

        // Return null for invalid combinations
        if (!region) {
          return null;
        }

        // Return realistic S3 pricing per GB (varies slightly by region)
        // Standard storage pricing ranges from $0.021 to $0.025 per GB/month
        const regionPricing: Record<string, number> = {
          'US East (N. Virginia)': 0.023,
          'US West (Oregon)': 0.023,
          'EU (Frankfurt)': 0.0245,
          'EU (Ireland)': 0.0235,
          'Asia Pacific (Singapore)': 0.025,
        };

        return regionPricing[region] || 0.023;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    // Property: For any S3 bucket resource, the cost calculator should return
    // a cost estimate greater than zero
    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...regions),
        fc.string({ minLength: 3, maxLength: 63 }).filter(s => /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)),
        async (region, bucketName) => {
          const resource = {
            logicalId: 'TestBucket',
            type: 'AWS::S3::Bucket',
            properties: {
              BucketName: bucketName,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // Cost should be greater than zero
          expect(cost.amount).toBeGreaterThan(0);
          expect(cost.currency).toBe('USD');
          expect(cost.confidence).toBe('medium');

          // Should include assumptions about storage
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions.some(a => a.includes('storage'))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return consistent costs for the same region', () => {
    const calculator = new S3Calculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(0.023),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (region) => {
          const resource1 = {
            logicalId: 'Bucket1',
            type: 'AWS::S3::Bucket',
            properties: {},
          };

          const resource2 = {
            logicalId: 'Bucket2',
            type: 'AWS::S3::Bucket',
            properties: {},
          };

          const cost1 = await calculator.calculateCost(resource1, region, mockPricingClient);
          const cost2 = await calculator.calculateCost(resource2, region, mockPricingClient);

          // Same region should produce the same cost (using default assumptions)
          expect(cost1.amount).toBe(cost2.amount);
          expect(cost1.confidence).toBe(cost2.confidence);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle pricing API failures gracefully', () => {
    const calculator = new S3Calculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(null),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (region) => {
          const resource = {
            logicalId: 'TestBucket',
            type: 'AWS::S3::Bucket',
            properties: {},
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // When pricing data is unavailable, cost should be 0
          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Pricing data not available');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle pricing API errors gracefully', () => {
    const calculator = new S3Calculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockRejectedValue(new Error('Network timeout')),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (region) => {
          const resource = {
            logicalId: 'TestBucket',
            type: 'AWS::S3::Bucket',
            properties: {},
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // When API throws error, should handle gracefully
          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Failed to fetch pricing');
        },
      ),
      { numRuns: 50 },
    );
  });
});
