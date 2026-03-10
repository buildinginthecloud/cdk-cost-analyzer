import { TransitGatewayCalculator } from '../../src/pricing/calculators/TransitGatewayCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('TransitGatewayCalculator', () => {
  const calculator = new TransitGatewayCalculator();

  describe('supports', () => {
    it('should support AWS::EC2::TransitGateway', () => {
      expect(calculator.supports('AWS::EC2::TransitGateway')).toBe(true);
    });

    it('should support AWS::EC2::TransitGatewayAttachment', () => {
      expect(calculator.supports('AWS::EC2::TransitGatewayAttachment')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('TransitGateway', () => {
      it('should calculate cost with API pricing', async () => {
        jest.mocked(mockPricingClient.getPrice)
          .mockResolvedValueOnce(0.05)  // attachment rate
          .mockResolvedValueOnce(0.02); // data rate

        const resource = {
          logicalId: 'MyTGW',
          type: 'AWS::EC2::TransitGateway',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 3 attachments × $0.05 × 730 = $109.50 + 1000GB × $0.02 = $20.00
        expect(result.amount).toBeCloseTo(129.50, 2);
        expect(result.confidence).toBe('medium');
      });

      it('should use fallback pricing when API returns null', async () => {
        jest.mocked(mockPricingClient.getPrice)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);

        const resource = {
          logicalId: 'MyTGW',
          type: 'AWS::EC2::TransitGateway',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(129.50, 2);
        expect(result.assumptions.some(a => a.includes('fallback pricing'))).toBe(true);
      });

      it('should use custom attachment and data values', async () => {
        const customCalc = new TransitGatewayCalculator(5, 2000);
        jest.mocked(mockPricingClient.getPrice)
          .mockResolvedValueOnce(0.05)
          .mockResolvedValueOnce(0.02);

        const resource = {
          logicalId: 'MyTGW',
          type: 'AWS::EC2::TransitGateway',
          properties: {},
        };

        const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 5 × $0.05 × 730 = $182.50 + 2000 × $0.02 = $40.00
        expect(result.amount).toBeCloseTo(222.50, 2);
      });
    });

    describe('TransitGatewayAttachment', () => {
      it('should calculate single attachment cost', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.05);

        const resource = {
          logicalId: 'MyAttachment',
          type: 'AWS::EC2::TransitGatewayAttachment',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // $0.05 × 730 = $36.50
        expect(result.amount).toBeCloseTo(36.50, 2);
        expect(result.confidence).toBe('high');
      });

      it('should use fallback for attachment when API returns null', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

        const resource = {
          logicalId: 'MyAttachment',
          type: 'AWS::EC2::TransitGatewayAttachment',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(36.50, 2);
        expect(result.confidence).toBe('medium');
      });
    });

    it('should handle API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockImplementation(() => {
        return Promise.reject(new Error('API error'));
      });

      const resource = {
        logicalId: 'MyTGW',
        type: 'AWS::EC2::TransitGateway',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
