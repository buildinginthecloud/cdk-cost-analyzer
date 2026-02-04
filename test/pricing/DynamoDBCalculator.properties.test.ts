// Property-based tests for DynamoDBCalculator
import * as fc from 'fast-check';
import { DynamoDBCalculator } from '../../src/pricing/calculators/DynamoDBCalculator';
import { PricingClient, PriceFilter } from '../../src/pricing/types';
import { CostAnalyzerConfig } from '../../src/config/types';

describe('DynamoDBCalculator Property-Based Tests', () => {
  describe('Property 1: Billing Mode Detection', () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.4**
     * 
     * For any DynamoDB table resource, the calculator should correctly identify
     * the billing mode as PAY_PER_REQUEST when BillingMode is "PAY_PER_REQUEST",
     * as PROVISIONED when BillingMode is "PROVISIONED" or when ProvisionedThroughput
     * is defined, and should default to PROVISIONED when BillingMode is not specified.
     */
    it('should correctly detect billing mode from resource properties', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('PAY_PER_REQUEST'),
            fc.constant('PROVISIONED'),
            fc.constant(undefined)
          ), // billingMode
          fc.boolean(), // hasProvisionedThroughput
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // price
          async (billingMode, hasProvisionedThroughput, price) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockResolvedValue(price),
            };

            const resource: any = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {},
            };

            if (billingMode) {
              resource.properties.BillingMode = billingMode;
            }

            if (hasProvisionedThroughput) {
              resource.properties.ProvisionedThroughput = {
                ReadCapacityUnits: 10,
                WriteCapacityUnits: 5,
              };
            }

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Determine expected billing mode
            // Per requirement 1.4: When ProvisionedThroughput is defined, treat as provisioned
            let expectedMode: string;
            if (hasProvisionedThroughput) {
              expectedMode = 'provisioned';
            } else if (billingMode === 'PAY_PER_REQUEST') {
              expectedMode = 'on-demand';
            } else {
              expectedMode = 'provisioned';
            }

            // Verify the billing mode is indicated in assumptions
            const hasBillingMode = result.assumptions.some(a => 
              a.toLowerCase().includes(expectedMode)
            );
            expect(hasBillingMode).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Pay-Per-Request Confidence Level', () => {
    /**
     * **Validates: Requirements 2.5**
     * 
     * For any pay-per-request table where pricing data is successfully retrieved,
     * the confidence level should be "medium".
     */
    it('should return medium confidence for successful pay-per-request pricing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readPrice, writePrice) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-ReadUnits')) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-WriteUnits')) {
                  return writePrice;
                }
                return null;
              }),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PAY_PER_REQUEST',
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(result.confidence).toBe('medium');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Provisioned Capacity Extraction', () => {
    /**
     * **Validates: Requirements 3.3, 3.4**
     * 
     * For any provisioned table with ProvisionedThroughput defined, the calculator
     * should correctly extract both ReadCapacityUnits and WriteCapacityUnits from
     * the resource properties.
     */
    it('should correctly extract capacity units from resource properties', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // readCapacity
          fc.integer({ min: 1, max: 1000 }), // writeCapacity
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // price
          async (readCapacity, writeCapacity, price) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockResolvedValue(price),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                  ReadCapacityUnits: readCapacity,
                  WriteCapacityUnits: writeCapacity,
                },
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Verify the capacity units are mentioned in assumptions
            const hasReadCapacity = result.assumptions.some(a => 
              a.includes(`${readCapacity}`) && a.toLowerCase().includes('read capacity')
            );
            const hasWriteCapacity = result.assumptions.some(a => 
              a.includes(`${writeCapacity}`) && a.toLowerCase().includes('write capacity')
            );

            expect(hasReadCapacity).toBe(true);
            expect(hasWriteCapacity).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Provisioned Confidence Level', () => {
    /**
     * **Validates: Requirements 3.7**
     * 
     * For any provisioned table where pricing data is successfully retrieved,
     * the confidence level should be "high".
     */
    it('should return high confidence for successful provisioned pricing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // readCapacity
          fc.integer({ min: 1, max: 1000 }), // writeCapacity
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readCapacity, writeCapacity, readPrice, writePrice) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value.includes('ReadCapacityUnit-Hrs'))) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value.includes('WriteCapacityUnit-Hrs'))) {
                  return writePrice;
                }
                return null;
              }),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                  ReadCapacityUnits: readCapacity,
                  WriteCapacityUnits: writeCapacity,
                },
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(result.confidence).toBe('high');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Region Normalization', () => {
    /**
     * **Validates: Requirements 5.5**
     * 
     * For any pricing query, the calculator should normalize the region using
     * RegionMapper before passing it to the PricingClient.
     */
    it('should normalize region for all pricing queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1'), // region
          fc.constantFrom('PAY_PER_REQUEST', 'PROVISIONED'), // billingMode
          async (region, billingMode) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockResolvedValue(0.25),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: billingMode,
                ...(billingMode === 'PROVISIONED' ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5,
                  },
                } : {}),
              },
            };

            await calculator.calculateCost(resource, region, mockPricingClient);

            // Verify that getPrice was called
            expect(mockPricingClient.getPrice).toHaveBeenCalled();

            // Verify that the region parameter is normalized (not the raw region code)
            const calls = jest.mocked(mockPricingClient.getPrice).mock.calls;
            for (const call of calls) {
              const query = call[0];
              // The region should be normalized (e.g., "US East (N. Virginia)" not "us-east-1")
              expect(query.region).not.toBe(region);
              // The region should contain spaces or parentheses (indicating normalization)
              expect(query.region).toMatch(/[\s()]/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Configuration Integration', () => {
    /**
     * **Validates: Requirements 4.4, 4.5**
     * 
     * For any configuration with dynamodb usage assumptions specified,
     * the calculator should use those values for readRequestsPerMonth
     * and writeRequestsPerMonth in pay-per-request cost calculations.
     */
    it('should use configured readRequestsPerMonth and writeRequestsPerMonth for pay-per-request calculations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random but valid configuration values
          fc.integer({ min: 1_000, max: 100_000_000 }), // readRequestsPerMonth
          fc.integer({ min: 1_000, max: 100_000_000 }), // writeRequestsPerMonth
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readRequestsPerMonth, writeRequestsPerMonth, readPrice, writePrice) => {
            // Create config with specific usage assumptions
            const config: CostAnalyzerConfig = {
              usageAssumptions: {
                dynamodb: {
                  readRequestsPerMonth,
                  writeRequestsPerMonth,
                },
              },
            };

            // Create calculator with config
            const calculator = new DynamoDBCalculator(config);

            // Mock pricing client to return our test prices
            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                // Return different prices based on the query
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-ReadUnits')) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-WriteUnits')) {
                  return writePrice;
                }
                return null;
              }),
            };

            // Create a pay-per-request resource
            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PAY_PER_REQUEST',
              },
            };

            // Calculate cost
            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Calculate expected cost using the formula: requests * pricePerUnit
            // AWS Pricing API returns price per individual request unit
            const expectedCost =
              (readRequestsPerMonth * readPrice) +
              (writeRequestsPerMonth * writePrice);

            // Verify the calculated cost matches the expected formula
            expect(result.amount).toBeCloseTo(expectedCost, 5);

            // Verify the assumptions include the configured values
            const readAssumption = result.assumptions.find(a =>
              a.includes(readRequestsPerMonth.toLocaleString()) && a.includes('read requests')
            );
            const writeAssumption = result.assumptions.find(a =>
              a.includes(writeRequestsPerMonth.toLocaleString()) && a.includes('write requests')
            );

            expect(readAssumption).toBeDefined();
            expect(writeAssumption).toBeDefined();

            // Verify confidence level is medium for successful pay-per-request
            expect(result.confidence).toBe('medium');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should use default values when configuration is not provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readPrice, writePrice) => {
            // Create calculator without config
            const calculator = new DynamoDBCalculator();

            // Mock pricing client
            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-ReadUnits')) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-WriteUnits')) {
                  return writePrice;
                }
                return null;
              }),
            };

            // Create a pay-per-request resource
            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PAY_PER_REQUEST',
              },
            };

            // Calculate cost
            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Default values from requirements: 10,000,000 read and 1,000,000 write
            const defaultReadRequests = 10_000_000;
            const defaultWriteRequests = 1_000_000;

            // Calculate expected cost using defaults: requests * pricePerUnit
            const expectedCost =
              (defaultReadRequests * readPrice) +
              (defaultWriteRequests * writePrice);

            // Verify the calculated cost matches the expected formula with defaults
            expect(result.amount).toBeCloseTo(expectedCost, 5);

            // Verify the assumptions include the default values
            const readAssumption = result.assumptions.find(a => 
              a.includes(defaultReadRequests.toLocaleString()) && a.includes('read requests')
            );
            const writeAssumption = result.assumptions.find(a => 
              a.includes(defaultWriteRequests.toLocaleString()) && a.includes('write requests')
            );

            expect(readAssumption).toBeDefined();
            expect(writeAssumption).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should use default for missing readRequestsPerMonth when only writeRequestsPerMonth is configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1_000, max: 100_000_000 }), // writeRequestsPerMonth (configured)
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (writeRequestsPerMonth, readPrice, writePrice) => {
            // Create config with only writeRequestsPerMonth
            const config: CostAnalyzerConfig = {
              usageAssumptions: {
                dynamodb: {
                  writeRequestsPerMonth,
                  // readRequestsPerMonth is intentionally omitted
                },
              },
            };

            const calculator = new DynamoDBCalculator(config);

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-ReadUnits')) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-WriteUnits')) {
                  return writePrice;
                }
                return null;
              }),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PAY_PER_REQUEST',
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Should use default for read (10,000,000) and configured value for write
            const defaultReadRequests = 10_000_000;
            const expectedCost =
              (defaultReadRequests * readPrice) +
              (writeRequestsPerMonth * writePrice);

            expect(result.amount).toBeCloseTo(expectedCost, 5);

            // Verify assumptions include both values
            const readAssumption = result.assumptions.find(a => 
              a.includes(defaultReadRequests.toLocaleString()) && a.includes('read requests')
            );
            const writeAssumption = result.assumptions.find(a => 
              a.includes(writeRequestsPerMonth.toLocaleString()) && a.includes('write requests')
            );

            expect(readAssumption).toBeDefined();
            expect(writeAssumption).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should use default for missing writeRequestsPerMonth when only readRequestsPerMonth is configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1_000, max: 100_000_000 }), // readRequestsPerMonth (configured)
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readRequestsPerMonth, readPrice, writePrice) => {
            // Create config with only readRequestsPerMonth
            const config: CostAnalyzerConfig = {
              usageAssumptions: {
                dynamodb: {
                  readRequestsPerMonth,
                  // writeRequestsPerMonth is intentionally omitted
                },
              },
            };

            const calculator = new DynamoDBCalculator(config);

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-ReadUnits')) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-WriteUnits')) {
                  return writePrice;
                }
                return null;
              }),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PAY_PER_REQUEST',
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Should use configured value for read and default for write (1,000,000)
            const defaultWriteRequests = 1_000_000;
            const expectedCost =
              (readRequestsPerMonth * readPrice) +
              (defaultWriteRequests * writePrice);

            expect(result.amount).toBeCloseTo(expectedCost, 5);

            // Verify assumptions include both values
            const readAssumption = result.assumptions.find(a => 
              a.includes(readRequestsPerMonth.toLocaleString()) && a.includes('read requests')
            );
            const writeAssumption = result.assumptions.find(a => 
              a.includes(defaultWriteRequests.toLocaleString()) && a.includes('write requests')
            );

            expect(readAssumption).toBeDefined();
            expect(writeAssumption).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not use dynamodb config for provisioned billing mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1_000, max: 100_000_000 }), // readRequestsPerMonth (should be ignored)
          fc.integer({ min: 1_000, max: 100_000_000 }), // writeRequestsPerMonth (should be ignored)
          fc.integer({ min: 1, max: 1000 }), // readCapacity
          fc.integer({ min: 1, max: 1000 }), // writeCapacity
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readRequestsPerMonth, writeRequestsPerMonth, readCapacity, writeCapacity, readPrice, writePrice) => {
            // Create config with dynamodb usage assumptions
            const config: CostAnalyzerConfig = {
              usageAssumptions: {
                dynamodb: {
                  readRequestsPerMonth,
                  writeRequestsPerMonth,
                },
              },
            };

            const calculator = new DynamoDBCalculator(config);

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value.includes('ReadCapacityUnit-Hrs'))) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value.includes('WriteCapacityUnit-Hrs'))) {
                  return writePrice;
                }
                return null;
              }),
            };

            // Create a provisioned resource
            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                  ReadCapacityUnits: readCapacity,
                  WriteCapacityUnits: writeCapacity,
                },
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // For provisioned mode, cost should be based on capacity units, not request counts
            const hoursPerMonth = 730;
            const expectedCost = 
              (readCapacity * hoursPerMonth * readPrice) + 
              (writeCapacity * hoursPerMonth * writePrice);

            expect(result.amount).toBeCloseTo(expectedCost, 5);

            // Verify assumptions do NOT include request counts
            const hasRequestAssumptions = result.assumptions.some(a => 
              a.includes('requests per month')
            );
            expect(hasRequestAssumptions).toBe(false);

            // Verify assumptions include capacity units instead
            const readCapacityAssumption = result.assumptions.find(a => 
              a.includes(`${readCapacity} provisioned read capacity units`)
            );
            const writeCapacityAssumption = result.assumptions.find(a => 
              a.includes(`${writeCapacity} provisioned write capacity units`)
            );

            expect(readCapacityAssumption).toBeDefined();
            expect(writeCapacityAssumption).toBeDefined();
            expect(result.confidence).toBe('high');
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 2: Pay-Per-Request Cost Calculation Formula', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * For any pay-per-request table with given usage assumptions and pricing data,
     * the calculated monthly cost should equal readRequests * readPricePerUnit +
     * writeRequests * writePricePerUnit (AWS returns price per individual request unit).
     */
    it('should calculate pay-per-request costs using the correct formula', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1_000, max: 100_000_000 }), // readRequests
          fc.integer({ min: 1_000, max: 100_000_000 }), // writeRequests
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readRequests, writeRequests, readPrice, writePrice) => {
            // Create config with specific usage assumptions
            const config: CostAnalyzerConfig = {
              usageAssumptions: {
                dynamodb: {
                  readRequestsPerMonth: readRequests,
                  writeRequestsPerMonth: writeRequests,
                },
              },
            };

            const calculator = new DynamoDBCalculator(config);

            // Mock pricing client to return our test prices
            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-ReadUnits')) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-WriteUnits')) {
                  return writePrice;
                }
                return null;
              }),
            };

            // Create a pay-per-request resource
            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PAY_PER_REQUEST',
              },
            };

            // Calculate cost
            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Calculate expected cost: requests * pricePerUnit
            // AWS Pricing API returns price per individual request unit
            const expectedCost =
              (readRequests * readPrice) +
              (writeRequests * writePrice);

            // Verify the calculated cost matches the expected formula
            expect(result.amount).toBeCloseTo(expectedCost, 5);
            expect(result.currency).toBe('USD');
            expect(result.confidence).toBe('medium');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Provisioned Cost Calculation Formula', () => {
    /**
     * **Validates: Requirements 3.6**
     * 
     * For any provisioned table with given capacity units and pricing data,
     * the calculated monthly cost should equal (readCapacity * 730 * readPrice) + 
     * (writeCapacity * 730 * writePrice).
     */
    it('should calculate provisioned costs using the correct formula', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // readCapacity
          fc.integer({ min: 1, max: 1000 }), // writeCapacity
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readCapacity, writeCapacity, readPrice, writePrice) => {
            const calculator = new DynamoDBCalculator();

            // Mock pricing client to return our test prices
            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value.includes('ReadCapacityUnit-Hrs'))) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value.includes('WriteCapacityUnit-Hrs'))) {
                  return writePrice;
                }
                return null;
              }),
            };

            // Create a provisioned resource
            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                  ReadCapacityUnits: readCapacity,
                  WriteCapacityUnits: writeCapacity,
                },
              },
            };

            // Calculate cost
            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Calculate expected cost using the formula from the design
            const hoursPerMonth = 730;
            const expectedCost = 
              (readCapacity * hoursPerMonth * readPrice) + 
              (writeCapacity * hoursPerMonth * writePrice);

            // Verify the calculated cost matches the expected formula
            expect(result.amount).toBeCloseTo(expectedCost, 5);
            expect(result.currency).toBe('USD');
            expect(result.confidence).toBe('high');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: Pay-Per-Request Assumptions Completeness', () => {
    /**
     * **Validates: Requirements 6.1, 6.2, 6.3, 6.7**
     *
     * For any pay-per-request table cost result, the assumptions array should contain:
     * - The number of read requests per month
     * - The number of write requests per month
     * - The text "On-demand billing mode"
     * - A disclaimer about excluded costs
     */
    it('should include all required assumptions for pay-per-request mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1_000, max: 100_000_000 }), // readRequests
          fc.integer({ min: 1_000, max: 100_000_000 }), // writeRequests
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readRequests, writeRequests, readPrice, writePrice) => {
            const config: CostAnalyzerConfig = {
              usageAssumptions: {
                dynamodb: {
                  readRequestsPerMonth: readRequests,
                  writeRequestsPerMonth: writeRequests,
                },
              },
            };

            const calculator = new DynamoDBCalculator(config);

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-ReadUnits')) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value === 'DDB-WriteUnits')) {
                  return writePrice;
                }
                return null;
              }),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PAY_PER_REQUEST',
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Verify all required assumptions are present
            const assumptions = result.assumptions;

            // Check for read requests assumption
            const hasReadRequests = assumptions.some(a => 
              a.includes(readRequests.toLocaleString()) && a.toLowerCase().includes('read requests')
            );
            expect(hasReadRequests).toBe(true);

            // Check for write requests assumption
            const hasWriteRequests = assumptions.some(a => 
              a.includes(writeRequests.toLocaleString()) && a.toLowerCase().includes('write requests')
            );
            expect(hasWriteRequests).toBe(true);

            // Check for billing mode indication
            const hasBillingMode = assumptions.some(a => 
              a.toLowerCase().includes('on-demand')
            );
            expect(hasBillingMode).toBe(true);

            // Check for disclaimer about excluded costs
            const hasDisclaimer = assumptions.some(a => 
              a.toLowerCase().includes('does not include') || 
              a.toLowerCase().includes('storage')
            );
            expect(hasDisclaimer).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: Provisioned Assumptions Completeness', () => {
    /**
     * **Validates: Requirements 6.4, 6.5, 6.6, 6.7**
     * 
     * For any provisioned table cost result, the assumptions array should contain:
     * - The provisioned read capacity units
     * - The provisioned write capacity units
     * - The text "Provisioned billing mode"
     * - A disclaimer about excluded costs
     */
    it('should include all required assumptions for provisioned mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // readCapacity
          fc.integer({ min: 1, max: 1000 }), // writeCapacity
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // readPrice
          fc.double({ min: 0.00001, max: 1.0, noNaN: true }), // writePrice
          async (readCapacity, writeCapacity, readPrice, writePrice) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockImplementation(async (query) => {
                if (query.filters.some((f: PriceFilter) => f.value.includes('ReadCapacityUnit-Hrs'))) {
                  return readPrice;
                }
                if (query.filters.some((f: PriceFilter) => f.value.includes('WriteCapacityUnit-Hrs'))) {
                  return writePrice;
                }
                return null;
              }),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: 'PROVISIONED',
                ProvisionedThroughput: {
                  ReadCapacityUnits: readCapacity,
                  WriteCapacityUnits: writeCapacity,
                },
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Verify all required assumptions are present
            const assumptions = result.assumptions;

            // Check for read capacity assumption
            const hasReadCapacity = assumptions.some(a => 
              a.includes(`${readCapacity}`) && a.toLowerCase().includes('read capacity')
            );
            expect(hasReadCapacity).toBe(true);

            // Check for write capacity assumption
            const hasWriteCapacity = assumptions.some(a => 
              a.includes(`${writeCapacity}`) && a.toLowerCase().includes('write capacity')
            );
            expect(hasWriteCapacity).toBe(true);

            // Check for billing mode indication
            const hasBillingMode = assumptions.some(a => 
              a.toLowerCase().includes('provisioned')
            );
            expect(hasBillingMode).toBe(true);

            // Check for disclaimer about excluded costs
            const hasDisclaimer = assumptions.some(a => 
              a.toLowerCase().includes('does not include') || 
              a.toLowerCase().includes('storage')
            );
            expect(hasDisclaimer).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: Error Handling Returns Zero Cost', () => {
    /**
     * **Validates: Requirements 7.1, 7.3**
     * 
     * For any pricing query that fails (returns null or throws an error),
     * the calculator should return a cost of $0.00 with confidence "unknown".
     */
    it('should return zero cost with unknown confidence when pricing returns null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PAY_PER_REQUEST', 'PROVISIONED'), // billingMode
          async (billingMode) => {
            const calculator = new DynamoDBCalculator();

            // Mock pricing client to return null
            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockResolvedValue(null),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: billingMode,
                ...(billingMode === 'PROVISIONED' ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5,
                  },
                } : {}),
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(result.amount).toBe(0);
            expect(result.currency).toBe('USD');
            expect(result.confidence).toBe('unknown');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return zero cost with unknown confidence when pricing throws error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PAY_PER_REQUEST', 'PROVISIONED'), // billingMode
          fc.string({ minLength: 5, maxLength: 50 }), // error message
          async (billingMode, errorMessage) => {
            const calculator = new DynamoDBCalculator();

            // Mock pricing client to throw error
            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockRejectedValue(new Error(errorMessage)),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: billingMode,
                ...(billingMode === 'PROVISIONED' ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5,
                  },
                } : {}),
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            expect(result.amount).toBe(0);
            expect(result.currency).toBe('USD');
            expect(result.confidence).toBe('unknown');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 12: Error Handling Includes Explanation', () => {
    /**
     * **Validates: Requirements 7.2, 7.4**
     * 
     * For any pricing query that fails, the calculator should include an assumption
     * explaining that pricing data is not available or containing the error message.
     */
    it('should include explanation when pricing returns null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PAY_PER_REQUEST', 'PROVISIONED'), // billingMode
          async (billingMode) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockResolvedValue(null),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: billingMode,
                ...(billingMode === 'PROVISIONED' ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5,
                  },
                } : {}),
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Should include explanation about pricing not available
            const hasExplanation = result.assumptions.some(a => 
              a.toLowerCase().includes('pricing data not available') ||
              a.toLowerCase().includes('not available')
            );
            expect(hasExplanation).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include error message when pricing throws error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PAY_PER_REQUEST', 'PROVISIONED'), // billingMode
          fc.string({ minLength: 5, maxLength: 50 }), // error message
          async (billingMode, errorMessage) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: jest.fn().mockRejectedValue(new Error(errorMessage)),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: billingMode,
                ...(billingMode === 'PROVISIONED' ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5,
                  },
                } : {}),
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Should include the error message
            const hasErrorMessage = result.assumptions.some(a => 
              a.includes(errorMessage) || a.toLowerCase().includes('failed to fetch')
            );
            expect(hasErrorMessage).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Error Handling Preserves Billing Mode', () => {
    /**
     * **Validates: Requirements 7.5**
     * 
     * For any table where pricing data is unavailable, the assumptions should
     * still indicate the detected billing mode.
     */
    it('should preserve billing mode in assumptions when pricing fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PAY_PER_REQUEST', 'PROVISIONED'), // billingMode
          fc.boolean(), // whether to return null or throw error
          async (billingMode, shouldThrow) => {
            const calculator = new DynamoDBCalculator();

            const mockPricingClient: PricingClient = {
              getPrice: shouldThrow 
                ? jest.fn().mockRejectedValue(new Error('API Error'))
                : jest.fn().mockResolvedValue(null),
            };

            const resource = {
              logicalId: 'TestTable',
              type: 'AWS::DynamoDB::Table',
              properties: {
                BillingMode: billingMode,
                ...(billingMode === 'PROVISIONED' ? {
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 5,
                  },
                } : {}),
              },
            };

            const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

            // Should indicate the billing mode
            const expectedMode = billingMode === 'PAY_PER_REQUEST' ? 'on-demand' : 'provisioned';
            const hasBillingMode = result.assumptions.some(a => 
              a.toLowerCase().includes(expectedMode)
            );
            expect(hasBillingMode).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
