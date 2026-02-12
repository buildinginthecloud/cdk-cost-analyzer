// Jest imports are global
import { SQSCalculator } from '../../src/pricing/calculators/SQSCalculator';
import { PricingClient } from '../../src/pricing/types';
import { CostAnalyzerConfig } from '../../src/config/types';

describe('SQSCalculator', () => {
  const calculator = new SQSCalculator();

  describe('constructor', () => {
    it('should accept no config parameter for backward compatibility', () => {
      const calc = new SQSCalculator();
      expect(calc).toBeInstanceOf(SQSCalculator);
    });

    it('should accept optional config parameter', () => {
      const config: CostAnalyzerConfig = {
        usageAssumptions: {
          sqs: {
            monthlyRequests: 5_000_000,
          },
        },
      };
      const calc = new SQSCalculator(config);
      expect(calc).toBeInstanceOf(SQSCalculator);
    });

    it('should accept undefined config parameter', () => {
      const calc = new SQSCalculator(undefined);
      expect(calc).toBeInstanceOf(SQSCalculator);
    });
  });

  describe('supports', () => {
    it('should support AWS::SQS::Queue', () => {
      expect(calculator.supports('AWS::SQS::Queue')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::Lambda::Function')).toBe(false);
      expect(calculator.supports('AWS::SNS::Topic')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Standard Queue', () => {
      it('should calculate cost for standard queue with default assumptions', async () => {
        // Standard queue pricing: $0.40 per 1M requests
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Expected: (1,000,000 / 1,000,000) * 0.40 = $0.40
        expect(result.amount).toBeCloseTo(0.40, 4);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('medium');
        expect(result.assumptions).toContain('Assumes 1,000,000 requests per month');
        expect(result.assumptions).toContain('Standard queue');
        expect(result.assumptions).toContain('Does not include data transfer costs');
      });

      it('should detect standard queue when FifoQueue is false', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: false,
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.assumptions).toContain('Standard queue');
      });

      it('should detect standard queue when FifoQueue is undefined', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            QueueName: 'my-queue',
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.assumptions).toContain('Standard queue');
      });
    });

    describe('FIFO Queue', () => {
      it('should calculate cost for FIFO queue', async () => {
        // FIFO queue pricing: $0.50 per 1M requests
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

        const resource = {
          logicalId: 'MyFifoQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: true,
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Expected: (1,000,000 / 1,000,000) * 0.50 = $0.50
        expect(result.amount).toBeCloseTo(0.50, 4);
        expect(result.currency).toBe('USD');
        expect(result.confidence).toBe('medium');
        expect(result.assumptions).toContain('FIFO queue');
      });

      it('should detect FIFO queue when FifoQueue is string "true"', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

        const resource = {
          logicalId: 'MyFifoQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: 'true',
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.assumptions).toContain('FIFO queue');
      });
    });

    describe('Pricing API queries', () => {
      it('should use correct serviceCode for pricing query', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(mockPricingClient.getPrice).toHaveBeenCalledTimes(1);
        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.serviceCode).toBe('AWSQueueService');
      });

      it('should use correct usagetype for standard queue in us-east-1', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.filters).toEqual([
          { field: 'productFamily', value: 'Queue' },
          { field: 'usagetype', value: 'USE1-Requests' },
        ]);
      });

      it('should use correct usagetype for FIFO queue in us-east-1', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

        const resource = {
          logicalId: 'MyFifoQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: true,
          },
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.filters).toEqual([
          { field: 'productFamily', value: 'Queue' },
          { field: 'usagetype', value: 'USE1-Requests-FIFO' },
        ]);
      });

      it('should apply region normalization for pricing queries', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.region).toBe('EU (Frankfurt)');
      });

      it('should use region prefix for eu-central-1', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.filters).toEqual([
          { field: 'productFamily', value: 'Queue' },
          { field: 'usagetype', value: 'EUC1-Requests' },
        ]);
      });

      it('should use region prefix for eu-west-1', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        await calculator.calculateCost(resource, 'eu-west-1', mockPricingClient);

        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.filters).toEqual([
          { field: 'productFamily', value: 'Queue' },
          { field: 'usagetype', value: 'EUW1-Requests' },
        ]);
      });
    });

    describe('Custom usage assumptions', () => {
      it('should use custom monthly requests from config', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const config: CostAnalyzerConfig = {
          usageAssumptions: {
            sqs: {
              monthlyRequests: 5_000_000,
            },
          },
        };
        const customCalculator = new SQSCalculator(config);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Expected: (5,000,000 / 1,000,000) * 0.40 = $2.00
        expect(result.amount).toBeCloseTo(2.00, 4);
        expect(result.assumptions).toContain('Assumes 5,000,000 requests per month');
        expect(result.assumptions).toContain('Using custom monthly requests assumption from configuration');
      });

      it('should calculate higher cost for high-volume queue', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const config: CostAnalyzerConfig = {
          usageAssumptions: {
            sqs: {
              monthlyRequests: 100_000_000,
            },
          },
        };
        const customCalculator = new SQSCalculator(config);

        const resource = {
          logicalId: 'HighVolumeQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Expected: (100,000,000 / 1,000,000) * 0.40 = $40.00
        expect(result.amount).toBeCloseTo(40.00, 4);
      });

      it('should calculate cost for low-volume queue', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const config: CostAnalyzerConfig = {
          usageAssumptions: {
            sqs: {
              monthlyRequests: 100_000,
            },
          },
        };
        const customCalculator = new SQSCalculator(config);

        const resource = {
          logicalId: 'LowVolumeQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Expected: (100,000 / 1,000,000) * 0.40 = $0.04
        expect(result.amount).toBeCloseTo(0.04, 4);
      });
    });

    describe('Pricing data unavailable', () => {
      it('should return unknown confidence when pricing unavailable without custom config', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe('unknown');
        expect(result.assumptions[0]).toContain('Pricing data not available');
      });

      it('should use fallback pricing when API unavailable but custom config provided', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

        const config: CostAnalyzerConfig = {
          usageAssumptions: {
            sqs: {
              monthlyRequests: 2_000_000,
            },
          },
        };
        const customCalculator = new SQSCalculator(config);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Fallback standard price: $0.40 per million
        // Expected: (2,000,000 / 1,000,000) * 0.40 = $0.80
        expect(result.amount).toBeCloseTo(0.80, 4);
        expect(result.confidence).toBe('low');
        expect(result.assumptions).toContain('Using fallback pricing (API unavailable)');
      });

      it('should use FIFO fallback pricing when API unavailable', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

        const config: CostAnalyzerConfig = {
          usageAssumptions: {
            sqs: {
              monthlyRequests: 2_000_000,
            },
          },
        };
        const customCalculator = new SQSCalculator(config);

        const resource = {
          logicalId: 'MyFifoQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: true,
          },
        };

        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Fallback FIFO price: $0.50 per million
        // Expected: (2,000,000 / 1,000,000) * 0.50 = $1.00
        expect(result.amount).toBeCloseTo(1.00, 4);
        expect(result.confidence).toBe('low');
      });
    });

    describe('API errors', () => {
      it('should return unknown confidence when API throws error without custom config', async () => {
        jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Network timeout'));

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe('unknown');
        expect(result.assumptions[0]).toContain('Failed to fetch pricing');
        expect(result.assumptions[0]).toContain('Network timeout');
      });

      it('should use fallback pricing when API throws error with custom config', async () => {
        jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Service unavailable'));

        const config: CostAnalyzerConfig = {
          usageAssumptions: {
            sqs: {
              monthlyRequests: 3_000_000,
            },
          },
        };
        const customCalculator = new SQSCalculator(config);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Fallback standard price: $0.40 per million
        // Expected: (3,000,000 / 1,000,000) * 0.40 = $1.20
        expect(result.amount).toBeCloseTo(1.20, 4);
        expect(result.confidence).toBe('low');
        expect(result.assumptions).toContain('Using fallback pricing (API error)');
      });

      it('should use FIFO fallback pricing when API throws error', async () => {
        jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('Connection refused'));

        const config: CostAnalyzerConfig = {
          usageAssumptions: {
            sqs: {
              monthlyRequests: 1_000_000,
            },
          },
        };
        const customCalculator = new SQSCalculator(config);

        const resource = {
          logicalId: 'MyFifoQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            FifoQueue: true,
          },
        };

        const result = await customCalculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Fallback FIFO price: $0.50 per million
        // Expected: (1,000,000 / 1,000,000) * 0.50 = $0.50
        expect(result.amount).toBeCloseTo(0.50, 4);
        expect(result.confidence).toBe('low');
      });
    });

    describe('Cost breakdown', () => {
      it('should return correct confidence level for successful API calls', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.confidence).toBe('medium');
      });

      it('should include data transfer disclaimer in assumptions', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.assumptions).toContain('Does not include data transfer costs');
      });

      it('should always return USD currency', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        expect(result.currency).toBe('USD');
      });
    });

    describe('Edge cases', () => {
      it('should handle queue with additional properties', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            QueueName: 'my-queue',
            VisibilityTimeout: 30,
            MessageRetentionPeriod: 345600,
            MaximumMessageSize: 262144,
            DelaySeconds: 0,
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(0.40, 4);
        expect(result.confidence).toBe('medium');
        expect(result.assumptions).toContain('Standard queue');
      });

      it('should handle FIFO queue with ContentBasedDeduplication', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.50);

        const resource = {
          logicalId: 'MyFifoQueue',
          type: 'AWS::SQS::Queue',
          properties: {
            QueueName: 'my-queue.fifo',
            FifoQueue: true,
            ContentBasedDeduplication: true,
          },
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeCloseTo(0.50, 4);
        expect(result.assumptions).toContain('FIFO queue');
      });

      it('should handle empty properties object', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'EmptyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        expect(result.amount).toBeGreaterThan(0);
        expect(result.confidence).toBe('medium');
        expect(result.assumptions).toContain('Standard queue');
      });
    });

    describe('Regional pricing variations', () => {
      it('should query pricing for ap-southeast-1', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        await calculator.calculateCost(resource, 'ap-southeast-1', mockPricingClient);

        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.region).toBe('Asia Pacific (Singapore)');
        expect(call.filters).toEqual([
          { field: 'productFamily', value: 'Queue' },
          { field: 'usagetype', value: 'APS3-Requests' },
        ]);
      });

      it('should query pricing for us-west-2', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.40);

        const resource = {
          logicalId: 'MyQueue',
          type: 'AWS::SQS::Queue',
          properties: {},
        };

        await calculator.calculateCost(resource, 'us-west-2', mockPricingClient);

        const call = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        expect(call.region).toBe('US West (Oregon)');
        expect(call.filters).toEqual([
          { field: 'productFamily', value: 'Queue' },
          { field: 'usagetype', value: 'USW2-Requests' },
        ]);
      });
    });
  });
});
