import { Route53Calculator } from '../../src/pricing/calculators/Route53Calculator';
import { PricingClient } from '../../src/pricing/types';

describe('Route53Calculator', () => {
  const calculator = new Route53Calculator();

  describe('supports', () => {
    it('should support Route 53 resource types', () => {
      expect(calculator.supports('AWS::Route53::HostedZone')).toBe(true);
      expect(calculator.supports('AWS::Route53::HealthCheck')).toBe(true);
      expect(calculator.supports('AWS::Route53::RecordSet')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    describe('HostedZone', () => {
      it('should return fixed hosted zone cost', async () => {
        const resource = {
          logicalId: 'MyZone',
          type: 'AWS::Route53::HostedZone',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(0.50, 2);
        expect(result.confidence).toBe('high');
        expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
      });
    });

    describe('HealthCheck', () => {
      it('should calculate basic HTTP health check cost', async () => {
        const resource = {
          logicalId: 'MyCheck',
          type: 'AWS::Route53::HealthCheck',
          properties: { HealthCheckConfig: { Type: 'HTTP' } },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(0.50, 2);
        expect(result.confidence).toBe('high');
      });

      it('should calculate HTTPS health check cost', async () => {
        const resource = {
          logicalId: 'MyCheck',
          type: 'AWS::Route53::HealthCheck',
          properties: { HealthCheckConfig: { Type: 'HTTPS' } },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(1.00, 2);
      });

      it('should calculate string match health check cost', async () => {
        const resource = {
          logicalId: 'MyCheck',
          type: 'AWS::Route53::HealthCheck',
          properties: { HealthCheckConfig: { Type: 'HTTP_STR_MATCH' } },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(1.00, 2);
      });

      it('should default to basic pricing for TCP checks', async () => {
        const resource = {
          logicalId: 'MyCheck',
          type: 'AWS::Route53::HealthCheck',
          properties: { HealthCheckConfig: { Type: 'TCP' } },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(0.50, 2);
      });

      it('should handle missing health check config', async () => {
        const resource = {
          logicalId: 'MyCheck',
          type: 'AWS::Route53::HealthCheck',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(0.50, 2);
      });
    });

    describe('RecordSet', () => {
      it('should calculate standard query cost', async () => {
        const resource = {
          logicalId: 'MyRecord',
          type: 'AWS::Route53::RecordSet',
          properties: { Type: 'A' },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 1M queries × $0.40/M = $0.40
        expect(result.amount).toBeCloseTo(0.40, 2);
        expect(result.confidence).toBe('medium');
      });

      it('should calculate latency-based routing cost', async () => {
        const resource = {
          logicalId: 'MyRecord',
          type: 'AWS::Route53::RecordSet',
          properties: { Region: 'us-east-1' },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 1M queries × $0.60/M = $0.60
        expect(result.amount).toBeCloseTo(0.60, 2);
      });

      it('should calculate geolocation routing cost', async () => {
        const resource = {
          logicalId: 'MyRecord',
          type: 'AWS::Route53::RecordSet',
          properties: { GeoLocation: { CountryCode: 'US' } },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 1M queries × $0.70/M = $0.70
        expect(result.amount).toBeCloseTo(0.70, 2);
      });

      it('should return zero cost for alias records', async () => {
        const resource = {
          logicalId: 'MyRecord',
          type: 'AWS::Route53::RecordSet',
          properties: { AliasTarget: { DNSName: 'example.com' } },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe('high');
      });

      it('should use custom query count', async () => {
        const customCalc = new Route53Calculator(10_000_000);

        const resource = {
          logicalId: 'MyRecord',
          type: 'AWS::Route53::RecordSet',
          properties: { Type: 'A' },
        };

        const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 10M queries × $0.40/M = $4.00
        expect(result.amount).toBeCloseTo(4.00, 2);
      });
    });
  });
});
