import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

/**
 * Configuration extracted from a LaunchTemplate's LaunchTemplateData.
 * This interface can be used by other calculators (e.g., AutoScalingGroupCalculator)
 * to reference instance configuration.
 */
export interface LaunchTemplateConfig {
  instanceType: string | null;
  imageId: string | null;
  ebsVolumes: EbsVolumeConfig[];
}

export interface EbsVolumeConfig {
  deviceName: string;
  volumeType: string;
  volumeSizeGB: number;
  iops?: number;
  throughput?: number;
  deleteOnTermination: boolean;
}

export class LaunchTemplateCalculator implements ResourceCostCalculator {
  private static readonly DEFAULT_VOLUME_SIZE_GB = 8;
  private static readonly DEFAULT_VOLUME_TYPE = 'gp3';
  private static readonly MONTHLY_HOURS = 730;

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::EC2::LaunchTemplate';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const config = this.extractConfig(resource);

    if (!config.instanceType) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          'LaunchTemplate does not specify an instance type',
          'LaunchTemplates have no direct cost; costs are incurred when instances are launched',
        ],
      };
    }

    try {
      // Calculate the cost for a single instance using this template
      const instanceCost = await this.calculateInstanceCost(
        config.instanceType,
        region,
        pricingClient,
      );

      if (instanceCost === 0) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for instance type ${config.instanceType} in region ${region}`,
          ],
        };
      }

      const storageCost = await this.calculateStorageCost(
        config.ebsVolumes,
        region,
        pricingClient,
      );

      const totalPerInstanceCost = instanceCost + storageCost;

      const assumptions = [
        'LaunchTemplates have no direct cost; this represents per-instance cost when used',
        `Instance type: ${config.instanceType}`,
        `Assumes ${LaunchTemplateCalculator.MONTHLY_HOURS} hours per month (24/7 operation)`,
        'Assumes Linux OS, shared tenancy, on-demand pricing',
      ];

      if (config.ebsVolumes.length > 0) {
        const volumeDescriptions = config.ebsVolumes.map(
          (v) => `${v.deviceName}: ${v.volumeSizeGB}GB ${v.volumeType}`,
        );
        assumptions.push(`EBS volumes: ${volumeDescriptions.join(', ')}`);
      }

      const hasProvisionedIops = config.ebsVolumes.some(
        (v) => (v.volumeType === 'io1' || v.volumeType === 'io2') && v.iops,
      );
      if (hasProvisionedIops) {
        assumptions.push('Provisioned IOPS costs for io1/io2 volumes are not included');
      }

      const hasThroughput = config.ebsVolumes.some(
        (v) => v.volumeType === 'gp3' && v.throughput && v.throughput > 125,
      );
      if (hasThroughput) {
        assumptions.push('Additional throughput costs for gp3 volumes are not included');
      }

      if (config.imageId) {
        assumptions.push(`AMI: ${config.imageId}`);
      }

      return {
        amount: totalPerInstanceCost,
        currency: 'USD',
        confidence: 'low',
        assumptions,
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [
          `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Extract configuration from a LaunchTemplate resource.
   * This method is public to allow other calculators to use it.
   */
  extractConfig(resource: ResourceWithId): LaunchTemplateConfig {
    const launchTemplateData = resource.properties.LaunchTemplateData as
      | Record<string, unknown>
      | undefined;

    if (!launchTemplateData) {
      return {
        instanceType: null,
        imageId: null,
        ebsVolumes: [],
      };
    }

    const instanceType = (launchTemplateData.InstanceType as string) || null;
    const imageId = (launchTemplateData.ImageId as string) || null;
    const ebsVolumes = this.extractEbsVolumes(launchTemplateData);

    return {
      instanceType,
      imageId,
      ebsVolumes,
    };
  }

  private extractEbsVolumes(
    launchTemplateData: Record<string, unknown>,
  ): EbsVolumeConfig[] {
    const blockDeviceMappings = launchTemplateData.BlockDeviceMappings as
      | Array<Record<string, unknown>>
      | undefined;

    if (!blockDeviceMappings || !Array.isArray(blockDeviceMappings)) {
      return [];
    }

    return blockDeviceMappings
      .filter((mapping) => mapping.Ebs !== undefined)
      .map((mapping) => {
        const ebs = mapping.Ebs as Record<string, unknown>;
        return {
          deviceName: (mapping.DeviceName as string) || '/dev/xvda',
          volumeType:
            (ebs.VolumeType as string) ||
            LaunchTemplateCalculator.DEFAULT_VOLUME_TYPE,
          volumeSizeGB:
            (ebs.VolumeSize as number) ||
            LaunchTemplateCalculator.DEFAULT_VOLUME_SIZE_GB,
          iops: ebs.Iops as number | undefined,
          throughput: ebs.Throughput as number | undefined,
          deleteOnTermination: (ebs.DeleteOnTermination as boolean) ?? true,
        };
      });
  }

  private async calculateInstanceCost(
    instanceType: string,
    region: string,
    pricingClient: PricingClient,
  ): Promise<number> {
    const hourlyRate = await pricingClient.getPrice({
      serviceCode: 'AmazonEC2',
      region: normalizeRegion(region),
      filters: [
        { field: 'instanceType', value: instanceType },
        { field: 'operatingSystem', value: 'Linux' },
        { field: 'tenancy', value: 'Shared' },
        { field: 'preInstalledSw', value: 'NA' },
        { field: 'capacitystatus', value: 'Used' },
      ],
    });

    if (hourlyRate === null) {
      return 0;
    }

    return hourlyRate * LaunchTemplateCalculator.MONTHLY_HOURS;
  }

  private async calculateStorageCost(
    ebsVolumes: EbsVolumeConfig[],
    region: string,
    pricingClient: PricingClient,
  ): Promise<number> {
    if (ebsVolumes.length === 0) {
      return 0;
    }

    let totalStorageCost = 0;

    for (const volume of ebsVolumes) {
      const pricePerGBMonth = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'Storage' },
          { field: 'volumeApiName', value: volume.volumeType.toLowerCase() },
        ],
      });

      if (pricePerGBMonth !== null) {
        totalStorageCost += pricePerGBMonth * volume.volumeSizeGB;
      }
    }

    return totalStorageCost;
  }

}
