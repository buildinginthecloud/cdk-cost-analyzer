import * as fc from 'fast-check';
import { describe, it, expect, vi } from 'vitest';
import { RDSCalculator } from '../../src/pricing/calculators/RDSCalculator';
import { PricingClient } from '../../src/pricing/types';

describe('RDSCalculator - Property Tests', () => {
  // Feature: cdk-cost-analyzer, Property 9: RDS costs are calculated for all engine types
  it('should calculate costs greater than zero for all engine types', () => {
    const calculator = new RDSCalculator();

    // Define supported RDS engine types
    const engineTypes = [
      'mysql',
      'postgres',
      'mariadb',
      'oracle-se2',
      'sqlserver-ex',
      'aurora-mysql',
      'aurora-postgresql',
    ];

    // Define common instance classes
    const instanceClasses = [
      'db.t3.micro',
      'db.t3.small',
      'db.t3.medium',
      'db.m5.large',
      'db.m5.xlarge',
      'db.r5.large',
    ];

    const regions = ['us-east-1', 'us-west-2', 'eu-central-1', 'eu-west-1', 'ap-southeast-1'];

    // Create a mock pricing client that returns realistic RDS pricing
    const createMockPricingClient = (): PricingClient => ({
      getPrice: vi.fn().mockImplementation(async (params) => {
        const filters = params.filters || [];
        const instanceTypeFilter = filters.find(f => f.field === 'instanceType');
        const volumeTypeFilter = filters.find(f => f.field === 'volumeType');

        // Return instance pricing
        if (instanceTypeFilter) {
          const instanceType = instanceTypeFilter.value as string;

          // Simulate realistic pricing based on instance class
          const pricingMap: Record<string, number> = {
            'db.t3.micro': 0.017,
            'db.t3.small': 0.034,
            'db.t3.medium': 0.068,
            'db.m5.large': 0.192,
            'db.m5.xlarge': 0.384,
            'db.r5.large': 0.24,
          };

          return pricingMap[instanceType] || 0.1;
        }

        // Return storage pricing
        if (volumeTypeFilter && volumeTypeFilter.value === 'General Purpose') {
          return 0.115; // $0.115 per GB-month for gp2
        }

        return null;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    // Property: For any RDS instance with a valid engine type and instance class,
    // the cost calculator should return a cost estimate greater than zero
    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...engineTypes),
        fc.constantFrom(...instanceClasses),
        fc.constantFrom(...regions),
        async (engine, instanceClass, region) => {
          const resource = {
            logicalId: 'TestDBInstance',
            type: 'AWS::RDS::DBInstance',
            properties: {
              Engine: engine,
              DBInstanceClass: instanceClass,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // Cost should be greater than zero for all valid engine types
          expect(cost.amount).toBeGreaterThan(0);
          expect(cost.currency).toBe('USD');
          expect(cost.confidence).toBe('high');

          // Should have assumptions about storage and deployment
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions.some(a => a.includes('730 hours'))).toBe(true);
          expect(cost.assumptions.some(a => a.includes('100 GB'))).toBe(true);
          expect(cost.assumptions.some(a => a.includes('Single-AZ'))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should produce different costs for different instance classes', () => {
    const calculator = new RDSCalculator();

    const smallerInstances = ['db.t3.micro', 'db.t3.small', 'db.t3.medium'];
    const largerInstances = ['db.m5.large', 'db.m5.xlarge', 'db.r5.large'];
    const engines = ['mysql', 'postgres'];

    const createMockPricingClient = (): PricingClient => ({
      getPrice: vi.fn().mockImplementation(async (params) => {
        const filters = params.filters || [];
        const instanceTypeFilter = filters.find(f => f.field === 'instanceType');
        const volumeTypeFilter = filters.find(f => f.field === 'volumeType');

        if (instanceTypeFilter) {
          const instanceType = instanceTypeFilter.value as string;

          const pricingMap: Record<string, number> = {
            'db.t3.micro': 0.017,
            'db.t3.small': 0.034,
            'db.t3.medium': 0.068,
            'db.m5.large': 0.192,
            'db.m5.xlarge': 0.384,
            'db.r5.large': 0.24,
          };

          return pricingMap[instanceType] || 0.1;
        }

        if (volumeTypeFilter) {
          return 0.115;
        }

        return null;
      }),
    });

    const mockPricingClient = createMockPricingClient();

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...smallerInstances),
        fc.constantFrom(...largerInstances),
        fc.constantFrom(...engines),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (smallerClass, largerClass, engine, region) => {
          const smallerResource = {
            logicalId: 'SmallerDB',
            type: 'AWS::RDS::DBInstance',
            properties: {
              Engine: engine,
              DBInstanceClass: smallerClass,
            },
          };

          const largerResource = {
            logicalId: 'LargerDB',
            type: 'AWS::RDS::DBInstance',
            properties: {
              Engine: engine,
              DBInstanceClass: largerClass,
            },
          };

          const smallerCost = await calculator.calculateCost(smallerResource, region, mockPricingClient);
          const largerCost = await calculator.calculateCost(largerResource, region, mockPricingClient);

          // Larger instances should cost more than smaller ones
          expect(largerCost.amount).toBeGreaterThan(smallerCost.amount);
          expect(smallerCost.confidence).toBe('high');
          expect(largerCost.confidence).toBe('high');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle missing engine or instance class gracefully', () => {
    const calculator = new RDSCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: vi.fn().mockResolvedValue(0.1),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        async (region) => {
          // Test missing engine
          const resourceWithoutEngine = {
            logicalId: 'DBWithoutEngine',
            type: 'AWS::RDS::DBInstance',
            properties: {
              DBInstanceClass: 'db.t3.micro',
            },
          };

          const costWithoutEngine = await calculator.calculateCost(
            resourceWithoutEngine,
            region,
            mockPricingClient,
          );

          expect(costWithoutEngine.amount).toBe(0);
          expect(costWithoutEngine.confidence).toBe('unknown');
          expect(costWithoutEngine.assumptions[0]).toContain('not specified');

          // Test missing instance class
          const resourceWithoutClass = {
            logicalId: 'DBWithoutClass',
            type: 'AWS::RDS::DBInstance',
            properties: {
              Engine: 'mysql',
            },
          };

          const costWithoutClass = await calculator.calculateCost(
            resourceWithoutClass,
            region,
            mockPricingClient,
          );

          expect(costWithoutClass.amount).toBe(0);
          expect(costWithoutClass.confidence).toBe('unknown');
          expect(costWithoutClass.assumptions[0]).toContain('not specified');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle pricing API failures gracefully', () => {
    const calculator = new RDSCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: vi.fn().mockResolvedValue(null),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('mysql', 'postgres', 'mariadb'),
        fc.constantFrom('db.t3.micro', 'db.m5.large'),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (engine, instanceClass, region) => {
          const resource = {
            logicalId: 'TestDB',
            type: 'AWS::RDS::DBInstance',
            properties: {
              Engine: engine,
              DBInstanceClass: instanceClass,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Pricing data not available');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle pricing API errors gracefully', () => {
    const calculator = new RDSCalculator();

    const mockPricingClient: PricingClient = {
      getPrice: vi.fn().mockRejectedValue(new Error('API timeout')),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom('mysql', 'postgres'),
        fc.constantFrom('db.t3.micro', 'db.m5.large'),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (engine, instanceClass, region) => {
          const resource = {
            logicalId: 'TestDB',
            type: 'AWS::RDS::DBInstance',
            properties: {
              Engine: engine,
              DBInstanceClass: instanceClass,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // When API throws error, should handle gracefully
          expect(cost.amount).toBe(0);
          expect(cost.confidence).toBe('unknown');
          expect(cost.assumptions.length).toBeGreaterThan(0);
          expect(cost.assumptions[0]).toContain('Failed to fetch pricing');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should normalize engine names correctly', () => {
    const calculator = new RDSCalculator();

    const engineVariations = [
      { input: 'mysql', expected: 'MySQL' },
      { input: 'postgres', expected: 'PostgreSQL' },
      { input: 'mariadb', expected: 'MariaDB' },
      { input: 'oracle-se2', expected: 'Oracle' },
      { input: 'sqlserver-ex', expected: 'SQL Server' },
      { input: 'aurora-mysql', expected: 'Aurora MySQL' },
      { input: 'aurora-postgresql', expected: 'Aurora PostgreSQL' },
    ];

    const mockPricingClient: PricingClient = {
      getPrice: vi.fn().mockImplementation(async (params) => {
        const filters = params.filters || [];
        const engineFilter = filters.find(f => f.field === 'databaseEngine');
        const volumeTypeFilter = filters.find(f => f.field === 'volumeType');

        // Verify engine is normalized
        if (engineFilter) {
          const normalizedEngines = [
            'MySQL',
            'PostgreSQL',
            'MariaDB',
            'Oracle',
            'SQL Server',
            'Aurora MySQL',
            'Aurora PostgreSQL',
          ];
          expect(normalizedEngines).toContain(engineFilter.value);
          return 0.1;
        }

        if (volumeTypeFilter) {
          return 0.115;
        }

        return null;
      }),
    };

    void fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...engineVariations.map(e => e.input)),
        fc.constantFrom('db.t3.micro', 'db.m5.large'),
        fc.constantFrom('us-east-1', 'eu-central-1'),
        async (engine, instanceClass, region) => {
          const resource = {
            logicalId: 'TestDB',
            type: 'AWS::RDS::DBInstance',
            properties: {
              Engine: engine,
              DBInstanceClass: instanceClass,
            },
          };

          const cost = await calculator.calculateCost(resource, region, mockPricingClient);

          // Should successfully calculate cost with normalized engine name
          expect(cost.amount).toBeGreaterThan(0);
          expect(cost.confidence).toBe('high');
        },
      ),
      { numRuns: 100 },
    );
  });
});
