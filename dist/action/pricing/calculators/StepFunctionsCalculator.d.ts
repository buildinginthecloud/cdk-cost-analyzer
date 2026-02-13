import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export type StepFunctionsWorkflowType = 'STANDARD' | 'EXPRESS';
export declare class StepFunctionsCalculator implements ResourceCostCalculator {
    private readonly customMonthlyExecutions?;
    private readonly customStateTransitionsPerExecution?;
    private readonly customAverageDurationMs?;
    private readonly DEFAULT_MONTHLY_EXECUTIONS;
    private readonly DEFAULT_STATE_TRANSITIONS_PER_EXECUTION;
    private readonly DEFAULT_AVERAGE_DURATION_MS;
    private readonly FALLBACK_STANDARD_STATE_TRANSITION_PRICE;
    private readonly FALLBACK_EXPRESS_REQUEST_PRICE;
    private readonly FALLBACK_EXPRESS_DURATION_PRICE;
    constructor(customMonthlyExecutions?: number | undefined, customStateTransitionsPerExecution?: number | undefined, customAverageDurationMs?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private getWorkflowType;
    private calculateStandardWorkflowCost;
    private calculateExpressWorkflowCost;
    private buildStandardAssumptions;
    private buildExpressAssumptions;
    private hasCustomAssumptions;
}
