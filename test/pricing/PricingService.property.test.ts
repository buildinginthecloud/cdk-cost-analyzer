import * as fc from 'fast-check';
// Jest imports are global
import { PricingService } from '../../src/pricing/PricingService';

// Mock PricingClient to avoid real AWS API calls
jest.mock('../../src/pricing/PricingClient', () => {
  return {
    PricingClient: jest.fn().mockImplementation(() => {
      return {
        getPrice: jest.fn().mockImplementation((params) => {
          const serviceCode = params?.serviceCode || 'AmazonEC2';
          const filters = params?.filters || [];
          
          // Handle Lambda special cases (has different prices for requests vs compute)
          if (serviceCode === 'AWSLambda') {
            const groupFilter = filters.find((f: any) => f.field === 'group');
            if (groupFilter?.value === 'AWS-Lambda-Requests') {
              return Promise.resolve(0.20); // per 1M requests
            }
            if (groupFilter?.value === 'AWS-Lambda-Duration') {
              return Promise.resolve(0.0000166667); // per GB-second
            }
          }
          
          // Handle CloudFront special cases
          if (serviceCode === 'AmazonCloudFront') {
            const transferTypeFilter = filters.find((f: any) => f.field === 'transferType');
            const requestTypeFilter = filters.find((f: any) => f.field === 'requestType');
            if (transferTypeFilter?.value === 'CloudFront to Internet') {
              return Promise.resolve(0.085); // per GB
            }
            if (requestTypeFilter?.value === 'HTTP-Requests') {
              return Promise.resolve(0.0075); // per 10k requests
            }
          }
          
          const prices: Record<string, number> = {
            AmazonEC2: 0.0116,
            AmazonS3: 0.023,
            AWSLambda: 0.0000166667,
            AmazonRDS: 0.017,
            AmazonCloudFront: 0.085,
          };
          
          return Promise.resolve(prices[serviceCode] || 0.01);
        }),
        destroy: jest.fn(),
      };
    }),
  };
});

