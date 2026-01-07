import * as fc from 'fast-check';
// Jest imports are global
import { ResourceWithId } from '../../src/diff/types';
import { VPCEndpointCalculator } from '../../src/pricing/calculators/VPCEndpointCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('VPCEndpointCalculator - Property Tests', () => {
  /**
   * Feature: production-readiness, Property 10: Gateway VPC endpoints have zero cost
   * Validates: Requirements 11.3
   */
  it('should return zero cost for Gateway VPC endpoints', () => {
    const calculator = new VPCEndpointCalculator();

    // Mock pricing client (should not be called for Gateway endpoints)
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(0.01),
    };

    // Arbitrary for generating Gateway VPC endpoint resources
    const gatewayEndpointArb = fc.record({
      logicalId: fc.string({ minLength: 1, maxLength: 255 }),
      type: fc.constant('AWS::EC2::VPCEndpoint'),
      properties: fc.oneof(
        // Explicit Gateway type
        fc.record({
          VpcEndpointType: fc.constant('Gateway'),
          ServiceName: fc.oneof(
            fc.constant('com.amazonaws.us-east-1.s3'),
            fc.constant('com.amazonaws.eu-central-1.dynamodb'),
            fc.constant('com.amazonaws.us-west-2.s3'),
            fc.string(),
          ),
        }),
        // S3 service name (implies Gateway)
        fc.record({
          ServiceName: fc.constantFrom(
            'com.amazonaws.us-east-1.s3',
            'com.amazonaws.eu-west-1.s3',
            'com.amazonaws.ap-southeast-1.s3',
          ),
        }),
        // DynamoDB service name (implies Gateway)
        fc.record({
          ServiceName: fc.constantFrom(
            'com.amazonaws.us-east-1.dynamodb',
            'com.amazonaws.eu-central-1.dynamodb',
            'com.amazonaws.ap-northeast-1.dynamodb',
          ),
        }),
      ),
    });

    const regionArb = fc.constantFrom(
      'us-east-1',
      'us-west-2',
      'eu-central-1',
      'eu-west-1',
      'ap-southeast-1',
    );

    void fc.assert(
      fc.asyncProperty(
        gatewayEndpointArb,
        regionArb,
        async (resource: ResourceWithId, region: string) => {
          const cost = await calculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          // Gateway endpoints should have zero cost
          expect(cost.amount).toBe(0);
          expect(cost.currency).toBe('USD');
          expect(cost.confidence).toBe('high');

          // Should have assumptions explaining why it's free
          expect(cost.assumptions.length).toBeGreaterThan(0);
          const assumptionText = cost.assumptions.join(' ').toLowerCase();
          expect(assumptionText).toMatch(/gateway|free/);

          // Pricing client should not be called for Gateway endpoints
          expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: production-readiness, Property 10: Gateway VPC endpoints have zero cost
   * Validates: Requirements 11.3
   */
  it('should return non-zero cost for Interface VPC endpoints', () => {
    const calculator = new VPCEndpointCalculator();

    // Mock pricing client that returns realistic pricing
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockImplementation(async (params) => {
        // Return hourly rate for endpoint hours
        if (params.filters?.some((f: any) => f.value?.includes('Hours'))) {
          return 0.01; // $0.01 per hour
        }
        // Return data processing rate
        if (params.filters?.some((f: any) => f.value?.includes('Bytes'))) {
          return 0.01; // $0.01 per GB
        }
        return null;
      }),
    };

    // Arbitrary for generating Interface VPC endpoint resources
    const interfaceEndpointArb = fc.record({
      logicalId: fc.string({ minLength: 1, maxLength: 255 }),
      type: fc.constant('AWS::EC2::VPCEndpoint'),
      properties: fc.oneof(
        // Explicit Interface type
        fc.record({
          VpcEndpointType: fc.constant('Interface'),
          ServiceName: fc.constantFrom(
            'com.amazonaws.us-east-1.ec2',
            'com.amazonaws.eu-central-1.lambda',
            'com.amazonaws.us-west-2.sns',
          ),
        }),
        // No type specified (defaults to Interface) with non-S3/DynamoDB service
        fc.record({
          ServiceName: fc.constantFrom(
            'com.amazonaws.us-east-1.ec2',
            'com.amazonaws.eu-central-1.lambda',
            'com.amazonaws.us-west-2.sns',
            'com.amazonaws.ap-southeast-1.sqs',
          ),
        }),
        // Empty properties (defaults to Interface)
        fc.constant({}),
      ),
    });

    const regionArb = fc.constantFrom(
      'us-east-1',
      'us-west-2',
      'eu-central-1',
      'eu-west-1',
    );

    void fc.assert(
      fc.asyncProperty(
        interfaceEndpointArb,
        regionArb,
        async (resource: ResourceWithId, region: string) => {
          const cost = await calculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          // Interface endpoints should have non-zero cost
          expect(cost.amount).toBeGreaterThan(0);
          expect(cost.currency).toBe('USD');
          expect(cost.confidence).toBe('medium');

          // Should have assumptions about hourly and data processing costs
          expect(cost.assumptions.length).toBeGreaterThan(0);
          const assumptionText = cost.assumptions.join(' ').toLowerCase();
          expect(assumptionText).toMatch(/interface|hourly|data/);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: production-readiness, Property 10: Gateway VPC endpoints have zero cost
   * Validates: Requirements 11.3
   */
  it('should consistently return zero for all Gateway endpoint variations', () => {
    const calculator = new VPCEndpointCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(0.01),
    };

    // Test various ways a Gateway endpoint can be specified
    const gatewayVariationsArb = fc.constantFrom(
      // Explicit Gateway type with S3
      {
        logicalId: 'S3Gateway',
        type: 'AWS::EC2::VPCEndpoint' as const,
        properties: {
          VpcEndpointType: 'Gateway',
          ServiceName: 'com.amazonaws.us-east-1.s3',
        },
      },
      // Explicit Gateway type with DynamoDB
      {
        logicalId: 'DynamoGateway',
        type: 'AWS::EC2::VPCEndpoint' as const,
        properties: {
          VpcEndpointType: 'Gateway',
          ServiceName: 'com.amazonaws.eu-central-1.dynamodb',
        },
      },
      // S3 service name without explicit type
      {
        logicalId: 'S3Endpoint',
        type: 'AWS::EC2::VPCEndpoint' as const,
        properties: {
          ServiceName: 'com.amazonaws.us-west-2.s3',
        },
      },
      // DynamoDB service name without explicit type
      {
        logicalId: 'DynamoEndpoint',
        type: 'AWS::EC2::VPCEndpoint' as const,
        properties: {
          ServiceName: 'com.amazonaws.ap-southeast-1.dynamodb',
        },
      },
    );

    const regionArb = fc.constantFrom(
      'us-east-1',
      'eu-central-1',
      'ap-southeast-1',
    );

    void fc.assert(
      fc.asyncProperty(
        gatewayVariationsArb,
        regionArb,
        async (resource, region) => {
          const cost = await calculator.calculateCost(
            resource,
            region,
            mockPricingClient,
          );

          // All Gateway variations should have zero cost
          expect(cost.amount).toBe(0);
          expect(cost.currency).toBe('USD');
          expect(cost.confidence).toBe('high');
          expect(cost.assumptions.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: production-readiness, Property 10: Gateway VPC endpoints have zero cost
   * Validates: Requirements 11.3
   */
  it('should support VPC Endpoint resource type', () => {
    const calculator = new VPCEndpointCalculator();

    expect(calculator.supports('AWS::EC2::VPCEndpoint')).toBe(true);
    expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    expect(calculator.supports('AWS::EC2::NatGateway')).toBe(false);
  });

  /**
   * Feature: production-readiness, Property 10: Gateway VPC endpoints have zero cost
   * Validates: Requirements 11.3
   */
  it('should handle missing pricing data for Interface endpoints gracefully', () => {
    const calculator = new VPCEndpointCalculator();

    // Mock pricing client that returns null (pricing unavailable)
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn().mockResolvedValue(null),
    };

    const interfaceEndpointArb = fc.record({
      logicalId: fc.string({ minLength: 1 }),
      type: fc.constant('AWS::EC2::VPCEndpoint'),
      properties: fc.record({
        VpcEndpointType: fc.constant('Interface'),
        ServiceName: fc.string(),
      }),
    });

    void fc.assert(
      fc.asyncProperty(
        interfaceEndpointArb,
        async (resource: ResourceWithId) => {
          const cost = await calculator.calculateCost(
            resource,
            'us-east-1',
            mockPricingClient,
          );

          // When pricing is unavailable, should return zero with unknown confidence
          expect(cost.amount).toBe(0);
          expect(cost.currency).toBe('USD');
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Pricing data not available');
        },
      ),
      { numRuns: 50 },
    );
  });
});
