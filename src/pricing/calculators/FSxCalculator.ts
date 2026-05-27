import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

const WINDOWS_PRICE_PER_GB = 0.013;
const LUSTRE_PRICE_PER_GB = 0.145;
const DEFAULT_STORAGE_GB = 32;

export class FSxCalculator implements ResourceCostCalculator {
  constructor(private readonly customStorageGB?: number) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::FSx::FileSystem';
  }

  async calculateCost(
    resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const fileSystemType =
      ((resource.properties.FileSystemType as string)?.toUpperCase()) ?? 'WINDOWS';
    const storageCapacity =
      this.customStorageGB ??
      (resource.properties.StorageCapacity as number) ??
      DEFAULT_STORAGE_GB;

    const pricePerGB =
      fileSystemType === 'LUSTRE' ? LUSTRE_PRICE_PER_GB : WINDOWS_PRICE_PER_GB;

    const cost = storageCapacity * pricePerGB;

    return {
      amount: cost,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `File system type: ${fileSystemType}`,
        `Storage capacity: ${storageCapacity} GB`,
        `Price per GB-month: $${pricePerGB}`,
      ],
    };
  }
}
