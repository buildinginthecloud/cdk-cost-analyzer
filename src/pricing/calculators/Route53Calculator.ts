import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';

export class Route53Calculator implements ResourceCostCalculator {
  private readonly HOSTED_ZONE_PRICE = 0.50;
  private readonly BASIC_HEALTH_CHECK_PRICE = 0.50;
  private readonly HTTPS_HEALTH_CHECK_PRICE = 1.00;
  private readonly STANDARD_QUERY_PRICE_PER_MILLION = 0.40;
  private readonly LATENCY_QUERY_PRICE_PER_MILLION = 0.60;
  private readonly GEO_QUERY_PRICE_PER_MILLION = 0.70;
  private readonly DEFAULT_MONTHLY_QUERIES = 1_000_000;

  constructor(
    private readonly customMonthlyQueries?: number,
  ) {}

  supports(resourceType: string): boolean {
    return (
      resourceType === 'AWS::Route53::HostedZone' ||
      resourceType === 'AWS::Route53::HealthCheck' ||
      resourceType === 'AWS::Route53::RecordSet'
    );
  }

  async calculateCost(
    resource: ResourceWithId,
    _region: string,
    _pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    switch (resource.type) {
      case 'AWS::Route53::HostedZone':
        return this.calculateHostedZoneCost();
      case 'AWS::Route53::HealthCheck':
        return this.calculateHealthCheckCost(resource);
      case 'AWS::Route53::RecordSet':
        return this.calculateRecordSetCost(resource);
      default:
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Unsupported Route 53 resource type: ${resource.type}`],
        };
    }
  }

  private calculateHostedZoneCost(): MonthlyCost {
    return {
      amount: this.HOSTED_ZONE_PRICE,
      currency: 'USD',
      confidence: 'high',
      assumptions: [
        `Hosted zone: $${this.HOSTED_ZONE_PRICE.toFixed(2)}/month`,
        'DNS query costs are calculated on RecordSet resources',
      ],
    };
  }

  private calculateHealthCheckCost(resource: ResourceWithId): MonthlyCost {
    const props = resource.properties || {};
    const healthCheckConfig = props.HealthCheckConfig as Record<string, unknown> | undefined;
    const checkType = (healthCheckConfig?.Type as string) || 'HTTP';

    const isAdvanced = ['HTTPS', 'HTTP_STR_MATCH', 'HTTPS_STR_MATCH'].includes(checkType);
    const price = isAdvanced ? this.HTTPS_HEALTH_CHECK_PRICE : this.BASIC_HEALTH_CHECK_PRICE;

    return {
      amount: price,
      currency: 'USD',
      confidence: 'high',
      assumptions: [
        `Health check (${checkType}): $${price.toFixed(2)}/month`,
      ],
    };
  }

  private calculateRecordSetCost(resource: ResourceWithId): MonthlyCost {
    const props = resource.properties || {};

    // Alias records to AWS resources are free
    if (props.AliasTarget) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'high',
        assumptions: ['Alias record to AWS resource: no query charges'],
      };
    }

    const queries = this.customMonthlyQueries ?? this.DEFAULT_MONTHLY_QUERIES;
    const queriesInMillions = queries / 1_000_000;

    let pricePerMillion = this.STANDARD_QUERY_PRICE_PER_MILLION;
    let routingType = 'standard';

    if (props.Region) {
      pricePerMillion = this.LATENCY_QUERY_PRICE_PER_MILLION;
      routingType = 'latency-based';
    } else if (props.GeoLocation) {
      pricePerMillion = this.GEO_QUERY_PRICE_PER_MILLION;
      routingType = 'geolocation';
    }

    const monthlyCost = queriesInMillions * pricePerMillion;

    return {
      amount: monthlyCost,
      currency: 'USD',
      confidence: 'medium',
      assumptions: [
        `DNS queries (${routingType}): ${queriesInMillions}M × $${pricePerMillion.toFixed(2)}/M = $${monthlyCost.toFixed(2)}/month`,
      ],
    };
  }
}
