import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class APIGatewayCalculator implements ResourceCostCalculator {
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private calculateRestApiCost;
    private calculateHttpApiCost;
    private calculateWebSocketCost;
}
