import { ResourceWithId, ResourceDiff } from '../diff/types';
import {
  PricingService as IPricingService,
  MonthlyCost,
  CostDelta,
  ResourceCostCalculator,
} from './types';
import { PricingClient } from './PricingClient';
import { EC2Calculator } from './calculators/EC2Calculator';
import { S3Calculator } from './calculators/S3Calculator';
import { LambdaCalculator } from './calculators/LambdaCalculator';
import { RDSCalculator } from './calculators/RDSCalculator';

export class PricingService implements IPricingService {
  private calculators: ResourceCostCalculator[];
  private pricingClient: PricingClient;

  constructor(region: string = 'us-east-1') {
    this.pricingClient = new PricingClient(region);
    this.calculators = [
      new EC2Calculator(),
      new S3Calculator(),
      new LambdaCalculator(),
      new RDSCalculator(),
    ];
  }

  async getResourceCost(resource: ResourceWithId, region: string): Promise<MonthlyCost> {
    const calculator = this.calculators.find(calc => calc.supports(resource.type));

    if (!calculator) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Resource type ${resource.type} is not supported`],
      };
    }

    try {
      return await calculator.calculateCost(resource, region, this.pricingClient);
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to calculate cost: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  async getCostDelta(diff: ResourceDiff, region: string): Promise<CostDelta> {
    const addedCosts = await Promise.all(
      diff.added.map(async (resource) => {
        const monthlyCost = await this.getResourceCost(resource, region);
        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost,
        };
      })
    );

    const removedCosts = await Promise.all(
      diff.removed.map(async (resource) => {
        const monthlyCost = await this.getResourceCost(resource, region);
        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost,
        };
      })
    );

    const modifiedCosts = await Promise.all(
      diff.modified.map(async (resource) => {
        const oldResource: ResourceWithId = {
          logicalId: resource.logicalId,
          type: resource.type,
          properties: resource.oldProperties,
        };
        const newResource: ResourceWithId = {
          logicalId: resource.logicalId,
          type: resource.type,
          properties: resource.newProperties,
        };

        const oldMonthlyCost = await this.getResourceCost(oldResource, region);
        const newMonthlyCost = await this.getResourceCost(newResource, region);
        const costDelta = newMonthlyCost.amount - oldMonthlyCost.amount;

        return {
          logicalId: resource.logicalId,
          type: resource.type,
          monthlyCost: newMonthlyCost,
          oldMonthlyCost,
          newMonthlyCost,
          costDelta,
        };
      })
    );

    const totalAddedCost = addedCosts.reduce((sum, r) => sum + r.monthlyCost.amount, 0);
    const totalRemovedCost = removedCosts.reduce((sum, r) => sum + r.monthlyCost.amount, 0);
    const totalModifiedDelta = modifiedCosts.reduce((sum, r) => sum + r.costDelta, 0);

    const totalDelta = totalAddedCost - totalRemovedCost + totalModifiedDelta;

    return {
      totalDelta,
      currency: 'USD',
      addedCosts,
      removedCosts,
      modifiedCosts,
    };
  }
}
