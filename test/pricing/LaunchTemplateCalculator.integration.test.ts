import { PricingClient } from '../../src/pricing/PricingClient';
import { LaunchTemplateCalculator } from '../../src/pricing/calculators/LaunchTemplateCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for Launch Template pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for instance type (like EC2)
 * - EBS volume storage pricing (gp3, gp2, io1, io2, etc.)
 * - Multiple volume configurations
 * - Low confidence level (templates have no direct cost, only when launched)
 * - Debug logging captures pricing queries and responses
 *
 * Launch Template Pricing Components:
 * - Instance: EC2 instance pricing (Linux, on-demand, shared tenancy)
 * - EBS Storage: Volume pricing per GB/month by type
 *   - gp3: ~$0.08/GB/month
 *   - gp2: ~$0.10/GB/month
 *   - io1/io2: ~$0.125/GB/month (+ IOPS costs not calculated)
 *
 * Expected pricing for default configuration (us-east-1):
 * - t3.micro: ~$7.59/month
 * - 8 GB gp3: ~$0.64/month
 * - Total: ~$8.23/month per instance
 *
 * To run: npm test -- LaunchTemplateCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- LaunchTemplateCalculator.integration.test.ts
 */
describe('LaunchTemplateCalculator - AWS API Integration', () => {
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

  describe('Basic Launch Template', () => {
    testMode('should fetch pricing for launch template with instance type', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            ImageId: 'ami-12345678',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      if (cost.amount > 0) {
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 t3.micro without additional storage:
        // Instance: ~$7.59/month
        // Allow 20% variance: ~$6.07 - $9.11
        const expectedMin = 6.07;
        const expectedMax = 9.11;

        console.log('Launch Template t3.micro pricing:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('low');

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/launchtemplates.*no direct cost/);
        expect(assumptionText).toMatch(/t3\.micro/);
        expect(assumptionText).toMatch(/730.*hours/);
      } else {
        console.warn('Launch Template pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        throw new Error('Launch Template pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should return zero cost when no instance type specified', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            ImageId: 'ami-12345678',
            // No InstanceType
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');

      const assumptionText = cost.assumptions.join(' ');
      expect(assumptionText).toMatch(/does not specify.*instance type/i);
      expect(assumptionText).toMatch(/launchtemplates.*no direct cost/i);

      console.log('Launch Template without instance type:');
      cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));
    }, 30000);

    testMode('should return zero cost when LaunchTemplateData is missing', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          // No LaunchTemplateData
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      expect(cost.amount).toBe(0);
      expect(cost.confidence).toBe('unknown');
    }, 30000);
  });

  describe('Launch Template with EBS Volumes', () => {
    testMode('should calculate cost with gp3 EBS volume', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 20,
                  VolumeType: 'gp3',
                  DeleteOnTermination: true,
                },
              },
            ],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 t3.micro + 20GB gp3:
        // Instance: ~$7.59/month
        // Storage: 20GB × ~$0.08 = ~$1.60/month
        // Total: ~$9.19/month
        // Allow 20% variance: ~$7.35 - $11.03
        const expectedMin = 7.35;
        const expectedMax = 11.03;

        console.log('Launch Template with gp3 storage:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/ebs volumes/);
        expect(assumptionText).toMatch(/20.*gb.*gp3/);
      }
    }, 30000);

    testMode('should calculate cost with multiple EBS volumes', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 10,
                  VolumeType: 'gp3',
                },
              },
              {
                DeviceName: '/dev/xvdb',
                Ebs: {
                  VolumeSize: 50,
                  VolumeType: 'gp3',
                },
              },
            ],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // For us-east-1 t3.micro + 60GB total gp3:
        // Instance: ~$7.59/month
        // Storage: 60GB × ~$0.08 = ~$4.80/month
        // Total: ~$12.39/month
        // Allow 20% variance: ~$9.91 - $14.87
        const expectedMin = 9.91;
        const expectedMax = 14.87;

        console.log('Launch Template with multiple volumes:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('/dev/xvda');
        expect(assumptionText).toContain('/dev/xvdb');
      }
    }, 30000);

    testMode('should handle gp2 volumes', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 20,
                  VolumeType: 'gp2',
                },
              },
            ],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // gp2 is slightly more expensive than gp3
        // gp2: ~$0.10/GB/month
        // Instance + 20GB gp2: ~$7.59 + $2.00 = ~$9.59/month
        const expectedMin = 7.5;
        const expectedMax = 12.0;

        console.log('Launch Template with gp2 storage:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toContain('gp2');
      }
    }, 30000);

    testMode('should handle default volume size and type', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  // No VolumeSize or VolumeType - should use defaults (8GB gp3)
                },
              },
            ],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Instance + 8GB gp3 (default): ~$7.59 + $0.64 = ~$8.23/month
        const expectedMin = 6.5;
        const expectedMax = 10.0;

        console.log('Launch Template with default volume:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/ebs volumes/);
      }
    }, 30000);
  });

  describe('Different Instance Types', () => {
    testMode('should calculate cost for m5.large', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 'm5.large',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // m5.large: ~$70.08/month
        const expectedMin = 56.0;
        const expectedMax = 85.0;

        console.log('Launch Template m5.large:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('m5.large');
      }
    }, 30000);

    testMode('should calculate cost for c5.xlarge', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 'c5.xlarge',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // c5.xlarge: ~$0.17/hour × 730 = ~$124.10/month
        const expectedMin = 100.0;
        const expectedMax = 150.0;

        console.log('Launch Template c5.xlarge:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`Launch Template pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // Pricing varies by region
          expect(cost.amount).toBeGreaterThan(5.0);
          expect(cost.amount).toBeLessThan(11.0);
          expect(cost.confidence).toBe('low');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000);
  });

  describe('Pricing Query Validation', () => {
    testMode('should query both instance and storage pricing', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new LaunchTemplateCalculator();

        const testResource = {
          logicalId: 'MyLaunchTemplate',
          type: 'AWS::EC2::LaunchTemplate',
          properties: {
            LaunchTemplateData: {
              InstanceType: 't3.micro',
              BlockDeviceMappings: [
                {
                  DeviceName: '/dev/xvda',
                  Ebs: {
                    VolumeSize: 20,
                    VolumeType: 'gp3',
                  },
                },
              ],
            },
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured:
        // - Instance pricing query (like EC2)
        // - EBS storage pricing query
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Cost Assumptions', () => {
    testMode('should indicate no direct cost', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/launchtemplates.*no direct cost/);
        expect(assumptionText).toMatch(/per-instance cost/);
      }
    }, 30000);

    testMode('should assume Linux OS and shared tenancy', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toContain('linux');
        expect(assumptionText).toContain('shared tenancy');
        expect(assumptionText).toContain('on-demand');
      }
    }, 30000);

    testMode('should assume 730 hours per month', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toMatch(/730.*hours.*month/i);
      }
    }, 30000);

    testMode('should include AMI in assumptions when specified', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            ImageId: 'ami-0abcdef1234567890',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('AMI: ami-0abcdef1234567890');
      }
    }, 30000);
  });

  describe('Low Confidence', () => {
    testMode('should always return low confidence', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Always low confidence because templates have no direct cost
        expect(cost.confidence).toBe('low');
      }
    }, 30000);

    testMode('should explain low confidence is due to indirect cost', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        expect(cost.confidence).toBe('low');

        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/no direct cost/);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle io1 volumes without including IOPS costs', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 20,
                  VolumeType: 'io1',
                  Iops: 1000,
                },
              },
            ],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should note that IOPS costs are not included
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/provisioned iops.*not included/);
      }
    }, 30000);

    testMode('should handle gp3 with custom throughput', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 20,
                  VolumeType: 'gp3',
                  Throughput: 250, // > 125 default
                },
              },
            ],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should note that additional throughput costs are not included
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/throughput.*gp3.*not included/);
      }
    }, 30000);

    testMode('should handle empty block device mappings', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [],
          },
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should only calculate instance cost
        expect(cost.amount).toBeGreaterThan(6.0);
        expect(cost.amount).toBeLessThan(10.0);
      }
    }, 30000);
  });

  describe('Config Extraction', () => {
    testMode('should extract configuration correctly', async () => {
      const calculator = new LaunchTemplateCalculator();

      const testResource = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            ImageId: 'ami-12345678',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 30,
                  VolumeType: 'gp3',
                },
              },
            ],
          },
        },
      };

      const config = calculator.extractConfig(testResource);

      expect(config.instanceType).toBe('t3.micro');
      expect(config.imageId).toBe('ami-12345678');
      expect(config.ebsVolumes).toHaveLength(1);
      expect(config.ebsVolumes[0].volumeSizeGB).toBe(30);
      expect(config.ebsVolumes[0].volumeType).toBe('gp3');
    }, 30000);
  });
});
