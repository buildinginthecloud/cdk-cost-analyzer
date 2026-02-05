import { AutoScalingGroupCalculator } from '../../src/pricing/calculators/AutoScalingGroupCalculator';
import { PricingClient } from '../../src/pricing/types';
import { ResourceWithId } from '../../src/diff/types';

describe('AutoScalingGroupCalculator', () => {
  const calculator = new AutoScalingGroupCalculator();

  describe('supports', () => {
    it('should support AWS::AutoScaling::AutoScalingGroup', () => {
      expect(calculator.supports('AWS::AutoScaling::AutoScalingGroup')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::AutoScaling::LaunchConfiguration')).toBe(false);
      expect(calculator.supports('AWS::EC2::LaunchTemplate')).toBe(false);
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate cost with LaunchConfiguration reference (Ref intrinsic)', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0116);

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '2',
          LaunchConfigurationName: { Ref: 'MyLaunchConfig' },
          MinSize: '2',
          MaxSize: '4',
        },
      };

      const launchConfigResource: ResourceWithId = {
        logicalId: 'MyLaunchConfig',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.micro',
          ImageId: 'ami-12345678',
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'eu-central-1',
        mockPricingClient,
        [asgResource, launchConfigResource],
      );

      expect(result.amount).toBe(0.0116 * 730 * 2);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('2 instance(s) of type t3.micro');
    });

    it('should calculate cost with LaunchTemplate reference (Ref intrinsic)', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '3',
          LaunchTemplate: {
            LaunchTemplateId: { Ref: 'MyLaunchTemplate' },
            Version: '$Latest',
          },
        },
      };

      const launchTemplateResource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            ImageId: 'ami-12345678',
          },
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource, launchTemplateResource],
      );

      expect(result.amount).toBe(0.0104 * 730 * 3);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('3 instance(s) of type t3.micro');
    });

    it('should calculate cost with MixedInstancesPolicy', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.096);

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '2',
          MixedInstancesPolicy: {
            LaunchTemplate: {
              LaunchTemplateSpecification: {
                LaunchTemplateId: { Ref: 'MyLaunchTemplate' },
                Version: '$Latest',
              },
            },
          },
        },
      };

      const launchTemplateResource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 'm5.large',
          },
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource, launchTemplateResource],
      );

      expect(result.amount).toBe(0.096 * 730 * 2);
      expect(result.confidence).toBe('medium');
      expect(result.assumptions).toContain('2 instance(s) of type m5.large');
    });

    it('should default DesiredCapacity to 1 when not specified', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          LaunchConfigurationName: { Ref: 'MyLC' },
        },
      };

      const lcResource: ResourceWithId = {
        logicalId: 'MyLC',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource, lcResource],
      );

      expect(result.amount).toBe(0.0104 * 730 * 1);
      expect(result.assumptions).toContain('1 instance(s) of type t3.micro');
    });

    it('should return unknown when no LaunchConfiguration or LaunchTemplate is found', async () => {
      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '2',
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource],
      );

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions).toContain(
        'Could not determine instance type from LaunchConfiguration or LaunchTemplate',
      );
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should return unknown when templateResources is not provided', async () => {
      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '2',
          LaunchConfigurationName: { Ref: 'MyLC' },
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
      );

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should return unknown when referenced resource is not in templateResources', async () => {
      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '2',
          LaunchConfigurationName: { Ref: 'NonExistentLC' },
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource],
      );

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
    });

    it('should handle pricing data unavailable', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '2',
          LaunchConfigurationName: { Ref: 'MyLC' },
        },
      };

      const lcResource: ResourceWithId = {
        logicalId: 'MyLC',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource, lcResource],
      );

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Pricing data not available');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '1',
          LaunchConfigurationName: { Ref: 'MyLC' },
        },
      };

      const lcResource: ResourceWithId = {
        logicalId: 'MyLC',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource, lcResource],
      );

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });

    it('should verify eu-central-1 pricing for 2 x t3.micro', async () => {
      // t3.micro in eu-central-1 is ~$0.0116/hour
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0116);

      const asgResource: ResourceWithId = {
        logicalId: 'BastionASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '2',
          LaunchConfigurationName: { Ref: 'BastionLC' },
          MinSize: '2',
          MaxSize: '2',
        },
      };

      const lcResource: ResourceWithId = {
        logicalId: 'BastionLC',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: {
          InstanceType: 't3.micro',
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'eu-central-1',
        mockPricingClient,
        [asgResource, lcResource],
      );

      // 2 * 0.0116 * 730 = $16.936
      expect(result.amount).toBeCloseTo(16.936, 2);
      expect(result.confidence).toBe('medium');

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonEC2',
        region: 'EU (Frankfurt)',
        filters: [
          { field: 'instanceType', value: 't3.micro' },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });
    });

    it('should resolve LaunchTemplate via LaunchTemplateName', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '1',
          LaunchTemplate: {
            LaunchTemplateName: { Ref: 'MyLT' },
            Version: '$Latest',
          },
        },
      };

      const ltResource: ResourceWithId = {
        logicalId: 'MyLT',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.small',
          },
        },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource, ltResource],
      );

      expect(result.amount).toBe(0.0104 * 730);
      expect(result.assumptions).toContain('1 instance(s) of type t3.small');
    });

    it('should include standard assumptions in the result', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const asgResource: ResourceWithId = {
        logicalId: 'MyASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          DesiredCapacity: '1',
          LaunchConfigurationName: { Ref: 'MyLC' },
        },
      };

      const lcResource: ResourceWithId = {
        logicalId: 'MyLC',
        type: 'AWS::AutoScaling::LaunchConfiguration',
        properties: { InstanceType: 't3.micro' },
      };

      const result = await calculator.calculateCost(
        asgResource,
        'us-east-1',
        mockPricingClient,
        [asgResource, lcResource],
      );

      expect(result.assumptions).toContain('Assumes 730 hours per month (24/7 operation)');
      expect(result.assumptions).toContain('Assumes Linux OS, shared tenancy, on-demand pricing');
      expect(result.assumptions).toContain('Does not include EBS volumes or data transfer costs');
    });
  });
});
