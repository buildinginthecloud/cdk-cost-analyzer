import { ResourceWithId, ResourceDiff } from '../diff/types';
export interface PricingService {
    getResourceCost(resource: ResourceWithId, region: string, templateResources?: ResourceWithId[]): Promise<MonthlyCost>;
    getCostDelta(diff: ResourceDiff, region: string): Promise<CostDelta>;
}
export interface MonthlyCost {
    amount: number;
    currency: string;
    confidence: 'high' | 'medium' | 'low' | 'unknown';
    assumptions: string[];
}
export interface CostDelta {
    totalDelta: number;
    currency: string;
    addedCosts: ResourceCost[];
    removedCosts: ResourceCost[];
    modifiedCosts: ModifiedResourceCost[];
}
export interface ResourceCost {
    logicalId: string;
    type: string;
    monthlyCost: MonthlyCost;
}
export interface ModifiedResourceCost extends ResourceCost {
    oldMonthlyCost: MonthlyCost;
    newMonthlyCost: MonthlyCost;
    costDelta: number;
}
export interface ResourceCostCalculator {
    supports(resourceType: string): boolean;
    canCalculate?(resource: ResourceWithId): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient, templateResources?: ResourceWithId[]): Promise<MonthlyCost>;
}
export interface PricingClient {
    getPrice(params: PriceQueryParams): Promise<number | null>;
}
export interface PriceQueryParams {
    serviceCode: string;
    region: string;
    filters: PriceFilter[];
}
export interface PriceFilter {
    field: string;
    value: string;
    type?: 'TERM_MATCH';
}
export declare class PricingAPIError extends Error {
    retryable: boolean;
    constructor(message: string, retryable?: boolean);
}
export declare class UnsupportedResourceError extends Error {
    resourceType: string;
    constructor(resourceType: string);
}
