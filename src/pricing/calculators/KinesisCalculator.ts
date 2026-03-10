import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class KinesisCalculator implements ResourceCostCalculator {
  private readonly HOURS_PER_MONTH = 730;

  // Data Streams - Provisioned
  private readonly DEFAULT_SHARD_COUNT = 2;
  private readonly FALLBACK_SHARD_PRICE = 0.015;

  // Data Streams - On-Demand
  private readonly DEFAULT_INGESTION_GB = 1000;
  private readonly DEFAULT_RETRIEVAL_GB = 2000;
  private readonly FALLBACK_INGESTION_PRICE = 0.040;
  private readonly FALLBACK_RETRIEVAL_PRICE = 0.015;

  // Firehose
  private readonly DEFAULT_FIREHOSE_GB = 1000;
  private readonly FALLBACK_FIREHOSE_PRICE = 0.029;

  // Analytics
  private readonly DEFAULT_KPUS = 2;
  private readonly FALLBACK_KPU_PRICE = 0.11;

  constructor(
    private readonly customShardCount?: number,
    private readonly customIngestionGB?: number,
    private readonly customRetrievalGB?: number,
    private readonly customFirehoseGB?: number,
    private readonly customKPUs?: number,
  ) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::Kinesis::Stream' ||
      resourceType === 'AWS::KinesisFirehose::DeliveryStream' ||
      resourceType === 'AWS::KinesisAnalyticsV2::Application'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    try {
      switch (resource.type) {
        case 'AWS::Kinesis::Stream':
          return await this.calculateDataStreamCost(resource, region, pricingClient);
        case 'AWS::KinesisFirehose::DeliveryStream':
          return this.calculateFirehoseCost();
        case 'AWS::KinesisAnalyticsV2::Application':
          return this.calculateAnalyticsCost();
        default:
          return {
            amount: 0,
            currency: 'USD',
            confidence: 'unknown',
            assumptions: [`Unsupported Kinesis resource type: ${resource.type}`],
          };
      }
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private async calculateDataStreamCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const props = resource.properties || {};
    const streamModeDetails = props.StreamModeDetails as Record<string, unknown> | undefined;
    const streamMode = (streamModeDetails?.StreamMode as string) || 'PROVISIONED';

    if (streamMode === 'ON_DEMAND') {
      return this.calculateOnDemandStreamCost();
    }

    const shardCount = this.customShardCount
      ?? (props.ShardCount as number | undefined)
      ?? this.DEFAULT_SHARD_COUNT;

    const shardPrice = await pricingClient.getPrice({
      serviceCode: 'AmazonKinesis',
      region: normalizeRegion(region),
      filters: [
        { field: 'productFamily', value: 'Kinesis Streams' },
        { field: 'usagetype', value: 'shardHour-Provisioned' },
      ],
    });

    const rate = shardPrice ?? this.FALLBACK_SHARD_PRICE;
    const monthlyCost = shardCount * rate * this.HOURS_PER_MONTH;

    return {
      amount: monthlyCost,
      currency: 'USD',
      confidence: shardPrice !== null ? 'high' : 'medium',
      assumptions: [
        `Provisioned mode: ${shardCount} shards × $${rate.toFixed(4)}/shard-hour × ${this.HOURS_PER_MONTH}h = $${monthlyCost.toFixed(2)}/month`,
        ...(shardPrice === null ? [`Using fallback pricing (API data not available for region ${region})`] : []),
      ],
    };
  }

  private calculateOnDemandStreamCost(): MonthlyCost {
    const ingestionGB = this.customIngestionGB ?? this.DEFAULT_INGESTION_GB;
    const retrievalGB = this.customRetrievalGB ?? this.DEFAULT_RETRIEVAL_GB;

    const ingestionCost = ingestionGB * this.FALLBACK_INGESTION_PRICE;
    const retrievalCost = retrievalGB * this.FALLBACK_RETRIEVAL_PRICE;
    const totalCost = ingestionCost + retrievalCost;

    return {
      amount: totalCost,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `On-demand mode`,
        `Ingestion: ${ingestionGB} GB × $${this.FALLBACK_INGESTION_PRICE}/GB = $${ingestionCost.toFixed(2)}/month`,
        `Retrieval: ${retrievalGB} GB × $${this.FALLBACK_RETRIEVAL_PRICE}/GB = $${retrievalCost.toFixed(2)}/month`,
      ],
    };
  }

  private calculateFirehoseCost(): MonthlyCost {
    const dataGB = this.customFirehoseGB ?? this.DEFAULT_FIREHOSE_GB;
    const monthlyCost = dataGB * this.FALLBACK_FIREHOSE_PRICE;

    return {
      amount: monthlyCost,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `Firehose ingestion: ${dataGB} GB × $${this.FALLBACK_FIREHOSE_PRICE}/GB = $${monthlyCost.toFixed(2)}/month`,
        'Does not include format conversion or VPC delivery costs',
      ],
    };
  }

  private calculateAnalyticsCost(): MonthlyCost {
    const kpus = this.customKPUs ?? this.DEFAULT_KPUS;
    const monthlyCost = kpus * this.FALLBACK_KPU_PRICE * this.HOURS_PER_MONTH;

    return {
      amount: monthlyCost,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `Kinesis Analytics: ${kpus} KPUs × $${this.FALLBACK_KPU_PRICE}/KPU-hour × ${this.HOURS_PER_MONTH}h = $${monthlyCost.toFixed(2)}/month`,
        '1 KPU = 1 vCPU + 4 GB memory',
      ],
    };
  }
}
