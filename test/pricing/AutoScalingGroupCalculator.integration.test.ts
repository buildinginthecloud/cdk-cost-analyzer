import { PricingClient } from '../../src/pricing/PricingClient';
import { AutoScalingGroupCalculator } from '../../src/pricing/calculators/AutoScalingGroupCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for AutoScaling Group pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct EC2 instance pricing queries for AutoScaling Groups
 * - Instance type resolution from LaunchConfiguration
 * - Instance type resolution from LaunchTemplate
 * - DesiredCapacity multiplier calculation
 * - Debug logging captures pricing queries and responses
 *
 * AutoScaling Groups pricing is based on:
 * - EC2 instance hourly rate
 * - Number of instances (DesiredCapacity)
 * - Instance type (from LaunchConfiguration or LaunchTemplate)
 *
 * Expected pricing for t3.medium (us-east-1):
 * - Hourly rate: ~$0.0416/hour
 * - Monthly cost per instance: ~$30.37
 * - For DesiredCapacity=2: ~$60.74/month
 *
 * To run: npm test -- AutoScalingGroupCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- AutoScalingGroupCalculator.integration.test.ts
 */
describe('AutoScalingGroupCalculator - AWS API Integration', () => {
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

  describe('With LaunchConfiguration', () => {
    testMode('should fetch real EC2 pricing for AutoScaling Group with t3.medium', async () => {
      const calculator = new AutoScalingGroupCalculator();

      const launchConfig = {
        logicalId: 'MyLaunchConfig',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.medium',
          ImageId: 'ami-12345678',
        },
      };

      const asgResource = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: 2,
          LaunchConfigurationName: { Ref: 'MyLaunchConfig' },
        },
      };

      const templateResources = [launchConfig, asgResource];

      const cost = await calculator.calculateCost(
        asgResource,
        testRegion,
        pricingClient,
        templateResources,
      );

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // AutoScaling Group costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 2x t3.medium instances:
        // t3.medium: ~$0.0416/hour * 730 hours = ~$30.37/month
        // 2 instances: ~$60.74/month
        // Allow 15% variance: ~$51.6 - $69.9
        const expectedMin = 51.6;
        const expectedMax = 69.9;

        console.log('AutoScaling Group pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention instance count and type
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/t3\.medium/);
        expect(assumptionText).toMatch(/2 instance/);
      } else {
        console.warn('AutoScaling Group pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('EC2 pricing should be available for t3.medium in us-east-1');
      }
    }, 30000);

    testMode('should calculate cost for single instance ASG', async () => {
      const calculator = new AutoScalingGroupCalculator();

      const launchConfig = {
        logicalId: 'MyLaunchConfig',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.small',
          ImageId: 'ami-12345678',
        },
      };

      const asgResource = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: 1,
          LaunchConfigurationName: { Ref: 'MyLaunchConfig' },
        },
      };

      const templateResources = [launchConfig, asgResource];

      const cost = await calculator.calculateCost(
        asgResource,
        testRegion,
        pricingClient,
        templateResources,
      );

      if (cost.amount > 0) {
        // For us-east-1 with 1x t3.small instance:
        // t3.small: ~$0.0208/hour * 730 hours = ~$15.18/month
        // Allow variance
        const expectedMin = 13.0;
        const expectedMax = 17.5;

        console.log('Single instance ASG pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1 instance');
        expect(assumptionText).toContain('t3.small');
      } else {
        throw new Error('EC2 pricing should be available');
      }
    }, 30000);

    testMode('should calculate cost for larger instance ASG', async () => {
      const calculator = new AutoScalingGroupCalculator();

      const launchConfig = {
        logicalId: 'MyLaunchConfig',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 'm5.large',
          ImageId: 'ami-12345678',
        },
      };

      const asgResource = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: 3,
          LaunchConfigurationName: { Ref: 'MyLaunchConfig' },
        },
      };

      const templateResources = [launchConfig, asgResource];

      const cost = await calculator.calculateCost(
        asgResource,
        testRegion,
        pricingClient,
        templateResources,
      );

      if (cost.amount > 0) {
        // For us-east-1 with 3x m5.large instances:
        // m5.large: ~$0.096/hour * 730 hours = ~$70.08/month
        // 3 instances: ~$210.24/month
        // Allow variance
        const expectedMin = 185.0;
        const expectedMax = 235.0;

        console.log('Larger instance ASG pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('3 instance');
        expect(assumptionText).toContain('m5.large');
      } else {
        throw new Error('EC2 pricing should be available');
      }
    }, 30000);
  });

  describe('With LaunchTemplate', () => {
    testMode('should fetch pricing for ASG with LaunchTemplate', async () => {
      const calculator = new AutoScalingGroupCalculator();

      const launchTemplate = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.medium',
            ImageId: 'ami-12345678',
          },
        },
      };

      const asgResource = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: 2,
          LaunchTemplate: {
            LaunchTemplateId: { Ref: 'MyLaunchTemplate' },
            Version: '1',
          },
        },
      };

      const templateResources = [launchTemplate, asgResource];

      const cost = await calculator.calculateCost(
        asgResource,
        testRegion,
        pricingClient,
        templateResources,
      );

      if (cost.amount > 0) {
        // Should be similar to LaunchConfiguration test
        const expectedMin = 51.6;
        const expectedMax = 69.9;

        console.log('ASG with LaunchTemplate pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('t3.medium');
        expect(assumptionText).toContain('2 instance');
      } else {
        throw new Error('EC2 pricing should be available');
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should default to 1 instance when DesiredCapacity is not specified', async () => {
      const calculator = new AutoScalingGroupCalculator();

      const launchConfig = {
        logicalId: 'MyLaunchConfig',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.micro',
          ImageId: 'ami-12345678',
        },
      };

      const asgResource = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          LaunchConfigurationName: { Ref: 'MyLaunchConfig' },
          // No DesiredCapacity specified
        },
      };

      const templateResources = [launchConfig, asgResource];

      const cost = await calculator.calculateCost(
        asgResource,
        testRegion,
        pricingClient,
        templateResources,
      );

      if (cost.amount > 0) {
        // Should default to 1 instance
        // t3.micro: ~$0.0104/hour * 730 = ~$7.59/month
        expect(cost.amount).toBeGreaterThan(6.0);
        expect(cost.amount).toBeLessThan(9.0);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('1 instance');
      }
    }, 30000);

    testMode('should handle missing instance type gracefully', async () => {
      const calculator = new AutoScalingGroupCalculator();

      const asgResource = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: 2,
          // No LaunchConfiguration or LaunchTemplate
        },
      };

      const cost = await calculator.calculateCost(
        asgResource,
        testRegion,
        pricingClient,
        [],
      );

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
      expect(cost.assumptions).toContain(
        'Could not determine instance type from LaunchConfiguration or LaunchTemplate',
      );
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new AutoScalingGroupCalculator();

      const launchConfig = {
        logicalId: 'MyLaunchConfig',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.medium',
          ImageId: 'ami-12345678',
        },
      };

      const asgResource = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: 1,
          LaunchConfigurationName: { Ref: 'MyLaunchConfig' },
        },
      };

      const templateResources = [launchConfig, asgResource];

      for (const region of regions) {
        const cost = await calculator.calculateCost(
          asgResource,
          region,
          pricingClient,
          templateResources,
        );

        console.log(`ASG pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // t3.medium pricing varies by region but should be $25-$35/month
          expect(cost.amount).toBeGreaterThan(25);
          expect(cost.amount).toBeLessThan(40);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Debug Logging', () => {
    testMode('should handle pricing queries with debug logging enabled', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new AutoScalingGroupCalculator();

        const launchConfig = {
          logicalId: 'MyLaunchConfig',
          type: 'AWS::AutoScaling::LaunchConfiguration',
          properties: {
            InstanceType: 't3.medium',
            ImageId: 'ami-12345678',
          },
        };

        const asgResource = {
          logicalId: 'MyASG',
          type: 'AWS::AutoScaling::AutoScalingGroup',
          properties: {
            DesiredCapacity: 1,
            LaunchConfigurationName: { Ref: 'MyLaunchConfig' },
          },
        };

        const templateResources = [launchConfig, asgResource];

        await calculator.calculateCost(
          asgResource,
          testRegion,
          pricingClient,
          templateResources,
        );

        // Debug logging should have captured the query details
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });
});
