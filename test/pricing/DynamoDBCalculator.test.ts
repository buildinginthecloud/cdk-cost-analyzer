// Jest imports are global
import { DynamoDBCalculator } from '../../src/pricing/calculators/DynamoDBCalculator';
import { PricingClient } from '../../src/pricing/types';
import { CostAnalyzerConfig } from '../../src/config/types';

describe('DynamoDBCalculator', () => {
  const calculator = new DynamoDBCalculator();

  describe('constructor', () => {
    it('should accept no config parameter for backward compatibility', () => {
      const calc = new DynamoDBCalculator();
      expect(calc).toBeInstanceOf(DynamoDBCalculator);
    });

    it('should accept optional config parameter', () => {
      const config: CostAnalyzerConfig = {
        usageAssumptions: {
          dynamodb: {
            readRequestsPerMonth: 5_000_000,
            writeRequestsPerMonth: 500_000,
          },
        },
      };
      const calc = new DynamoDBCalculator(config);
      expect(calc).toBeInstanceOf(DynamoDBCalculator);
    });

    it('should accept undefined config parameter', () => {
      const calc = new DynamoDBCalculator(undefined);
      expect(calc).toBeInstanceOf(DynamoDBCalculator);
    });
  });

  describe('supports', () => {
    it('should support AWS::DynamoDB::Table', () => {
      expect(calculator.supports('AWS::DynamoDB::Table')).toBe(true);
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

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost for on-demand billing mode', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('On-demand billing mode');
    });

    describe('on-demand pricing queries', () => {
      it('should use correct serviceCode for on-demand pricing', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PAY_PER_REQUEST',
          },
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Both read and write queries should use AmazonDynamoDB serviceCode
        expect(mockPricingClient.getPrice).toHaveBeenCalledTimes(2);
        const calls = jest.mocked(mockPricingClient.getPrice).mock.calls;
        
        expect(calls[0][0].serviceCode).toBe('AmazonDynamoDB');
        expect(calls[1][0].serviceCode).toBe('AmazonDynamoDB');
      });

      it('should use correct filter values for read requests', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PAY_PER_REQUEST',
          },
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // First call should be for read requests
        const readCall = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        
        expect(readCall.filters).toEqual([
          { field: 'group', value: 'DDB-ReadUnits', type: 'TERM_MATCH' },
          { field: 'groupDescription', value: 'OnDemand ReadRequestUnits', type: 'TERM_MATCH' },
        ]);
      });

      it('should use correct filter values for write requests', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PAY_PER_REQUEST',
          },
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Second call should be for write requests
        const writeCall = jest.mocked(mockPricingClient.getPrice).mock.calls[1][0];
        
        expect(writeCall.filters).toEqual([
          { field: 'group', value: 'DDB-WriteUnits', type: 'TERM_MATCH' },
          { field: 'groupDescription', value: 'OnDemand WriteRequestUnits', type: 'TERM_MATCH' },
        ]);
      });

      it('should apply region normalization for on-demand queries', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PAY_PER_REQUEST',
          },
        };

        // Test with eu-central-1 which normalizes to "EU (Frankfurt)"
        await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        const calls = jest.mocked(mockPricingClient.getPrice).mock.calls;
        
        // Both calls should use the normalized region
        expect(calls[0][0].region).toBe('EU (Frankfurt)');
        expect(calls[1][0].region).toBe('EU (Frankfurt)');
      });

      it('should apply region normalization for us-east-1', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PAY_PER_REQUEST',
          },
        };

        // Test with us-east-1 which normalizes to "US East (N. Virginia)"
        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        const calls = jest.mocked(mockPricingClient.getPrice).mock.calls;
        
        // Both calls should use the normalized region
        expect(calls[0][0].region).toBe('US East (N. Virginia)');
        expect(calls[1][0].region).toBe('US East (N. Virginia)');
      });

      it('should query pricing for both read and write requests', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.25);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PAY_PER_REQUEST',
          },
        };

        await calculator.calculateCost(resource, 'us-west-2', mockPricingClient);

        // Should make exactly 2 pricing queries
        expect(mockPricingClient.getPrice).toHaveBeenCalledTimes(2);
      });
    });

    describe('provisioned pricing queries', () => {
      it('should use correct serviceCode for provisioned pricing', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 10,
              WriteCapacityUnits: 5,
            },
          },
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Both read and write queries should use AmazonDynamoDB serviceCode
        expect(mockPricingClient.getPrice).toHaveBeenCalledTimes(2);
        const calls = jest.mocked(mockPricingClient.getPrice).mock.calls;
        
        expect(calls[0][0].serviceCode).toBe('AmazonDynamoDB');
        expect(calls[1][0].serviceCode).toBe('AmazonDynamoDB');
      });

      it('should use correct filter values for read capacity', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 10,
              WriteCapacityUnits: 5,
            },
          },
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // First call should be for read capacity
        const readCall = jest.mocked(mockPricingClient.getPrice).mock.calls[0][0];
        
        expect(readCall.filters).toEqual([
          { field: 'usagetype', value: 'us-east-1-ReadCapacityUnit-Hrs', type: 'TERM_MATCH' },
        ]);
      });

      it('should use correct filter values for write capacity', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 10,
              WriteCapacityUnits: 5,
            },
          },
        };

        await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

        // Second call should be for write capacity
        const writeCall = jest.mocked(mockPricingClient.getPrice).mock.calls[1][0];
        
        expect(writeCall.filters).toEqual([
          { field: 'usagetype', value: 'us-east-1-WriteCapacityUnit-Hrs', type: 'TERM_MATCH' },
        ]);
      });

      it('should apply region normalization for provisioned queries', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 10,
              WriteCapacityUnits: 5,
            },
          },
        };

        // Test with eu-central-1 which normalizes to "EU (Frankfurt)"
        await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

        const calls = jest.mocked(mockPricingClient.getPrice).mock.calls;
        
        // Both calls should use the normalized region
        expect(calls[0][0].region).toBe('EU (Frankfurt)');
        expect(calls[1][0].region).toBe('EU (Frankfurt)');
        
        // But the filter values should use the raw region code
        expect(calls[0][0].filters[0].value).toBe('eu-central-1-ReadCapacityUnit-Hrs');
        expect(calls[1][0].filters[0].value).toBe('eu-central-1-WriteCapacityUnit-Hrs');
      });

      it('should query pricing for both read and write capacity', async () => {
        jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

        const resource = {
          logicalId: 'MyTable',
          type: 'AWS::DynamoDB::Table',
          properties: {
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 10,
              WriteCapacityUnits: 5,
            },
          },
        };

        await calculator.calculateCost(resource, 'us-west-2', mockPricingClient);

        // Should make exactly 2 pricing queries
        expect(mockPricingClient.getPrice).toHaveBeenCalledTimes(2);
      });
    });

    it('should calculate cost for provisioned billing mode', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PROVISIONED',
          ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 5,
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('high');
      expect(result.assumptions).toContain('10 provisioned read capacity units');
      expect(result.assumptions).toContain('5 provisioned write capacity units');
    });

    it('should use default provisioned capacity when not specified', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.00013);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBeGreaterThan(0);
      expect(result.assumptions).toContain('5 provisioned read capacity units');
      expect(result.assumptions).toContain('5 provisioned write capacity units');
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PROVISIONED',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource = {
        logicalId: 'MyTable',
        type: 'AWS::DynamoDB::Table',
        properties: {
          BillingMode: 'PAY_PER_REQUEST',
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });
  });
});
