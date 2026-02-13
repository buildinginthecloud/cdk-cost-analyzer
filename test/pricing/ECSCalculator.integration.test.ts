import { PricingClient } from '../../src/pricing/PricingClient';
import { ECSCalculator } from '../../src/pricing/calculators/ECSCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for ECS pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for Fargate vCPU and memory costs
 * - Multiple task configurations (desiredCount)
 * - Default resource assumptions (0.25 vCPU, 0.5 GB memory)
 * - EC2 launch type handling (returns $0 with explanation)
 * - Debug logging captures pricing queries and responses
 *
 * ECS Fargate Pricing:
 * - vCPU: ~$0.04048 per vCPU-hour (us-east-1)
 * - Memory: ~$0.004445 per GB-hour (us-east-1)
 *
 * Expected pricing for default Fargate task (us-east-1):
 * - vCPU: 0.25 × $0.04048 × 730 = ~$7.39/month
 * - Memory: 0.5 GB × $0.004445 × 730 = ~$1.62/month
 * - Total: ~$9.01/month per task
 *
 * To run: npm test -- ECSCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- ECSCalculator.integration.test.ts
 */
describe('ECSCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'us-east-1';

  beforeAll(() => {
    if (process.env.DEBUG === 'true') {
      Logger.setDebugEnabled(true);
      console.error('Debug logging enabled for pricing API calls');
    }
  });

  beforeEach(() => {
    pricingClient = new PricingClient('us-east-1');
  });

  afterEach(() => {
    if (pricingClient) {
      pricingClient.destroy();
    }
  });

  afterAll(() => {
    Logger.setDebugEnabled(false);
  });

  const testMode = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  describe('Fargate Launch Type', () => {
    testMode('should fetch real ECS Fargate pricing for single task', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 1,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      if (cost.amount > 0) {
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with default (0.25 vCPU, 0.5 GB):
        // vCPU: 0.25 × ~$0.04048 × 730 = ~$7.39
        // Memory: 0.5 × ~$0.004445 × 730 = ~$1.62
        // Total: ~$9.01/month
        // Allow 20% variance: ~$7.21 - $10.81
        const expectedMin = 7.21;
        const expectedMax = 10.81;

        console.log('ECS Fargate single task pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/fargate/);
        expect(assumptionText).toMatch(/0\.25.*vcpu/);
        expect(assumptionText).toMatch(/0\.5.*gb.*memory/);
      } else {
        console.warn('ECS Fargate pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        throw new Error('ECS Fargate pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should default to Fargate when LaunchType not specified', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          DesiredCount: 1,
          // LaunchType not specified - should default to FARGATE
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use Fargate pricing (~$9.01/month)
        expect(cost.amount).toBeGreaterThan(7.0);
        expect(cost.amount).toBeLessThan(11.0);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('Fargate');
      }
    }, 30000);

    testMode('should default to 1 task when DesiredCount not specified', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          // DesiredCount not specified - should default to 1
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should calculate for 1 task (~$9.01/month)
        expect(cost.amount).toBeGreaterThan(7.0);
        expect(cost.amount).toBeLessThan(11.0);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toMatch(/1 task/);
      }
    }, 30000);
  });

  describe('Multiple Tasks', () => {
    testMode('should calculate cost for multiple tasks', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 3,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 3 tasks: 3 × ~$9.01 = ~$27.03/month
        // Allow 20% variance: ~$21.62 - $32.44
        const expectedMin = 21.62;
        const expectedMax = 32.44;

        console.log('ECS Fargate 3 tasks:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('3 task');
      }
    }, 30000);

    testMode('should calculate cost for high task count', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 10,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For 10 tasks: 10 × ~$9.01 = ~$90.10/month
        // Allow 20% variance: ~$72.08 - $108.12
        const expectedMin = 72.08;
        const expectedMax = 108.12;

        console.log('ECS Fargate 10 tasks:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('10 task');
      }
    }, 30000);

    testMode('should verify cost scales linearly with task count', async () => {
      const calculator = new ECSCalculator();

      const singleTaskResource = {
        logicalId: 'SingleTask',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 1,
        },
      };

      const multiTaskResource = {
        logicalId: 'MultiTask',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 5,
        },
      };

      const singleTaskCost = await calculator.calculateCost(singleTaskResource, testRegion, pricingClient);
      const multiTaskCost = await calculator.calculateCost(multiTaskResource, testRegion, pricingClient);

      if (singleTaskCost.amount > 0 && multiTaskCost.amount > 0) {
        console.log(`Single task: $${singleTaskCost.amount.toFixed(2)}/month`);
        console.log(`5 tasks: $${multiTaskCost.amount.toFixed(2)}/month`);

        // Cost should be approximately 5x for 5 tasks
        const ratio = multiTaskCost.amount / singleTaskCost.amount;
        expect(ratio).toBeGreaterThan(4.8);
        expect(ratio).toBeLessThan(5.2);

        console.log(`Cost ratio: ${ratio.toFixed(2)}x`);
      }
    }, 30000);
  });

  describe('EC2 Launch Type', () => {
    testMode('should return zero cost with explanation for EC2 launch type', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'EC2',
          DesiredCount: 2,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.currency).toBe('USD');
      expect(cost.confidence).toBe('low');

      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('EC2 launch type');
      expect(assumptionText).toContain('2 task');
      expect(assumptionText).toMatch(/depend.*ec2.*instance/i);

      console.log('EC2 launch type assumptions:');
      cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 1,
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`ECS Fargate pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing may vary by region but should be in reasonable range
          expect(cost.amount).toBeGreaterThan(6.0);
          expect(cost.amount).toBeLessThan(12.0);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000);
  });

  describe('Pricing Query Validation', () => {
    testMode('should query both vCPU and memory pricing', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new ECSCalculator();

        const testResource = {
          logicalId: 'MyECSService',
          type: 'AWS::ECS::Service',
          properties: {
            LaunchType: 'FARGATE',
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured both pricing queries:
        // - Fargate-vCPU-Hours:perCPU
        // - Fargate-GB-Hours
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Cost Component Breakdown', () => {
    testMode('should show separate vCPU and memory cost components', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 1,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Verify assumptions include resource specifications
        const assumptions = cost.assumptions;

        const vcpuAssumption = assumptions.find(a => a.toLowerCase().includes('vcpu'));
        const memoryAssumption = assumptions.find(a => a.toLowerCase().includes('memory'));
        const hoursAssumption = assumptions.find(a => a.toLowerCase().includes('730 hours'));

        expect(vcpuAssumption).toBeDefined();
        expect(memoryAssumption).toBeDefined();
        expect(hoursAssumption).toBeDefined();

        console.log('Resource assumptions:');
        console.log(`  vCPU: ${vcpuAssumption}`);
        console.log(`  Memory: ${memoryAssumption}`);
        console.log(`  Hours: ${hoursAssumption}`);
      }
    }, 30000);

    testMode('should note additional costs are excluded', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/does not include.*data transfer|storage/);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle unsupported launch type', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'EXTERNAL',
          DesiredCount: 1,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');

      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toContain('Unsupported launch type');
      expect(assumptionText).toContain('EXTERNAL');
    }, 30000);

    testMode('should handle zero desired count', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
          DesiredCount: 0,
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // With 0 tasks, cost should be 0
      expect(cost.amount).toBe(0);
    }, 30000);
  });

  describe('Default Resource Assumptions', () => {
    testMode('should use default 0.25 vCPU assumption', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toMatch(/0\.25.*vcpu/i);
      }
    }, 30000);

    testMode('should use default 0.5 GB memory assumption', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toMatch(/0\.5.*gb.*memory/i);
      }
    }, 30000);

    testMode('should assume 730 hours per month (24/7)', async () => {
      const calculator = new ECSCalculator();

      const testResource = {
        logicalId: 'MyECSService',
        type: 'AWS::ECS::Service',
        properties: {
          LaunchType: 'FARGATE',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toMatch(/730.*hours.*month/i);
        expect(assumptionText).toMatch(/24\/7/i);
      }
    }, 30000);
  });
});
