import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class TransitGatewayCalculator implements ResourceCostCalculator {
    private readonly customAttachments?;
    private readonly customMonthlyDataGB?;
    private readonly HOURS_PER_MONTH;
    private readonly DEFAULT_ATTACHMENTS;
    private readonly DEFAULT_MONTHLY_DATA_GB;
    private readonly FALLBACK_ATTACHMENT_PRICE;
    private readonly FALLBACK_DATA_PRICE;
    constructor(customAttachments?: number | undefined, customMonthlyDataGB?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private calculateAttachmentCost;
    private calculateTransitGatewayCost;
}
