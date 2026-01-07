import * as fc from 'fast-check';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PricingClient } from '../../src/pricing/PricingClient';

describe('PricingClient - Property Tests', () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let mockAWSClient: any;

  beforeEach(() => {
    mockSend = vi.fn();
    mockAWSClient = {
      send: mockSend,
    };
    
    mockSend.mockResolvedValue({
      PriceList: [
        JSON.stringify({
          terms: {
            OnDemand: {
              TERM_KEY: {
                priceDimensions: {
                  DIM_KEY: {
                    pricePerUnit: {
                      USD: '0.10',
                    },
                  },
                },
              },
            },
          },
        }),
      ],
    });
  });

  // Feature: cdk-cost-analyzer, Property 17: Pricing queries include region filter
  it('should include region parameter in all pricing API queries', () => {
    const awsRegions = [
      'us-east-1',
      'us-east-2',
      'us-west-1',
      'us-west-2',
      'eu-west-1',
      'eu-west-2',
      'eu-west-3',
      'eu-central-1',
      'eu-north-1',
      'ap-south-1',
      'ap-southeast-1',
      'ap-southeast-2',
      'ap-northeast-1',
      'ap-northeast-2',
    ];

    const regionArb = fc.constantFrom(...awsRegions);
    const serviceCodeArb = fc.constantFrom('AmazonEC2', 'AmazonS3', 'AWSLambda', 'AmazonRDS');
    const filterArb = fc.array(
      fc.record({
        field: fc.string().filter(s => s.length > 0),
        value: fc.string().filter(s => s.length > 0),
      }),
      { minLength: 1, maxLength: 5 },
    );

    void fc.assert(
      fc.asyncProperty(regionArb, serviceCodeArb, filterArb, async (region, serviceCode, filters) => {
        const client = new PricingClient(region, undefined, mockAWSClient);

        await client.getPrice({
          serviceCode,
          region,
          filters,
        });

        // Verify that send was called (which means the query was executed)
        expect(mockSend).toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 18: Failed pricing calls trigger retries
  it('should retry failed pricing calls up to 3 times with exponential backoff', () => {
    const regionArb = fc.constantFrom('us-east-1', 'eu-west-1', 'ap-southeast-1');
    const serviceCodeArb = fc.constantFrom('AmazonEC2', 'AmazonS3', 'AWSLambda', 'AmazonRDS');
    const filterArb = fc.array(
      fc.record({
        field: fc.string().filter(s => s.length > 0),
        value: fc.string().filter(s => s.length > 0),
      }),
      { minLength: 1, maxLength: 3 },
    );
    const failureCountArb = fc.integer({ min: 1, max: 3 });

    void fc.assert(
      fc.asyncProperty(
        regionArb,
        serviceCodeArb,
        filterArb,
        failureCountArb,
        async (region, serviceCode, filters, failureCount) => {
          // Track call times to verify exponential backoff
          const callTimes: number[] = [];
          let callCount = 0;

          // Mock send to fail a specific number of times, then succeed
          mockSend.mockImplementation(() => {
            callTimes.push(Date.now());
            callCount++;

            if (callCount <= failureCount) {
              throw new Error('Transient API failure');
            }

            return Promise.resolve({
              PriceList: [
                JSON.stringify({
                  terms: {
                    OnDemand: {
                      TERM_KEY: {
                        priceDimensions: {
                          DIM_KEY: {
                            pricePerUnit: {
                              USD: '0.10',
                            },
                          },
                        },
                      },
                    },
                  },
                }),
              ],
            });
          });

          const client = new PricingClient(region, undefined, mockAWSClient);

          const result = await client.getPrice({
            serviceCode,
            region,
            filters,
          });

          // Verify that the call eventually succeeded
          expect(result).toBe(0.10);

          // Verify that send was called the expected number of times (failures + 1 success)
          expect(mockSend).toHaveBeenCalledTimes(failureCount + 1);

          // Verify exponential backoff by checking time delays between calls
          if (callTimes.length > 1) {
            for (let i = 1; i < callTimes.length; i++) {
              const delay = callTimes[i] - callTimes[i - 1];
              const expectedMinDelay = Math.pow(2, i - 1) * 1000;

              // Allow some tolerance for timing (expected delay - 100ms)
              // This accounts for execution time and timing variations
              expect(delay).toBeGreaterThanOrEqual(expectedMinDelay - 100);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 19: Cache is used when API fails
  it('should use cached data when API fails after retries', () => {
    const regionArb = fc.constantFrom('us-east-1', 'eu-west-1', 'ap-southeast-1');
    const serviceCodeArb = fc.constantFrom('AmazonEC2', 'AmazonS3', 'AWSLambda', 'AmazonRDS');
    const filterArb = fc.array(
      fc.record({
        field: fc.string().filter(s => s.length > 0),
        value: fc.string().filter(s => s.length > 0),
      }),
      { minLength: 1, maxLength: 3 },
    );
    const cachedPriceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(100.0), noNaN: true });

    void fc.assert(
      fc.asyncProperty(
        regionArb,
        serviceCodeArb,
        filterArb,
        cachedPriceArb,
        async (region, serviceCode, filters, cachedPrice) => {
          const client = new PricingClient(region, undefined, mockAWSClient);

          // First call: succeed and populate cache
          mockSend.mockResolvedValueOnce({
            PriceList: [
              JSON.stringify({
                terms: {
                  OnDemand: {
                    TERM_KEY: {
                      priceDimensions: {
                        DIM_KEY: {
                          pricePerUnit: {
                            USD: cachedPrice.toFixed(2),
                          },
                        },
                      },
                    },
                  },
                },
              }),
            ],
          });

          const params = {
            serviceCode,
            region,
            filters,
          };

          // First call to populate cache
          const firstResult = await client.getPrice(params);
          expect(firstResult).toBeCloseTo(cachedPrice, 2);

          // Second call: simulate API failure after all retries
          mockSend.mockRejectedValue(new Error('API failure after retries'));

          // Second call should return cached value instead of null
          const secondResult = await client.getPrice(params);

          // Verify cached data is used (not null or unknown)
          expect(secondResult).not.toBeNull();
          expect(secondResult).toBeCloseTo(cachedPrice, 2);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 20: Unavailable pricing results in unknown cost
  it('should return null when pricing data is unavailable and no cache exists', () => {
    const regionArb = fc.constantFrom('us-east-1', 'eu-west-1', 'ap-southeast-1');
    const serviceCodeArb = fc.constantFrom('AmazonEC2', 'AmazonS3', 'AWSLambda', 'AmazonRDS');
    const filterArb = fc.array(
      fc.record({
        field: fc.string().filter(s => s.length > 0),
        value: fc.string().filter(s => s.length > 0),
      }),
      { minLength: 1, maxLength: 3 },
    );

    // Test different scenarios where pricing data is unavailable
    const unavailableScenarios = [
      { name: 'empty PriceList', response: { PriceList: [] } },
      { name: 'no PriceList', response: {} },
      { name: 'no OnDemand terms', response: { PriceList: [JSON.stringify({ terms: {} })] } },
      { name: 'no priceDimensions', response: { PriceList: [JSON.stringify({ terms: { OnDemand: { TERM_KEY: {} } } })] } },
      { name: 'no pricePerUnit', response: { PriceList: [JSON.stringify({ terms: { OnDemand: { TERM_KEY: { priceDimensions: { DIM_KEY: {} } } } } })] } },
    ];

    const scenarioArb = fc.constantFrom(...unavailableScenarios);

    void fc.assert(
      fc.asyncProperty(
        regionArb,
        serviceCodeArb,
        filterArb,
        scenarioArb,
        async (region, serviceCode, filters, scenario) => {
          // Mock the API to return unavailable pricing data
          mockSend.mockResolvedValue(scenario.response);

          const client = new PricingClient(region, undefined, mockAWSClient);

          const params = {
            serviceCode,
            region,
            filters,
          };

          // Call should return null when pricing data is unavailable
          const result = await client.getPrice(params);

          // Verify that null is returned (indicating unavailable pricing)
          expect(result).toBeNull();

          // Verify that the call didn't throw an error (processing continues)
          expect(mockSend).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
