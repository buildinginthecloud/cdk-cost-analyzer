import { ResourceWithId } from '../../../diff/types';
import { MonthlyCost, PricingClient } from '../../types';
export declare const MONTHLY_HOURS = 730;
export declare const DEFAULT_STORAGE_GB = 100;
export declare const STORAGE_PRICE_PER_GB = 0.1;
export interface DatabaseInstancePricingConfig {
    serviceCode: string;
    defaultInstanceClass: string;
    fallbackHourlyRate: number;
    productFamily: string;
    customStorageGB?: number;
}
/**
 * Calculates monthly cost for a DocumentDB- or Neptune-style instance.
 * Both services bill on instance-hour + per-GB storage and share the same
 * pricing-API filter structure, so this helper avoids duplication.
 */
export declare function calculateDatabaseInstanceCost(resource: ResourceWithId, region: string, pricingClient: PricingClient, config: DatabaseInstancePricingConfig): Promise<MonthlyCost>;
