import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
export declare class KinesisCalculator implements ResourceCostCalculator {
    private readonly customShardCount?;
    private readonly customIngestionGB?;
    private readonly customRetrievalGB?;
    private readonly customFirehoseGB?;
    private readonly customKPUs?;
    private readonly HOURS_PER_MONTH;
    private readonly DEFAULT_SHARD_COUNT;
    private readonly FALLBACK_SHARD_PRICE;
    private readonly DEFAULT_INGESTION_GB;
    private readonly DEFAULT_RETRIEVAL_GB;
    private readonly FALLBACK_INGESTION_PRICE;
    private readonly FALLBACK_RETRIEVAL_PRICE;
    private readonly DEFAULT_FIREHOSE_GB;
    private readonly FALLBACK_FIREHOSE_PRICE;
    private readonly DEFAULT_KPUS;
    private readonly FALLBACK_KPU_PRICE;
    constructor(customShardCount?: number | undefined, customIngestionGB?: number | undefined, customRetrievalGB?: number | undefined, customFirehoseGB?: number | undefined, customKPUs?: number | undefined);
    supports(resourceType: string): boolean;
    calculateCost(resource: ResourceWithId, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
    private calculateDataStreamCost;
    private calculateOnDemandStreamCost;
    private calculateFirehoseCost;
    private calculateAnalyticsCost;
}
