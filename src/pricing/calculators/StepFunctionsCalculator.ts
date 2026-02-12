import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion, getRegionPrefix } from '../RegionMapper';

export type StepFunctionsWorkflowType = 'STANDARD' | 'EXPRESS';

export class StepFunctionsCalculator implements ResourceCostCalculator {
  // Default usage assumptions
  private readonly DEFAULT_MONTHLY_EXECUTIONS = 10000;
  private readonly DEFAULT_STATE_TRANSITIONS_PER_EXECUTION = 10;
  private readonly DEFAULT_AVERAGE_DURATION_MS = 1000;

  // Fallback pricing rates (AWS Step Functions us-east-1 pricing as of 2024)
  // Used when API pricing is unavailable but user provided usage assumptions
  private readonly FALLBACK_STANDARD_STATE_TRANSITION_PRICE = 0.025 / 1000; // $0.025 per 1,000 state transitions
  private readonly FALLBACK_EXPRESS_REQUEST_PRICE = 1.0 / 1000000; // $1.00 per million requests
  private readonly FALLBACK_EXPRESS_DURATION_PRICE = 0.00001667; // Per GB-second

  constructor(
    private readonly customMonthlyExecutions?: number,
    private readonly customStateTransitionsPerExecution?: number,
    private readonly customAverageDurationMs?: number,
  ) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::StepFunctions::StateMachine';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const workflowType = this.getWorkflowType(resource);
    
    if (workflowType === 'EXPRESS') {
      return this.calculateExpressWorkflowCost(resource, region, pricingClient);
    }
    
