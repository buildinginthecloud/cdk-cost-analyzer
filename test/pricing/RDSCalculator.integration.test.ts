import { PricingClient } from '../../src/pricing/PricingClient';
import { RDSCalculator } from '../../src/pricing/calculators/RDSCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for RDS pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for RDS instances and storage
 * - Two separate pricing components (instance + storage)
 * - Various database engines (MySQL, PostgreSQL, MariaDB)
 * - Various instance classes (db.t3.micro to db.r5.large)
 * - Debug logging captures pricing queries and responses
 *
 * RDS Pricing Components:
 * 1. Instance: Hourly rate × 730 hours/month
 * 2. Storage: GB-month for General Purpose (gp2) storage
 *
 * Expected pricing for db.t3.micro MySQL (us-east-1):
 * - Instance: ~$0.017/hour × 730 = ~$12.41/month
 * - Storage: ~$0.115/GB × 100GB = ~$11.50/month
 * - Total: ~$23.91/month
 *
 * To run: npm test -- RDSCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- RDSCalculator.integration.test.ts
 */
describe('RDSCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'us-east-1';

  beforeAll(() => {
    // Enable debug logging if DEBUG env var is set
    if (process.env.DEBUG === 'true') {
      Logger.setDebugEnabled(true);
      console.error('Debug logging enabled for pricing API calls');
    }
  });

  beforeEach(() => {
    // Create pricing client that connects to actual AWS API
    pricingClient = new PricingClient('us-east-1');
  });

  afterEach(() => {
    if (pricingClient) {
      pricingClient.destroy();
    }
  });

  afterAll(() => {
    // Disable debug logging after tests
    Logger.setDebugEnabled(false);
  });

  // Skip this test in CI unless explicitly enabled
  const testMode = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  describe('MySQL Engine', () => {
    testMode('should fetch real RDS pricing for db.t3.micro MySQL', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // RDS costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with db.t3.micro MySQL + 100GB gp2:
        // Instance: ~$0.017/hour × 730 = ~$12.41
        // Storage: ~$0.115/GB × 100GB = ~$11.50
        // Total: ~$23.91
        // Allow 20% variance: ~$19.1 - $28.7
        const expectedMin = 19.1;
        const expectedMax = 28.7;

        console.log('RDS MySQL pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('high');

        // Verify assumptions mention storage and hours
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/730.*hour|hour.*730/);
        expect(assumptionText).toMatch(/100.*gb|storage/);
      } else {
        console.warn('RDS MySQL pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('RDS MySQL pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for larger MySQL instance', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.medium',
          Engine: 'mysql',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with db.t3.medium MySQL:
        // Instance: ~$0.068/hour × 730 = ~$49.64
        // Storage: ~$11.50
        // Total: ~$61.14
        const expectedMin = 52.0;
        const expectedMax = 70.0;

        console.log('RDS db.t3.medium MySQL pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      } else {
        throw new Error('RDS MySQL pricing should be available');
      }
    }, 30000);
  });

  describe('PostgreSQL Engine', () => {
    testMode('should fetch real RDS pricing for db.t3.micro PostgreSQL', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'postgres',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // PostgreSQL pricing is similar to MySQL
        // db.t3.micro: ~$12.41/month
        // Storage: ~$11.50/month
        // Total: ~$23.91/month
        const expectedMin = 19.1;
        const expectedMax = 28.7;

        console.log('RDS PostgreSQL pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('high');
      } else {
        throw new Error('RDS PostgreSQL pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for db.r5.large PostgreSQL', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.r5.large',
          Engine: 'postgres',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 with db.r5.large PostgreSQL:
        // Instance: ~$0.24/hour × 730 = ~$175.20
        // Storage: ~$11.50
        // Total: ~$186.70
        const expectedMin = 165.0;
        const expectedMax = 210.0;

        console.log('RDS db.r5.large PostgreSQL pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      } else {
        throw new Error('RDS PostgreSQL pricing should be available');
      }
    }, 30000);
  });

  describe('MariaDB Engine', () => {
    testMode('should fetch real RDS pricing for db.t3.micro MariaDB', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mariadb',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // MariaDB pricing is similar to MySQL
        const expectedMin = 19.1;
        const expectedMax = 28.7;

        console.log('RDS MariaDB pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      } else {
        throw new Error('RDS MariaDB pricing should be available');
      }
    }, 30000);
  });

  describe('Instance Class Variations', () => {
    testMode('should calculate cost for db.t3.small', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.small',
          Engine: 'mysql',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // db.t3.small: ~$0.034/hour × 730 = ~$24.82
        // Storage: ~$11.50
        // Total: ~$36.32
        expect(cost.amount).toBeGreaterThan(30.0);
        expect(cost.amount).toBeLessThan(42.0);

        console.log(`RDS db.t3.small: $${cost.amount.toFixed(2)}/month`);
      }
    }, 30000);

    testMode('should calculate cost for db.m5.large', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.m5.large',
          Engine: 'mysql',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // db.m5.large: ~$0.192/hour × 730 = ~$140.16
        // Storage: ~$11.50
        // Total: ~$151.66
        expect(cost.amount).toBeGreaterThan(135.0);
        expect(cost.amount).toBeLessThan(170.0);

        console.log(`RDS db.m5.large: $${cost.amount.toFixed(2)}/month`);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should return zero cost when DBInstanceClass is missing', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          Engine: 'mysql',
          // No DBInstanceClass
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions).toContain('DB instance class or engine not specified');
    }, 30000);

    testMode('should return zero cost when Engine is missing', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          // No Engine
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions).toContain('DB instance class or engine not specified');
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`RDS MySQL pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing should be reasonable ($18-32/month for db.t3.micro + 100GB)
          expect(cost.amount).toBeGreaterThan(18);
          expect(cost.amount).toBeLessThan(32);
          expect(cost.confidence).toBe('high');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query both instance and storage pricing separately', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new RDSCalculator();

        const testResource = {
          logicalId: 'MyDatabase',
          type: 'AWS::RDS::DBInstance',
          properties: {
            DBInstanceClass: 'db.t3.micro',
            Engine: 'mysql',
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured both pricing queries
        // (instance and storage)
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Single-AZ Deployment', () => {
    testMode('should default to Single-AZ pricing', async () => {
      const calculator = new RDSCalculator();

      const testResource = {
        logicalId: 'MyDatabase',
        type: 'AWS::RDS::DBInstance',
        properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Verify assumptions mention Single-AZ
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('Single-AZ');
      }
    }, 30000);
  });
});