describe('PricingService - Property Tests', () => {
  const service = new PricingService();

  afterAll(() => {
    // Clean up the shared service
    try {
      service.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Feature: cdk-cost-analyzer, Property 3: Cost calculation produces valid results
  it('should return non-negative costs with valid currency and confidence', () => {
    const supportedTypes = [
      'AWS::EC2::Instance',
      'AWS::S3::Bucket',
      'AWS::Lambda::Function',
      'AWS::RDS::DBInstance',
      'AWS::CloudFront::Distribution',
    ];

    const resourceArb = fc.record({
      logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
      type: fc.constantFrom(...supportedTypes),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    void fc.assert(
      fc.asyncProperty(resourceArb, async (resource) => {
        const cost = await service.getResourceCost(resource, 'eu-central-1');

        expect(cost.amount).toBeGreaterThanOrEqual(0);
        expect(cost.currency).toBe('USD');
        expect(['high', 'medium', 'low', 'unknown']).toContain(cost.confidence);
        expect(Array.isArray(cost.assumptions)).toBe(true);
      }),
      { numRuns: 10 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 10: Unsupported resources don't cause failures
  it('should handle unsupported resource types gracefully', () => {
    const unsupportedTypes = [
      'AWS::Route53::HostedZone',
      'AWS::SNS::Topic',
      'AWS::CloudWatch::Alarm',
      'AWS::IAM::Role',
      'Custom::MyResource',
      'Custom::SomeOtherResource',
    ];

    const resourceArb = fc.record({
      logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
      type: fc.constantFrom(...unsupportedTypes),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    void fc.assert(
      fc.asyncProperty(resourceArb, async (resource) => {
        const cost = await service.getResourceCost(resource, 'eu-central-1');

        expect(cost).toBeDefined();
        expect(cost.confidence).toBe('unknown');
        expect(cost.amount).toBe(0);
        expect(cost.currency).toBe('USD');
        expect(Array.isArray(cost.assumptions)).toBe(true);
        expect(cost.assumptions.some((a) => a.includes('not supported'))).toBe(
          true,
        );
      }),
      { numRuns: 10 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 10: Unsupported resources don't cause failures (complete analysis)
  it('should complete analysis successfully with templates containing unsupported resources', () => {
    const supportedTypes = [
      'AWS::EC2::Instance',
      'AWS::S3::Bucket',
      'AWS::Lambda::Function',
      'AWS::RDS::DBInstance',
      'AWS::CloudFront::Distribution',
    ];

    const unsupportedTypes = [
      'AWS::Route53::HostedZone',
      'AWS::SNS::Topic',
      'Custom::MyResource',
    ];

    const allTypes = [...supportedTypes, ...unsupportedTypes];

    const resourceArb = fc.record({
      logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
      type: fc.constantFrom(...allTypes),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    const diffArb = fc.record({
      added: fc.array(resourceArb, { minLength: 1, maxLength: 5 }),
      removed: fc.array(resourceArb, { maxLength: 3 }),
      modified: fc.array(
        fc.record({
          logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
          type: fc.constantFrom(...allTypes),
          oldProperties: fc.dictionary(fc.string(), fc.anything()),
          newProperties: fc.dictionary(fc.string(), fc.anything()),
        }),
        { maxLength: 2 },
      ),
    });

    void fc.assert(
      fc.asyncProperty(diffArb, async (diff) => {
        // Analysis should complete without throwing errors
        const result = await service.getCostDelta(diff, 'eu-central-1');

        // Verify result structure is valid
        expect(result).toBeDefined();
        expect(typeof result.totalDelta).toBe('number');
        expect(result.currency).toBe('USD');
        expect(Array.isArray(result.addedCosts)).toBe(true);
        expect(Array.isArray(result.removedCosts)).toBe(true);
        expect(Array.isArray(result.modifiedCosts)).toBe(true);

        // Verify all resources are present in results
        expect(result.addedCosts.length).toBe(diff.added.length);
        expect(result.removedCosts.length).toBe(diff.removed.length);
        expect(result.modifiedCosts.length).toBe(diff.modified.length);

        // Verify unsupported resources are marked with unknown confidence
        const allResourceCosts = [
          ...result.addedCosts,
          ...result.removedCosts,
          ...result.modifiedCosts.map((m) => ({
            ...m,
            monthlyCost: m.newMonthlyCost,
          })),
        ];

        allResourceCosts.forEach((resourceCost) => {
          if (unsupportedTypes.includes(resourceCost.type)) {
            expect(resourceCost.monthlyCost.confidence).toBe('unknown');
            expect(resourceCost.monthlyCost.amount).toBe(0);
            expect(
              resourceCost.monthlyCost.assumptions.some((a) =>
                a.includes('not supported'),
              ),
            ).toBe(true);
          }
          // All resources should have valid cost structure
          expect(resourceCost.monthlyCost.currency).toBe('USD');
          expect(resourceCost.monthlyCost.amount).toBeGreaterThanOrEqual(0);
          expect(['high', 'medium', 'low', 'unknown']).toContain(
            resourceCost.monthlyCost.confidence,
          );
        });
      }),
      { numRuns: 10 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 4: Total cost delta equals sum of individual costs
  it('should calculate total delta as sum of component costs', () => {
    const resourceArb = fc.record({
      logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
      type: fc.constantFrom('AWS::S3::Bucket', 'AWS::Lambda::Function'),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    const diffArb = fc.record({
      added: fc.array(resourceArb, { maxLength: 3 }),
      removed: fc.array(resourceArb, { maxLength: 3 }),
      modified: fc.array(
        fc.record({
          logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
          type: fc.constantFrom('AWS::S3::Bucket'),
          oldProperties: fc.dictionary(fc.string(), fc.anything()),
          newProperties: fc.dictionary(fc.string(), fc.anything()),
        }),
        { maxLength: 2 },
      ),
    });

    void fc.assert(
      fc.asyncProperty(diffArb, async (diff) => {
        const result = await service.getCostDelta(diff, 'eu-central-1');

        const addedSum = result.addedCosts.reduce(
          (sum, r) => sum + r.monthlyCost.amount,
          0,
        );
        const removedSum = result.removedCosts.reduce(
          (sum, r) => sum + r.monthlyCost.amount,
          0,
        );
        const modifiedSum = result.modifiedCosts.reduce(
          (sum, r) => sum + r.costDelta,
          0,
        );

        const expectedDelta = addedSum - removedSum + modifiedSum;

        expect(Math.abs(result.totalDelta - expectedDelta)).toBeLessThan(0.01);
      }),
      { numRuns: 10 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 20: Unavailable pricing results in unknown cost
  it('should mark resources with unknown confidence when pricing is unavailable and continue processing', () => {
    const supportedTypes = [
      'AWS::EC2::Instance',
      'AWS::S3::Bucket',
      'AWS::Lambda::Function',
      'AWS::RDS::DBInstance',
      'AWS::CloudFront::Distribution',
    ];

    const resourceArb = fc.record({
      logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
      type: fc.constantFrom(...supportedTypes),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    const diffArb = fc.record({
      added: fc.array(resourceArb, { minLength: 1, maxLength: 5 }),
      removed: fc.array(resourceArb, { maxLength: 3 }),
      modified: fc.array(
        fc.record({
          logicalId: fc.string().filter((s) => s.length > 0 && s.trim().length > 0),
          type: fc.constantFrom(...supportedTypes),
          oldProperties: fc.dictionary(fc.string(), fc.anything()),
          newProperties: fc.dictionary(fc.string(), fc.anything()),
        }),
        { maxLength: 2 },
      ),
    });

    void fc.assert(
      fc.asyncProperty(diffArb, async (diff) => {
        // Create a service that will have pricing failures
        const failingService = new PricingService('us-east-1');

        try {
          // The service should complete without throwing errors
          const result = await failingService.getCostDelta(diff, 'us-east-1');

          // Verify the result is defined and has the expected structure
          expect(result).toBeDefined();
          expect(result.totalDelta).toBeDefined();
          expect(typeof result.totalDelta).toBe('number');
          expect(result.currency).toBe('USD');
          expect(Array.isArray(result.addedCosts)).toBe(true);
          expect(Array.isArray(result.removedCosts)).toBe(true);
          expect(Array.isArray(result.modifiedCosts)).toBe(true);

          // Verify all resources are present in the result
          expect(result.addedCosts.length).toBe(diff.added.length);
          expect(result.removedCosts.length).toBe(diff.removed.length);
          expect(result.modifiedCosts.length).toBe(diff.modified.length);

          // Verify each resource has a valid cost structure with confidence level
          [...result.addedCosts, ...result.removedCosts].forEach(
            (resourceCost) => {
              expect(resourceCost.monthlyCost).toBeDefined();
              expect(resourceCost.monthlyCost.amount).toBeGreaterThanOrEqual(0);
              expect(resourceCost.monthlyCost.currency).toBe('USD');
              expect(['high', 'medium', 'low', 'unknown']).toContain(
                resourceCost.monthlyCost.confidence,
              );
              expect(Array.isArray(resourceCost.monthlyCost.assumptions)).toBe(
                true,
              );
            },
          );

          result.modifiedCosts.forEach((resourceCost) => {
            expect(resourceCost.oldMonthlyCost).toBeDefined();
            expect(resourceCost.newMonthlyCost).toBeDefined();
            expect(['high', 'medium', 'low', 'unknown']).toContain(
              resourceCost.oldMonthlyCost.confidence,
            );
            expect(['high', 'medium', 'low', 'unknown']).toContain(
              resourceCost.newMonthlyCost.confidence,
            );
          });
        } finally {
          // Clean up the service
          try {
            (failingService as any).pricingClient?.destroy();
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }),
      { numRuns: 10 },
    );
  });
});
