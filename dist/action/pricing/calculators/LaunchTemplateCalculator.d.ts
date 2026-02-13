import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
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
export declare class LaunchTemplateCalculator implements ResourceCostCalculator {
    private static readonly DEFAULT_VOLUME_SIZE_GB;
    private static readonly DEFAULT_VOLUME_TYPE;
    private static readonly MONTHLY_HOURS;
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    /**
     * Extract configuration from a LaunchTemplate resource.
     * This method is public to allow other calculators to use it.
     */
    extractConfig(resource: ResourceWithId): LaunchTemplateConfig;
    private extractEbsVolumes;
    private calculateInstanceCost;
    private calculateStorageCost;
}
