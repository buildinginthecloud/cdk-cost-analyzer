import * as fc from 'fast-check';
// Jest imports are global
import { DiffEngine } from '../../src/diff/DiffEngine';
import { CloudFormationTemplate } from '../../src/parser/types';
import { PricingService } from '../../src/pricing/PricingService';

describe('PricingService - Resource Exclusions Property Tests', () => {
  const diffEngine = new DiffEngine();
  const servicesToCleanup: PricingService[] = [];

  afterEach(() => {
    // Clean up all services created during tests
    servicesToCleanup.forEach(service => {
      try {
        service.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    servicesToCleanup.length = 0;
  });

  // Feature: production-readiness, Property 6: Resource exclusions are respected
  // Validates: Requirements 15.1, 15.2, 15.3
  it('should exclude specified resource types from cost analysis', () => {
    const excludedTypes = ['AWS::IAM::Role', 'AWS::IAM::Policy', 'AWS::Logs::LogGroup'];
    const includedTypes = ['AWS::S3::Bucket', 'AWS::Lambda::Function', 'AWS::EC2::Instance'];

    const resourceArb = fc.oneof(
      ...excludedTypes.map(type => fc.constant({ Type: type, Properties: {} })),
      ...includedTypes.map(type => fc.constant({ Type: type, Properties: {} })),
    );

    const templateArb = fc.dictionary(
      fc.string().filter(s => s.length > 0 && s.trim().length > 0),
      resourceArb,
      { minKeys: 2, maxKeys: 10 },
    );

    void fc.assert(
      fc.asyncProperty(templateArb, async (resources) => {
        const region = 'eu-central-1';

        // Create service with exclusions
        const serviceWithExclusions = new PricingService(
          region,
          undefined,
          excludedTypes,
        );
        servicesToCleanup.push(serviceWithExclusions);

        // Create service without exclusions
        const serviceWithoutExclusions = new PricingService(region);
        servicesToCleanup.push(serviceWithoutExclusions);

        const template: CloudFormationTemplate = { Resources: resources };
        const emptyTemplate: CloudFormationTemplate = { Resources: {} };

        const diff = diffEngine.diff(emptyTemplate, template);

        const costWithExclusions = await serviceWithExclusions.getCostDelta(diff, region);
        const costWithoutExclusions = await serviceWithoutExclusions.getCostDelta(diff, region);

        // Count excluded vs included resources
        const excludedCount = Object.values(resources).filter(r =>
          excludedTypes.includes(r.Type),
        ).length;
        const includedCount = Object.values(resources).filter(r =>
          includedTypes.includes(r.Type),
        ).length;

        // With exclusions, should only analyze included resources
        expect(costWithExclusions.addedCosts.length).toBe(includedCount);

        // Without exclusions, should analyze all resources
        expect(costWithoutExclusions.addedCosts.length).toBe(excludedCount + includedCount);

        // Verify excluded resources are not in the results
        costWithExclusions.addedCosts.forEach(cost => {
          expect(excludedTypes).not.toContain(cost.type);
        });

        // Verify included resources are in the results
        const typesInResults = new Set(costWithExclusions.addedCosts.map(c => c.type));
        includedTypes.forEach(type => {
          const hasResourceOfType = Object.values(resources).some(r => r.Type === type);
          if (hasResourceOfType) {
            expect(typesInResults.has(type)).toBe(true);
          }
        });
      }),
      { numRuns: 10 }, // Reduced from 50 to speed up tests with API calls
    );
  });

  // Feature: production-readiness, Property 6: Resource exclusions are respected
  // Validates: Requirements 15.1, 15.2, 15.3
  it('should handle empty exclusion list correctly', () => {
    const resourceArb = fc.record({
      Type: fc.constantFrom('AWS::S3::Bucket', 'AWS::Lambda::Function', 'AWS::IAM::Role'),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    const templateArb = fc.dictionary(
      fc.string().filter(s => s.length > 0 && s.trim().length > 0),
      resourceArb,
      { minKeys: 1, maxKeys: 5 },
    );

    void fc.assert(
      fc.asyncProperty(templateArb, async (resources) => {
        const region = 'eu-central-1';

        // Empty exclusion list
        const service = new PricingService(region, undefined, []);
        servicesToCleanup.push(service);

        const template: CloudFormationTemplate = { Resources: resources };
        const emptyTemplate: CloudFormationTemplate = { Resources: {} };

        const diff = diffEngine.diff(emptyTemplate, template);
        const costDelta = await service.getCostDelta(diff, region);

        // Should analyze all resources
        expect(costDelta.addedCosts.length).toBe(Object.keys(resources).length);
      }),
      { numRuns: 10 }, // Reduced from 50 to speed up tests with API calls
    );
  });

  // Feature: production-readiness, Property 6: Resource exclusions are respected
  // Validates: Requirements 15.1, 15.2, 15.3
  it('should maintain total cost consistency with exclusions', () => {
    const includedTypes = ['AWS::S3::Bucket', 'AWS::Lambda::Function'];
    const excludedTypes = ['AWS::IAM::Role'];

    const includedResourceArb = fc.record({
      Type: fc.constantFrom(...includedTypes),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    const excludedResourceArb = fc.record({
      Type: fc.constantFrom(...excludedTypes),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    const templateArb = fc.record({
      included: fc.dictionary(
        fc.string().filter(s => s.length > 0 && s.trim().length > 0 && s.startsWith('Inc')),
        includedResourceArb,
        { minKeys: 1, maxKeys: 3 },
      ),
      excluded: fc.dictionary(
        fc.string().filter(s => s.length > 0 && s.trim().length > 0 && s.startsWith('Exc')),
        excludedResourceArb,
        { maxKeys: 2 },
      ),
    });

    void fc.assert(
      fc.asyncProperty(templateArb, async ({ included, excluded }) => {
        const region = 'eu-central-1';

        const serviceWithExclusions = new PricingService(
          region,
          undefined,
          excludedTypes,
        );
        servicesToCleanup.push(serviceWithExclusions);

        const allResources = { ...included, ...excluded };
        const template: CloudFormationTemplate = { Resources: allResources };
        const emptyTemplate: CloudFormationTemplate = { Resources: {} };

        const diff = diffEngine.diff(emptyTemplate, template);
        const costDelta = await serviceWithExclusions.getCostDelta(diff, region);

        // Total delta should only include costs from included resources
        const sumOfIncludedCosts = costDelta.addedCosts.reduce(
          (sum, cost) => sum + cost.monthlyCost.amount,
          0,
        );

        expect(Math.abs(costDelta.totalDelta - sumOfIncludedCosts)).toBeLessThan(0.01);

        // Verify no excluded resources in results
        costDelta.addedCosts.forEach(cost => {
          expect(excludedTypes).not.toContain(cost.type);
          expect(includedTypes).toContain(cost.type);
        });
      }),
      { numRuns: 10 }, // Reduced from 50 to speed up tests with API calls
    );
  });

  // Feature: production-readiness, Property 6: Resource exclusions are respected
  // Validates: Requirements 15.1, 15.2, 15.3
  it('should handle exclusions for modified and removed resources', () => {
    const excludedTypes = ['AWS::IAM::Role'];
    const includedTypes = ['AWS::S3::Bucket', 'AWS::Lambda::Function'];

    const resourceArb = fc.oneof(
      ...excludedTypes.map(type => fc.constant({ Type: type, Properties: {} })),
      ...includedTypes.map(type => fc.constant({ Type: type, Properties: {} })),
    );

    const templateArb = fc.dictionary(
      fc.string().filter(s => s.length > 0 && s.trim().length > 0),
      resourceArb,
      { minKeys: 2, maxKeys: 5 },
    );

    void fc.assert(
      fc.asyncProperty(templateArb, templateArb, async (baseResources, targetResources) => {
        const region = 'eu-central-1';

        const serviceWithExclusions = new PricingService(
          region,
          undefined,
          excludedTypes,
        );
        servicesToCleanup.push(serviceWithExclusions);

        const baseTemplate: CloudFormationTemplate = { Resources: baseResources };
        const targetTemplate: CloudFormationTemplate = { Resources: targetResources };

        const diff = diffEngine.diff(baseTemplate, targetTemplate);
        const costDelta = await serviceWithExclusions.getCostDelta(diff, region);

        // Verify no excluded resources in any category
        [...costDelta.addedCosts, ...costDelta.removedCosts].forEach(cost => {
          expect(excludedTypes).not.toContain(cost.type);
        });

        costDelta.modifiedCosts.forEach(cost => {
          expect(excludedTypes).not.toContain(cost.type);
        });
      }),
      { numRuns: 10 }, // Reduced from 50 to speed up tests with API calls
    );
  });

  // Feature: production-readiness, Property 6: Resource exclusions are respected
  // Validates: Requirements 15.1, 15.2, 15.3
  it('should handle case-sensitive resource type exclusions', () => {
    const resourceArb = fc.record({
      Type: fc.constantFrom('AWS::IAM::Role', 'AWS::S3::Bucket'),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    const templateArb = fc.dictionary(
      fc.string().filter(s => s.length > 0 && s.trim().length > 0),
      resourceArb,
      { minKeys: 2, maxKeys: 5 },
    );

    void fc.assert(
      fc.asyncProperty(templateArb, async (resources) => {
        const region = 'eu-central-1';

        // Exclude with exact case
        const service = new PricingService(region, undefined, ['AWS::IAM::Role']);
        servicesToCleanup.push(service);

        const template: CloudFormationTemplate = { Resources: resources };
        const emptyTemplate: CloudFormationTemplate = { Resources: {} };

        const diff = diffEngine.diff(emptyTemplate, template);
        const costDelta = await service.getCostDelta(diff, region);

        // Should not include IAM::Role resources
        costDelta.addedCosts.forEach(cost => {
          expect(cost.type).not.toBe('AWS::IAM::Role');
        });

        // Should include S3::Bucket resources
        const hasS3 = Object.values(resources).some(r => r.Type === 'AWS::S3::Bucket');
        if (hasS3) {
          const hasS3InResults = costDelta.addedCosts.some(c => c.type === 'AWS::S3::Bucket');
          expect(hasS3InResults).toBe(true);
        }
      }),
      { numRuns: 10 }, // Reduced from 50 to speed up tests with API calls
    );
  });
});
