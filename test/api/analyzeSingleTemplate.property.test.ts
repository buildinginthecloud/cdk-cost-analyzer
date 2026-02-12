import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { analyzeSingleTemplate } from '../../src/api';

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

          const prices: Record<string, number> = {
            AmazonEC2: 0.0116,
            AmazonS3: 0.023,
            AWSLambda: 0.0000166667,
            AmazonDynamoDB: 0.25,
          };

          return Promise.resolve(prices[serviceCode] || 0.01);
        }),
        destroy: jest.fn(),
      };
    }),
  };
});

/**
 * Property-based tests for single template analysis
 * These tests verify universal properties that should hold across randomized inputs
 * using mocked pricing to avoid real AWS API calls.
 */
describe('Single Template Analysis - Property Tests', () => {
  /**
   * Property 1: Template Processing Completeness
   * For any valid CloudFormation template, analyzing it should calculate costs
   * for all supported resources and return a complete cost breakdown with total monthly cost.
   */
  describe('Property 1: Template Processing Completeness', () => {
    it('should always return a complete result structure for valid templates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              logicalId: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.constantFrom(
                'AWS::S3::Bucket',
                'AWS::DynamoDB::Table',
                'AWS::Lambda::Function',
                'AWS::EC2::Instance',
              ),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          async (resources) => {
            // Generate a valid CloudFormation template
            const template: any = {
              Resources: {},
            };

            for (const resource of resources) {
              template.Resources[resource.logicalId] = {
                Type: resource.type,
                Properties: {},
              };
            }

            const result = await analyzeSingleTemplate({
              template: JSON.stringify(template),
              region: 'us-east-1',
            });

            // Assert complete structure
            expect(result.totalMonthlyCost).toBeGreaterThanOrEqual(0);
            expect(result.currency).toBe('USD');
            expect(result.resourceCosts).toBeDefined();
            expect(result.costBreakdown).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.metadata).toBeDefined();

            // All resources should be analyzed
            expect(result.resourceCosts.length).toBe(resources.length);
            expect(result.metadata.resourceCount).toBe(resources.length);

            // Cost breakdown should exist
            expect(result.costBreakdown.byResourceType).toBeDefined();
            expect(result.costBreakdown.byConfidenceLevel).toBeDefined();
            expect(result.costBreakdown.assumptions).toBeDefined();
          },
        ),
        { numRuns: 10 },
      );
    }, 60000);
  });

  /**
   * Property 2: Output Format Consistency
   * For any single template analysis result, the output should include individual
   * resource costs with logical IDs, resource types, confidence levels, and assumptions.
   */
  describe('Property 2: Output Format Consistency', () => {
    it('should always include complete resource cost information', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              logicalId: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.constantFrom(
                'AWS::S3::Bucket',
                'AWS::Lambda::Function',
                'AWS::EC2::Instance',
              ),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          async (resources) => {
            const template: any = {
              Resources: {},
            };

            for (const resource of resources) {
              template.Resources[resource.logicalId] = {
                Type: resource.type,
                Properties: {},
              };
            }

            const result = await analyzeSingleTemplate({
              template: JSON.stringify(template),
              region: 'us-east-1',
            });

            // Every resource cost should have complete information
            for (const rc of result.resourceCosts) {
              expect(rc.logicalId).toBeDefined();
              expect(rc.type).toBeDefined();
              expect(rc.monthlyCost).toBeDefined();
              expect(rc.monthlyCost.amount).toBeGreaterThanOrEqual(0);
              expect(rc.monthlyCost.currency).toBe('USD');
              expect(rc.monthlyCost.confidence).toMatch(
                /^(high|medium|low|unknown)$/,
              );
              expect(Array.isArray(rc.monthlyCost.assumptions)).toBe(true);
              expect(rc.region).toBe('us-east-1');
              expect(rc.calculatedAt).toBeInstanceOf(Date);
            }

            // Cost breakdown should be sorted by cost descending
            for (
              let i = 0;
              i < result.costBreakdown.byResourceType.length - 1;
              i++
            ) {
              expect(
                result.costBreakdown.byResourceType[i].totalCost,
              ).toBeGreaterThanOrEqual(
                result.costBreakdown.byResourceType[i + 1].totalCost,
              );
            }
          },
        ),
        { numRuns: 10 },
      );
    }, 60000);
  });

  /**
   * Property 3: Unsupported Resource Handling
   * For any template containing unsupported resource types, those resources
   * should appear in the output with zero cost and unknown confidence level.
   */
  describe('Property 3: Unsupported Resource Handling', () => {
    it('should handle unsupported resources with zero cost and unknown confidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }),
            { minLength: 1, maxLength: 5 },
          ),
          async (unsupportedTypes) => {
            const template: any = {
              Resources: {},
            };

            // Create resources with unsupported types
            for (let i = 0; i < unsupportedTypes.length; i++) {
              const logicalId = `UnsupportedResource${i}`;
              const type = `AWS::Unsupported::${unsupportedTypes[i]}`;
              template.Resources[logicalId] = {
                Type: type,
                Properties: {},
              };
            }

            const result = await analyzeSingleTemplate({
              template: JSON.stringify(template),
              region: 'us-east-1',
            });

            // All unsupported resources should have zero cost
            for (const rc of result.resourceCosts) {
              expect(rc.monthlyCost.amount).toBe(0);
              expect(rc.monthlyCost.confidence).toBe('unknown');
              expect(rc.monthlyCost.assumptions.length).toBeGreaterThan(0);
            }

            // Metadata should reflect unsupported resources
            expect(result.metadata.unsupportedResourceCount).toBe(
              unsupportedTypes.length,
            );
          },
        ),
        { numRuns: 10 },
      );
    }, 60000);
  });

  /**
   * Property 9: API Interface Consistency
   * For any valid template processed through the API, the result should
   * have a consistent structure with total cost, resource breakdown, and metadata.
   */
  describe('Property 9: API Interface Consistency', () => {
    it('should always return consistent result structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            resources: fc.array(
              fc.record({
                logicalId: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom(
                  'AWS::S3::Bucket',
                  'AWS::DynamoDB::Table',
                ),
              }),
              { minLength: 1, maxLength: 5 },
            ),
            region: fc.constantFrom('us-east-1', 'eu-west-1', 'ap-southeast-1'),
            format: fc.constantFrom('text', 'json', 'markdown'),
          }),
          async (input) => {
            const template: any = {
              Resources: {},
            };

            for (const resource of input.resources) {
              template.Resources[resource.logicalId] = {
                Type: resource.type,
                Properties: {},
              };
            }

            const result = await analyzeSingleTemplate({
              template: JSON.stringify(template),
              region: input.region,
              format: input.format as 'text' | 'json' | 'markdown',
            });

            // Check consistent structure
            expect(typeof result.totalMonthlyCost).toBe('number');
            expect(result.currency).toBe('USD');
            expect(Array.isArray(result.resourceCosts)).toBe(true);
            expect(typeof result.costBreakdown).toBe('object');
            expect(typeof result.summary).toBe('string');
            expect(typeof result.metadata).toBe('object');

            // Metadata should match input
            expect(result.metadata.region).toBe(input.region);
            expect(result.metadata.resourceCount).toBe(input.resources.length);

            // Summary should be non-empty
            expect(result.summary.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 10 },
      );
    }, 60000);
  });

  /**
   * Property 17: Test Result Consistency
   * For any demo template analyzed multiple times with the same configuration,
   * the results should be consistent.
   */
  describe('Property 17: Test Result Consistency', () => {
    it('should produce consistent results for the same template', async () => {
      const template = JSON.stringify({
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
          MyTable: {
            Type: 'AWS::DynamoDB::Table',
            Properties: {
              BillingMode: 'PAY_PER_REQUEST',
            },
          },
        },
      });

      // Analyze the same template multiple times
      const results = await Promise.all([
        analyzeSingleTemplate({ template, region: 'us-east-1' }),
        analyzeSingleTemplate({ template, region: 'us-east-1' }),
        analyzeSingleTemplate({ template, region: 'us-east-1' }),
      ]);

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].totalMonthlyCost).toBe(results[0].totalMonthlyCost);
        expect(results[i].resourceCosts.length).toBe(
          results[0].resourceCosts.length,
        );
        expect(results[i].metadata.resourceCount).toBe(
          results[0].metadata.resourceCount,
        );

        // Resource costs should match
        for (let j = 0; j < results[i].resourceCosts.length; j++) {
          expect(results[i].resourceCosts[j].monthlyCost.amount).toBe(
            results[0].resourceCosts[j].monthlyCost.amount,
          );
        }
      }
    });
  });
});