    return this.calculateStandardWorkflowCost(resource, region, pricingClient);
  }

  private getWorkflowType(resource: ResourceWithId): StepFunctionsWorkflowType {
    const typeProperty = resource.properties.Type as string | undefined;
    if (typeProperty === 'EXPRESS') {
      return 'EXPRESS';
    }
    return 'STANDARD';
  }

  private async calculateStandardWorkflowCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const monthlyExecutions = this.customMonthlyExecutions ?? this.DEFAULT_MONTHLY_EXECUTIONS;
    const stateTransitionsPerExecution = this.customStateTransitionsPerExecution ?? this.DEFAULT_STATE_TRANSITIONS_PER_EXECUTION;
    const totalStateTransitions = monthlyExecutions * stateTransitionsPerExecution;

    try {
      const regionPrefix = getRegionPrefix(region);
      const usageType = regionPrefix 
        ? `${regionPrefix}-StateTransition` 
        : 'StateTransition';

      const stateTransitionPrice = await pricingClient.getPrice({
        serviceCode: 'AWSStepFunctions',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'AWS Step Functions' },
          { field: 'usagetype', value: usageType },
        ],
      });

      const assumptions = this.buildStandardAssumptions(monthlyExecutions, stateTransitionsPerExecution, totalStateTransitions);

      if (stateTransitionPrice === null) {
        const hasCustomAssumptions = this.hasCustomAssumptions();
        
        if (hasCustomAssumptions) {
          const monthlyCost = totalStateTransitions * this.FALLBACK_STANDARD_STATE_TRANSITION_PRICE;
          return {
            amount: monthlyCost,
            currency: 'USD',
            confidence: 'low',
            assumptions: [
              'Using fallback state transition pricing (API unavailable)',
              ...assumptions,
            ],
          };
        }

        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for Step Functions Standard workflow in region ${region}`,
            ...assumptions,
          ],
        };
      }

      const monthlyCost = totalStateTransitions * stateTransitionPrice;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions,
      };
    } catch (error) {
      const assumptions = [
        `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
        ...this.buildStandardAssumptions(monthlyExecutions, stateTransitionsPerExecution, totalStateTransitions),
      ];

      const hasCustomAssumptions = this.hasCustomAssumptions();
      
      if (hasCustomAssumptions) {
        const monthlyCost = totalStateTransitions * this.FALLBACK_STANDARD_STATE_TRANSITION_PRICE;
        return {
          amount: monthlyCost,
          currency: 'USD',
          confidence: 'low',
          assumptions: [
            'Using fallback pricing (API error)',
            ...assumptions.slice(1),
          ],
        };
      }

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions,
      };
    }
  }

  private async calculateExpressWorkflowCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const monthlyExecutions = this.customMonthlyExecutions ?? this.DEFAULT_MONTHLY_EXECUTIONS;
    const averageDurationMs = this.customAverageDurationMs ?? this.DEFAULT_AVERAGE_DURATION_MS;
    
    // Express workflows are billed based on: requests + duration (GB-seconds)
    // Assume 64MB memory per execution (typical Step Functions memory allocation)
    const memoryMB = 64;
    const durationSeconds = averageDurationMs / 1000;
    const gbSeconds = (memoryMB / 1024) * durationSeconds * monthlyExecutions;

    try {
      const regionPrefix = getRegionPrefix(region);
      const requestUsageType = regionPrefix 
        ? `${regionPrefix}-ExpressRequest` 
        : 'ExpressRequest';
      const durationUsageType = regionPrefix 
        ? `${regionPrefix}-ExpressDuration` 
        : 'ExpressDuration';

      const requestPrice = await pricingClient.getPrice({
        serviceCode: 'AWSStepFunctions',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'AWS Step Functions' },
          { field: 'usagetype', value: requestUsageType },
        ],
      });

      const durationPrice = await pricingClient.getPrice({
        serviceCode: 'AWSStepFunctions',
        region: normalizeRegion(region),
        filters: [
          { field: 'productFamily', value: 'AWS Step Functions' },
          { field: 'usagetype', value: durationUsageType },
        ],
      });

      const assumptions = this.buildExpressAssumptions(monthlyExecutions, averageDurationMs, gbSeconds);

      if (requestPrice === null || durationPrice === null) {
        const hasCustomAssumptions = this.hasCustomAssumptions();
        
        if (hasCustomAssumptions) {
          const effectiveRequestPrice = requestPrice ?? this.FALLBACK_EXPRESS_REQUEST_PRICE;
          const effectiveDurationPrice = durationPrice ?? this.FALLBACK_EXPRESS_DURATION_PRICE;
          
          const requestCost = monthlyExecutions * effectiveRequestPrice;
          const durationCost = gbSeconds * effectiveDurationPrice;
          const monthlyCost = requestCost + durationCost;

          return {
            amount: monthlyCost,
            currency: 'USD',
            confidence: 'low',
            assumptions: [
              requestPrice === null ? 'Using fallback request pricing (API unavailable)' : '',
              durationPrice === null ? 'Using fallback duration pricing (API unavailable)' : '',
              ...assumptions,
            ].filter(a => a !== ''),
          };
        }

        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [
            `Pricing data not available for Step Functions Express workflow in region ${region}`,
            ...assumptions,
          ],
        };
      }

      const requestCost = monthlyExecutions * requestPrice;
      const durationCost = gbSeconds * durationPrice;
      const monthlyCost = requestCost + durationCost;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions,
      };
    } catch (error) {
      const assumptions = [
        `Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`,
        ...this.buildExpressAssumptions(monthlyExecutions, averageDurationMs, gbSeconds),
      ];

      const hasCustomAssumptions = this.hasCustomAssumptions();
      
      if (hasCustomAssumptions) {
        const requestCost = monthlyExecutions * this.FALLBACK_EXPRESS_REQUEST_PRICE;
        const durationCost = gbSeconds * this.FALLBACK_EXPRESS_DURATION_PRICE;
        const monthlyCost = requestCost + durationCost;

        return {
          amount: monthlyCost,
          currency: 'USD',
          confidence: 'low',
          assumptions: [
            'Using fallback pricing (API error)',
            ...assumptions.slice(1),
          ],
        };
      }

      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions,
      };
    }
  }

  private buildStandardAssumptions(
    monthlyExecutions: number,
    stateTransitionsPerExecution: number,
    totalStateTransitions: number,
  ): string[] {
    const assumptions = [
      `Assumes ${monthlyExecutions.toLocaleString()} executions per month`,
      `Assumes ${stateTransitionsPerExecution} state transitions per execution`,
      `Total estimated state transitions: ${totalStateTransitions.toLocaleString()}`,
      'STANDARD workflow type',
      'Pricing: $0.025 per 1,000 state transitions',
    ];

    if (this.customMonthlyExecutions !== undefined) {
      assumptions.push('Using custom monthly executions from configuration');
    }
    if (this.customStateTransitionsPerExecution !== undefined) {
      assumptions.push('Using custom state transitions per execution from configuration');
    }

    return assumptions;
  }

  private buildExpressAssumptions(
    monthlyExecutions: number,
    averageDurationMs: number,
    gbSeconds: number,
  ): string[] {
    const assumptions = [
      `Assumes ${monthlyExecutions.toLocaleString()} executions per month`,
      `Assumes ${averageDurationMs}ms average execution duration`,
      `Total estimated GB-seconds: ${gbSeconds.toFixed(2)}`,
      'EXPRESS workflow type',
      'Pricing: $1.00 per million requests + $0.00001667 per GB-second',
      'Assumes 64MB memory allocation per execution',
    ];

    if (this.customMonthlyExecutions !== undefined) {
      assumptions.push('Using custom monthly executions from configuration');
    }
    if (this.customAverageDurationMs !== undefined) {
      assumptions.push('Using custom average duration from configuration');
    }

    return assumptions;
  }

  private hasCustomAssumptions(): boolean {
    return this.customMonthlyExecutions !== undefined ||
           this.customStateTransitionsPerExecution !== undefined ||
           this.customAverageDurationMs !== undefined;
  }
}
