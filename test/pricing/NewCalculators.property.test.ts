import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { DynamoDBCalculator } from '../../src/pricing/calculators/DynamoDBCalculator';
import { ECSCalculator } from '../../src/pricing/calculators/ECSCalculator';
import { APIGatewayCalculator } from '../../src/pricing/calculators/APIGatewayCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('New Calculators - Property-Based Tests', () => {
  const mockPricingClient: PricingClient = {
    getPrice: vi.fn().mockResolvedValue(0.5),
  };

  describe('DynamoDB Calculator Properties', () => {
    const calculator = new DynamoDBCalculator();

    it('Property: DynamoDB costs are non-negative for all billing modes', () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PROVISIONED', 'PAY_PER_REQUEST'),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          async (billingMode, readCapacity, writeCapacity) => {
            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: billingMode,
                ProvisionedThroughput:
                  billingMode === 'PROVISIONED'
                    ? {
                        ReadCapacityUnits: readCapacity,
                        WriteCapacityUnits: writeCapacity,
                      }
                    : undefined,
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(result.amount).toBeGreaterThanOrEqual(0);
            expect(result.currency).toBe('USD');
            expect(['high', 'medium', 'low', 'unknown']).toContain(result.confidence);
            expect(Array.isArray(result.assumptions)).toBe(true);
          }
        )
      );
    });

    it('Property: Provisioned costs scale with capacity units', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 50 }),
          fc.integer({ min: 5, max: 50 }),
          fc.integer({ min: 51, max: 100 }),
          fc.integer({ min: 51, max: 100 }),
          async (lowRead, lowWrite, highRead, highWrite) => {
            const lowCapacityResource = {
              logicalId: 'TestTable1',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                  ReadCapacityUnits: lowRead,
                  WriteCapacityUnits: lowWrite,
                },
              },
            };

            const highCapacityResource = {
              logicalId: 'TestTable2',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                  ReadCapacityUnits: highRead,
                  WriteCapacityUnits: highWrite,
                },
              },
            };

            const lowResult = await calculator.calculateCost(
              lowCapacityResource,
              'us-east-1',
              mockPricingClient
            );
            const highResult = await calculator.calculateCost(
              highCapacityResource,
              'us-east-1',
              mockPricingClient
            );

            expect(highResult.amount).toBeGreaterThanOrEqual(lowResult.amount);
          }
        )
      );
    });
  });

  describe('ECS Calculator Properties', () => {
    const calculator = new ECSCalculator();

    it('Property: ECS costs are non-negative for all launch types', () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom('FARGATE', 'EC2'),
          fc.integer({ min: 1, max: 10 }),
          async (launchType, desiredCount) => {
            const resource = {
              logicalId: 'TestService',
              type: 'AWS::ECS::Service',
              properties: {
                LaunchType: launchType,
                DesiredCount: desiredCount,
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(result.amount).toBeGreaterThanOrEqual(0);
            expect(result.currency).toBe('USD');
            expect(['high', 'medium', 'low', 'unknown']).toContain(result.confidence);
            expect(Array.isArray(result.assumptions)).toBe(true);
          }
        )
      );
    });

    it('Property: Fargate costs scale with desired count', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 6, max: 10 }),
          async (lowCount, highCount) => {
            const lowCountResource = {
              logicalId: 'TestService1',
              type: 'AWS::ECS::Service',
              properties: {
                LaunchType: 'FARGATE',
                DesiredCount: lowCount,
              },
            };

            const highCountResource = {
              logicalId: 'TestService2',
              type: 'AWS::ECS::Service',
              properties: {
                LaunchType: 'FARGATE',
                DesiredCount: highCount,
              },
            };

            const lowResult = await calculator.calculateCost(
              lowCountResource,
              'us-east-1',
              mockPricingClient
            );
            const highResult = await calculator.calculateCost(
              highCountResource,
              'us-east-1',
              mockPricingClient
            );

            if (lowResult.confidence === 'medium' && highResult.confidence === 'medium') {
              expect(highResult.amount).toBeGreaterThan(lowResult.amount);
            }
          }
        )
      );
    });
  });

  describe('API Gateway Calculator Properties', () => {
    const calculator = new APIGatewayCalculator();

    it('Property: API Gateway costs are non-negative for all API types', () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom('REST', 'HTTP', 'WEBSOCKET'),
          async (apiType) => {
            const isV2 = apiType !== 'REST';
            const resource = {
              logicalId: 'TestApi',
              type: isV2 ? 'AWS::ApiGatewayV2::Api' : 'AWS::ApiGateway::RestApi',
              properties: isV2 ? { ProtocolType: apiType } : {},
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(result.amount).toBeGreaterThanOrEqual(0);
            expect(result.currency).toBe('USD');
            expect(['high', 'medium', 'low', 'unknown']).toContain(result.confidence);
            expect(Array.isArray(result.assumptions)).toBe(true);
          }
        )
      );
    });

    it('Property: Calculator supports both v1 and v2 API Gateway resources', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('AWS::ApiGateway::RestApi', 'AWS::ApiGatewayV2::Api'),
          (resourceType) => {
            expect(calculator.supports(resourceType)).toBe(true);
          }
        )
      );
    });
  });

  describe('Cross-Calculator Properties', () => {
    it('Property: All new calculators produce valid MonthlyCost objects', () => {
      const calculators = [
        new DynamoDBCalculator(),
        new ECSCalculator(),
        new APIGatewayCalculator(),
      ];

      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 2 }),
          async (calcIndex) => {
            const calculator = calculators[calcIndex];
            const resourceType =
              calcIndex === 0
                ? 'AWS::DynamoDB::Table'
                : calcIndex === 1
                ? 'AWS::ECS::Service'
                : 'AWS::ApiGateway::RestApi';

            const resource = {
              logicalId: 'TestResource',
              type: resourceType,
              properties: {},
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(typeof result.amount).toBe('number');
            expect(typeof result.currency).toBe('string');
            expect(['high', 'medium', 'low', 'unknown']).toContain(result.confidence);
            expect(Array.isArray(result.assumptions)).toBe(true);
            expect(result.assumptions.length).toBeGreaterThan(0);
          }
        )
      );
    });
  });
});
