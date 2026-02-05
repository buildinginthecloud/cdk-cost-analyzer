import { LaunchTemplateCalculator } from '../../src/pricing/calculators/LaunchTemplateCalculator';
import { PricingClient } from '../../src/pricing/types';
import { ResourceWithId } from '../../src/diff/types';

describe('LaunchTemplateCalculator', () => {
  const calculator = new LaunchTemplateCalculator();

  describe('supports', () => {
    it('should support AWS::EC2::LaunchTemplate', () => {
      expect(calculator.supports('AWS::EC2::LaunchTemplate')).toBe(true);
    });

    it('should not support other resource types', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
      expect(calculator.supports('AWS::AutoScaling::LaunchConfiguration')).toBe(false);
      expect(calculator.supports('AWS::AutoScaling::AutoScalingGroup')).toBe(false);
    });
  });

  describe('extractConfig', () => {
    it('should extract instance type from LaunchTemplateData', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const config = calculator.extractConfig(resource);

      expect(config.instanceType).toBe('t3.micro');
      expect(config.ebsVolumes).toEqual([]);
    });

    it('should extract imageId from LaunchTemplateData', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            ImageId: 'ami-12345678',
          },
        },
      };

      const config = calculator.extractConfig(resource);

      expect(config.instanceType).toBe('t3.micro');
      expect(config.imageId).toBe('ami-12345678');
    });

    it('should extract EBS volumes from BlockDeviceMappings', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 100,
                  VolumeType: 'gp3',
                  DeleteOnTermination: true,
                },
              },
              {
                DeviceName: '/dev/xvdb',
                Ebs: {
                  VolumeSize: 500,
                  VolumeType: 'io2',
                  Iops: 3000,
                },
              },
            ],
          },
        },
      };

      const config = calculator.extractConfig(resource);

      expect(config.ebsVolumes).toHaveLength(2);
      expect(config.ebsVolumes[0]).toEqual({
        deviceName: '/dev/xvda',
        volumeType: 'gp3',
        volumeSizeGB: 100,
        iops: undefined,
        throughput: undefined,
        deleteOnTermination: true,
      });
      expect(config.ebsVolumes[1]).toEqual({
        deviceName: '/dev/xvdb',
        volumeType: 'io2',
        volumeSizeGB: 500,
        iops: 3000,
        throughput: undefined,
        deleteOnTermination: true,
      });
    });

    it('should handle missing LaunchTemplateData', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {},
      };

      const config = calculator.extractConfig(resource);

      expect(config.instanceType).toBeNull();
      expect(config.imageId).toBeNull();
      expect(config.ebsVolumes).toEqual([]);
    });

    it('should use defaults for EBS volume properties when not specified', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                Ebs: {},
              },
            ],
          },
        },
      };

      const config = calculator.extractConfig(resource);

      expect(config.ebsVolumes).toHaveLength(1);
      expect(config.ebsVolumes[0].deviceName).toBe('/dev/xvda');
      expect(config.ebsVolumes[0].volumeType).toBe('gp3');
      expect(config.ebsVolumes[0].volumeSizeGB).toBe(8);
    });
  });

  describe('getInstanceType static method', () => {
    it('should return instance type from LaunchTemplate resource', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 'm5.large',
          },
        },
      };

      expect(LaunchTemplateCalculator.getInstanceType(resource)).toBe('m5.large');
    });

    it('should return null when no LaunchTemplateData', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {},
      };

      expect(LaunchTemplateCalculator.getInstanceType(resource)).toBeNull();
    });

    it('should return null when no InstanceType in LaunchTemplateData', () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            ImageId: 'ami-12345678',
          },
        },
      };

      expect(LaunchTemplateCalculator.getInstanceType(resource)).toBeNull();
    });
  });

  describe('calculateCost', () => {
    const mockPricingClient: PricingClient = {
      getPrice: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate per-instance cost for LaunchTemplate with instance type', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0.0104 * 730);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain(
        'LaunchTemplates have no direct cost; this represents per-instance cost when used',
      );
      expect(result.assumptions).toContain('Instance type: t3.micro');
    });

    it('should include EBS storage cost in calculation', async () => {
      // First call for EC2 instance pricing, second for EBS storage
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.0104) // EC2 hourly rate
        .mockResolvedValueOnce(0.08); // EBS gp3 per GB/month

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 100,
                  VolumeType: 'gp3',
                },
              },
            ],
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      const expectedInstanceCost = 0.0104 * 730;
      const expectedStorageCost = 0.08 * 100;
      expect(result.amount).toBe(expectedInstanceCost + expectedStorageCost);
      expect(result.assumptions).toContain('EBS volumes: /dev/xvda: 100GB gp3');
    });

    it('should handle multiple EBS volumes', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.0104) // EC2 hourly rate
        .mockResolvedValueOnce(0.08) // First volume (gp3)
        .mockResolvedValueOnce(0.125); // Second volume (io2)

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 100,
                  VolumeType: 'gp3',
                },
              },
              {
                DeviceName: '/dev/xvdb',
                Ebs: {
                  VolumeSize: 200,
                  VolumeType: 'io2',
                },
              },
            ],
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      const expectedInstanceCost = 0.0104 * 730;
      const expectedStorageCost = 0.08 * 100 + 0.125 * 200;
      expect(result.amount).toBe(expectedInstanceCost + expectedStorageCost);
    });

    it('should return low confidence when instance type is not specified', async () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            ImageId: 'ami-12345678',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('low');
      expect(result.assumptions).toContain('LaunchTemplate does not specify an instance type');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should return zero amount when LaunchTemplateData is missing', async () => {
      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {},
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('low');
      expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
    });

    it('should include AMI in assumptions when specified', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            ImageId: 'ami-12345678',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.assumptions).toContain('AMI: ami-12345678');
    });

    it('should handle pricing data unavailable for instance type', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('low');
    });

    it('should handle pricing API errors', async () => {
      jest.mocked(mockPricingClient.getPrice).mockRejectedValue(new Error('API Error'));

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0);
      expect(result.confidence).toBe('unknown');
      expect(result.assumptions[0]).toContain('Failed to fetch pricing');
    });

    it('should query pricing for correct region (us-east-1)', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonEC2',
        region: 'US East (N. Virginia)',
        filters: [
          { field: 'instanceType', value: 't3.micro' },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });
    });

    it('should query pricing for correct region (eu-central-1)', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0116);

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
          },
        },
      };

      await calculator.calculateCost(resource, 'eu-central-1', mockPricingClient);

      expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
        serviceCode: 'AmazonEC2',
        region: 'EU (Frankfurt)',
        filters: expect.arrayContaining([
          { field: 'instanceType', value: 't3.micro' },
        ]),
      });
    });

    it('should calculate cost for m5.large instance', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.096);

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 'm5.large',
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      expect(result.amount).toBe(0.096 * 730);
      expect(result.assumptions).toContain('Instance type: m5.large');
    });

    it('should handle storage pricing unavailable gracefully', async () => {
      jest
        .mocked(mockPricingClient.getPrice)
        .mockResolvedValueOnce(0.0104) // EC2 pricing available
        .mockResolvedValueOnce(null); // Storage pricing unavailable

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 100,
                  VolumeType: 'gp3',
                },
              },
            ],
          },
        },
      };

      const result = await calculator.calculateCost(resource, 'us-east-1', mockPricingClient);

      // Should only include instance cost
      expect(result.amount).toBe(0.0104 * 730);
    });

    it('should filter out non-EBS block device mappings', async () => {
      jest.mocked(mockPricingClient.getPrice).mockResolvedValue(0.0104);

      const resource: ResourceWithId = {
        logicalId: 'MyLaunchTemplate',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            InstanceType: 't3.micro',
            BlockDeviceMappings: [
              {
                DeviceName: '/dev/xvda',
                Ebs: {
                  VolumeSize: 100,
                  VolumeType: 'gp3',
                },
              },
              {
                DeviceName: '/dev/xvdb',
                VirtualName: 'ephemeral0', // Instance store, not EBS
              },
            ],
          },
        },
      };

      const config = calculator.extractConfig(resource);
      expect(config.ebsVolumes).toHaveLength(1);
    });
  });
});
