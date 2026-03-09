import { CostDelta } from '../pricing/types';
/** Service breakdown entry for cost grouping */
export interface ServiceBreakdown {
    service: string;
    totalCost: number;
    resourceCount: number;
}
/**
 * Get trend indicator emoji based on cost change direction
 */
export declare function getTrendIndicator(amount: number): string;
/**
 * Calculate percentage change between old and new amounts
 */
export declare function getPercentageChange(oldAmount: number, newAmount: number): string;
/**
 * Extract AWS service name from resource type (e.g., AWS::EC2::Instance -> EC2)
 */
export declare function extractServiceName(resourceType: string): string;
/**
 * Group costs by AWS service (e.g., EC2, S3, Lambda)
 */
export declare function groupCostsByService(costDelta: CostDelta): ServiceBreakdown[];
/**
 * Calculate total costs before and after changes
 */
export declare function calculateTotalCosts(costDelta: CostDelta): {
    before: number;
    after: number;
};
