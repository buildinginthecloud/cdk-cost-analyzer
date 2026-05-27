import { SageMakerCalculator } from '../../src/pricing/calculators/SageMakerCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('SageMakerCalculator', () => {
  const calculator = new SageMakerCalculator();

  describe('supports', () => {
    it('should support SageMaker resource types', () => {
      expect(calculator.supports('AWS::SageMaker::Endpoint')).toBe(true);
      expect(calculator.supports('AWS::SageMaker::NotebookInstance')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('AWS::SageMaker::Endpoint', () => {
      it('should calculate endpoint cost using fallback pricing', async () => {
        const resource = {
          logicalId: 'MyEndpoint',
          type: 'AWS::SageMaker::Endpoint',
          properties: { EndpointConfigName: 'my-config' },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 0.269 * 730 = 196.37
        expect(result.amount).toBeCloseTo(196.37, 2);
        expect(result.confidence).toBe('medium');
        expect(result.currency).toBe('USD');
      });

      it('should not call the pricing API for endpoints', async () => {
        const resource = {
          logicalId: 'MyEndpoint',
          type: 'AWS::SageMaker::Endpoint',
          properties: {},
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
      });

      it('should use custom hours per month', async () => {
        const customCalc = new SageMakerCalculator(730);

        const resource = {
          logicalId: 'MyEndpoint',
          type: 'AWS::SageMaker::Endpoint',
          properties: {},
        };

        const result = await customCalc.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 0.269 * 730 = 196.37
        expect(result.amount).toBeCloseTo(196.37, 2);
      });
    });

    describe('AWS::SageMaker::NotebookInstance', () => {
      it('should calculate notebook cost with API pricing', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.0582);

        const resource = {
          logicalId: 'MyNotebook',
          type: 'AWS::SageMaker::NotebookInstance',
          properties: { InstanceType: 'ml.t3.medium' },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 0.0582 * 730 = 42.486
        expect(result.amount).toBeCloseTo(42.49, 2);
        expect(result.confidence).toBe('high');
      });

      it('should use fallback pricing when API returns null', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(null);

        const resource = {
          logicalId: 'MyNotebook',
          type: 'AWS::SageMaker::NotebookInstance',
          properties: { InstanceType: 'ml.t3.medium' },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // 0.0582 * 730 = 42.486
        expect(result.amount).toBeCloseTo(42.49, 2);
        expect(result.confidence).toBe('medium');
      });

      it('should default instance type to ml.t3.medium when not specified', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValueOnce(0.0582);

        const resource = {
          logicalId: 'MyNotebook',
          type: 'AWS::SageMaker::NotebookInstance',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(42.49, 2);
        expect(mockPricingClient.getPrice).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceCode: 'AmazonSageMaker',
            filters: expect.arrayContaining([
              expect.objectContaining({ field: 'instanceType', value: 'ml.t3.medium' }),
            ]),
          }),
        );
      });

      it('should handle API errors and return unknown confidence', async () => {
        jest.mocked(mockPricingClient.getPrice).mockRejectedValueOnce(new Error('API connection failed'));

        const resource = {
          logicalId: 'MyNotebook',
          type: 'AWS::SageMaker::NotebookInstance',
          properties: { InstanceType: 'ml.t3.medium' },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe('unknown');
        expect(result.assumptions[0]).toContain('Failed to fetch pricing');
      });
    });
  });
});
