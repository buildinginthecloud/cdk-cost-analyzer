import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

// DPU per worker per Glue worker type.
// @see https://docs.aws.amazon.com/glue/latest/dg/add-job.html
const DPU_PER_WORKER: Record<string, number> = {
  Standard: 4,
  'G.1X': 1,
  'G.2X': 2,
  'G.4X': 4,
  'G.8X': 8,
  'G.025X': 0.25,
  'Z.2X': 2,
};

const DEFAULT_DPUS_GLUE_JOB = 2;
const DEFAULT_DPUS_GLUE_CRAWLER = 2;

/**
 * Calculator for AWS Glue job and crawler costs.
 *
 * Estimates monthly costs based on DPU-hours consumed:
 *   DPUs × hoursPerMonth × $0.44/DPU-hour
 *
 * DPUs are derived from CloudFormation properties when available:
 * - Jobs: `WorkerType` + `NumberOfWorkers`, or legacy `MaxCapacity`
 * - Crawlers: not in the resource properties — defaults to 2 DPU
 *
 * @see https://aws.amazon.com/glue/pricing/
 */
export class GlueCalculator implements ResourceCostCalculator {
  private readonly DPU_HOUR_COST = 0.44;
  private readonly DEFAULT_HOURS_PER_MONTH = 50;

  /**
   * @param customHoursPerMonth - Hours per month the job/crawler runs (default: 50)
   */
  constructor(private readonly customHoursPerMonth?: number) {}

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::Glue::Job' || resourceType === 'AWS::Glue::Crawler';
  }

  async calculateCost(
    resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const hoursPerMonth = this.customHoursPerMonth ?? this.DEFAULT_HOURS_PER_MONTH;
    const { dpus, dpuSource } = this.resolveDpus(resource);
    const dpuHours = dpus * hoursPerMonth;
    const cost = dpuHours * this.DPU_HOUR_COST;

    const assumptions = [
      `DPUs: ${dpus} (${dpuSource})`,
      `Hours per month: ${hoursPerMonth}`,
      `DPU-hour rate: $${this.DPU_HOUR_COST}/DPU-hour`,
      `Cost: ${dpus} DPU × ${hoursPerMonth}h × $${this.DPU_HOUR_COST} = $${cost.toFixed(2)}/month`,
      'Data Catalog: first 1M objects and requests are free (not included)',
    ];

    if (this.customHoursPerMonth !== undefined) {
      assumptions.push(`Using custom hoursPerMonth from configuration: ${hoursPerMonth}`);
    }

    return {
      amount: cost,
      currency: 'USD',
      confidence: 'medium',
      assumptions,
    };
  }

  private resolveDpus(resource: ResourceWithId): { dpus: number; dpuSource: string } {
    if (resource.type === 'AWS::Glue::Crawler') {
      return { dpus: DEFAULT_DPUS_GLUE_CRAWLER, dpuSource: 'crawler default (Glue::Crawler has no DPU properties)' };
    }

    // Modern API: WorkerType + NumberOfWorkers
    const workerType = resource.properties.WorkerType as string | undefined;
    const numberOfWorkers = resource.properties.NumberOfWorkers as number | undefined;
    if (workerType && typeof numberOfWorkers === 'number') {
      const dpuPerWorker = DPU_PER_WORKER[workerType];
      if (dpuPerWorker !== undefined) {
        return {
          dpus: dpuPerWorker * numberOfWorkers,
          dpuSource: `${numberOfWorkers} × ${workerType} (${dpuPerWorker} DPU/worker)`,
        };
      }
    }

    // Legacy: MaxCapacity (set on Python shell or legacy Spark jobs)
    const maxCapacity = resource.properties.MaxCapacity as number | undefined;
    if (typeof maxCapacity === 'number') {
      return { dpus: maxCapacity, dpuSource: `MaxCapacity property: ${maxCapacity} DPU` };
    }

    return { dpus: DEFAULT_DPUS_GLUE_JOB, dpuSource: `default ${DEFAULT_DPUS_GLUE_JOB} DPU (no WorkerType/MaxCapacity in template)` };
  }
}
