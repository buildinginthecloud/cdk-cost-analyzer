// Jest imports are global
import { APIGatewayCalculator } from '../../src/pricing/calculators/APIGatewayCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('APIGatewayCalculator', () => {
  const calculator = new APIGatewayCalculator();

  describe('supports', () => {
    it('should support AWS::ApiGateway::RestApi', () => {
      expect(calculator.supports('AWS::ApiGateway::RestApi')).toBe(true);
    });

    it('should support AWS::ApiGatewayV2::Api', () => {
      expect(calculator.supports('AWS::ApiGatewayV2::Api')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    it('should calculate cost for REST API', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(3.5);

      const resource = {
        logicalId: 'MyRestApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('REST API type');
    });

    it('should calculate cost for HTTP API', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(1.0);

      const resource = {
        logicalId: 'MyHttpApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'HTTP',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('HTTP API type');
    });

    it('should calculate cost for WebSocket API', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(1.0);

      const resource = {
        logicalId: 'MyWebSocketApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'WEBSOCKET',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions.some(a => a.includes('WebSocket'))).toBe(true);
    });

    it('should default to REST API for v1 APIs', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(3.5);

      const resource = {
        logicalId: 'MyApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('REST API type');
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
