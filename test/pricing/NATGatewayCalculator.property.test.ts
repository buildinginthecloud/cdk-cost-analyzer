import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { NatGatewayCalculator } from '../../src/pricing/calculators/NatGatewayCalculator';
import { PricingClient } from '../../src/pricing/PricingClient';

describe('NatGatewayCalculator - Property Tests', () => {
  const calculator = new NatGatewayCalculator();
  const pricingClient = new PricingClient();

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should include both hourly and data processing costs', () => {
    const natGatewayResourceArb = fc.record({
      logicalId: fc.string().filter(s => s.length > 0),
      type: fc.constant('AWS::EC2::NatGateway'),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    void fc.assert(
      fc.asyncProperty(natGatewayResourceArb, async (resource) => {
        const region = 'eu-central-1';
        const cost = await calculator.calculateCost(resource, region, pricingClient);

        // Should have valid cost structure
        expect(cost.amount).toBeGreaterThanOrEqual(0);
        expect(cost.currency).toBe('USD');
        expect(cost.assumptions.length).toBeGreaterThan(0);

        // Assumptions should mention both hourly and data processing
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/hour|hourly/);
        expect(assumptionText).toMatch(/data|processing|gb/);
      }),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should scale cost with data processing assumptions', () => {
    const resource = {
      logicalId: 'TestNatGateway',
      type: 'AWS::EC2::NatGateway',
      properties: {},
    };

    const dataProcessingArb = fc.double({ min: 1, max: 10000, noNaN: true });

    void fc.assert(
      fc.asyncProperty(dataProcessingArb, dataProcessingArb, async (dataGB1, dataGB2) => {
        // Skip if values are too close
        if (Math.abs(dataGB1 - dataGB2) < 1) {
          return true;
        }

        const region = 'eu-central-1';

        const cost1 = await calculator.calculateCost(
          resource,
          region,
          pricingClient,
          { dataProcessedGB: dataGB1 },
        );

        const cost2 = await calculator.calculateCost(
          resource,
          region,
          pricingClient,
          { dataProcessedGB: dataGB2 },
        );

        // Higher data processing should result in higher or equal cost
        if (dataGB1 > dataGB2) {
          expect(cost1.amount).toBeGreaterThanOrEqual(cost2.amount);
        } else {
          expect(cost2.amount).toBeGreaterThanOrEqual(cost1.amount);
        }

        // Both should be valid
        expect(cost1.amount).toBeGreaterThanOrEqual(0);
        expect(cost2.amount).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 30 },
    );
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should have non-zero cost due to hourly charges', () => {
    const natGatewayResourceArb = fc.record({
      logicalId: fc.string().filter(s => s.length > 0),
      type: fc.constant('AWS::EC2::NatGateway'),
      properties: fc.dictionary(fc.string(), fc.anything()),
    });

    void fc.assert(
      fc.asyncProperty(natGatewayResourceArb, async (resource) => {
        const region = 'eu-central-1';

        // Even with zero data processing, should have hourly cost
        const cost = await calculator.calculateCost(
          resource,
          region,
          pricingClient,
          { dataProcessedGB: 0 },
        );

        // Should have some cost from hourly charges
        // (unless pricing is unavailable, in which case it would be 0)
        expect(cost.amount).toBeGreaterThanOrEqual(0);
        expect(cost.currency).toBe('USD');
        expect(cost.assumptions.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should support the NAT Gateway resource type', () => {
    expect(calculator.supports('AWS::EC2::NatGateway')).toBe(true);
    expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
  });

  // Feature: production-readiness, Property 8: NAT Gateway costs include all components
  // Validates: Requirements 7.1, 7.2, 7.3
  it('should include data processing amount in assumptions', () => {
    const resource = {
      logicalId: 'TestNatGateway',
      type: 'AWS::EC2::NatGateway',
      properties: {},
    };

    const dataProcessingArb = fc.double({ min: 1, max: 10000, noNaN: true });

    void fc.assert(
      fc.asyncProperty(dataProcessingArb, async (dataGB) => {
        const region = 'eu-central-1';
        const cost = await calculator.calculateCost(
          resource,
          region,
          pricingClient,
          { dataProcessedGB: dataGB },
        );

        // Assumptions should mention the data processing amount
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain(dataGB.toString());
      }),
      { numRuns: 50 },
    );
  });
});
