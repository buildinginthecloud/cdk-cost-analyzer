import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { PricingService } from '../../src/pricing/PricingService';
import { ResourceWithId } from '../../src/diff/types';

vi.mock('@aws-sdk/client-pricing', () => ({
  PricingClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  GetProductsCommand: vi.fn(),
}));

describe('PricingService - Property Tests', () => {
  const service = new PricingService();

  // Feature: cdk-cost-analyzer, Property 3: Cost calculation produces valid results
  it('should return non-negative costs with valid currency and confidence', () => {
    const supportedTypes = [
      'AWS::EC2::Instance',
      'AWS::S3::Bucket',
      'AWS::Lambda::Function',
      'AWS::RDS::DBInstance',
    ];

    const resourceArb = fc.record({
      logicalId: fc.string().filter(s => s.length > 0),
      type: fc.constantFrom(...supportedTypes),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    fc.assert(
      fc.asyncProperty(resourceArb, async (resource) => {
        const cost = await service.getResourceCost(resource, 'eu-central-1');

        expect(cost.amount).toBeGreaterThanOrEqual(0);
        expect(cost.currency).toBe('USD');
        expect(['high', 'medium', 'low', 'unknown']).toContain(cost.confidence);
        expect(Array.isArray(cost.assumptions)).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 10: Unsupported resources don't cause failures
  it('should handle unsupported resource types gracefully', () => {
    const unsupportedTypes = [
      'AWS::CloudFront::Distribution',
      'AWS::ApiGateway::RestApi',
      'Custom::MyResource',
    ];

    const resourceArb = fc.record({
      logicalId: fc.string().filter(s => s.length > 0),
      type: fc.constantFrom(...unsupportedTypes),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    fc.assert(
      fc.asyncProperty(resourceArb, async (resource) => {
        const cost = await service.getResourceCost(resource, 'eu-central-1');

        expect(cost).toBeDefined();
        expect(cost.confidence).toBe('unknown');
        expect(cost.amount).toBe(0);
      }),
      { numRuns: 50 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 4: Total cost delta equals sum of individual costs
  it('should calculate total delta as sum of component costs', () => {
    const resourceArb = fc.record({
      logicalId: fc.string().filter(s => s.length > 0),
      type: fc.constantFrom('AWS::S3::Bucket', 'AWS::Lambda::Function'),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    const diffArb = fc.record({
      added: fc.array(resourceArb, { maxLength: 3 }),
      removed: fc.array(resourceArb, { maxLength: 3 }),
      modified: fc.array(
        fc.record({
          logicalId: fc.string().filter(s => s.length > 0),
          type: fc.constantFrom('AWS::S3::Bucket'),
          oldProperties: fc.dictionary(fc.string(), fc.anything()),
          newProperties: fc.dictionary(fc.string(), fc.anything()),
        }),
        { maxLength: 2 }
      ),
    });

    fc.assert(
      fc.asyncProperty(diffArb, async (diff) => {
        const result = await service.getCostDelta(diff, 'eu-central-1');

        const addedSum = result.addedCosts.reduce((sum, r) => sum + r.monthlyCost.amount, 0);
        const removedSum = result.removedCosts.reduce((sum, r) => sum + r.monthlyCost.amount, 0);
        const modifiedSum = result.modifiedCosts.reduce((sum, r) => sum + r.costDelta, 0);

        const expectedDelta = addedSum - removedSum + modifiedSum;

        expect(Math.abs(result.totalDelta - expectedDelta)).toBeLessThan(0.01);
      }),
      { numRuns: 30 }
    );
  });
});
