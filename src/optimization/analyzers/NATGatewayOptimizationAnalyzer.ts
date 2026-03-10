import { ResourceWithId } from '../../diff/types';
import { ResourceCost } from '../../pricing/types';
import {
  OptimizationAnalyzer,
  OptimizationCategory,
  Recommendation,
} from '../types';

const NAT_GATEWAY_HOURLY = 0.045;
const NAT_INSTANCE_T3_NANO_HOURLY = 0.0052;
const HOURS_PER_MONTH = 730;

export class NATGatewayOptimizationAnalyzer implements OptimizationAnalyzer {
  readonly category: OptimizationCategory = 'nat-gateway-optimization';
  readonly name = 'NAT Gateway Optimization';

  isApplicable(resources: ResourceWithId[]): boolean {
    return resources.some((r) => r.type === 'AWS::EC2::NatGateway');
  }

  async analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    _region: string,
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const natGateways = resources.filter(
      (r) => r.type === 'AWS::EC2::NatGateway',
    );

    for (const natGw of natGateways) {
      recommendations.push(
        this.suggestNATInstanceForDev(natGw, resourceCosts),
      );
    }

    const vpcEndpointRec = this.suggestVPCEndpoints(resources, natGateways);
    if (vpcEndpointRec) {
      recommendations.push(vpcEndpointRec);
    }

    if (natGateways.length > 1) {
      const consolidationRec = this.suggestConsolidation(
        natGateways,
        resourceCosts,
      );
      if (consolidationRec) {
        recommendations.push(consolidationRec);
      }
    }

    return recommendations;
  }

  private suggestNATInstanceForDev(
    natGw: ResourceWithId,
    resourceCosts: ResourceCost[],
  ): Recommendation {
    const natCost = this.findCost(natGw.logicalId, resourceCosts);
    const natInstanceCost = NAT_INSTANCE_T3_NANO_HOURLY * HOURS_PER_MONTH;
    const savings = natCost > 0
      ? natCost - natInstanceCost
      : (NAT_GATEWAY_HOURLY * HOURS_PER_MONTH) - natInstanceCost;
    const savingsPercent = natCost > 0
      ? Math.round((savings / natCost) * 100)
      : 88;

    return {
      id: `nat-instance-${natGw.logicalId}`,
      title: `Replace ${natGw.logicalId} with NAT instance (dev/test)`,
      description: `NAT Gateways cost ~$${(NAT_GATEWAY_HOURLY * HOURS_PER_MONTH).toFixed(2)}/month. A t3.nano NAT instance costs ~$${natInstanceCost.toFixed(2)}/month. For non-production environments, a NAT instance provides significant savings.`,
      category: this.category,
      priority: 'medium',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: savingsPercent,
      affectedResources: [natGw.logicalId],
      actionItems: [
        'Replace NAT Gateway with a t3.nano or t4g.nano EC2 instance configured as NAT',
        'Enable source/destination check disable on the NAT instance',
        'Update route tables to point to the NAT instance',
        'Configure auto-recovery for the NAT instance',
      ],
      caveats: [
        'Not recommended for production (single point of failure)',
        'Lower throughput and no built-in redundancy',
        'Requires manual patching and maintenance',
        'Only suitable for dev/test/staging environments',
      ],
    };
  }

  private suggestVPCEndpoints(
    resources: ResourceWithId[],
    natGateways: ResourceWithId[],
  ): Recommendation | null {
    const hasS3 = resources.some((r) => r.type === 'AWS::S3::Bucket');
    const hasDynamoDB = resources.some(
      (r) => r.type === 'AWS::DynamoDB::Table',
    );

    if (!hasS3 && !hasDynamoDB) return null;

    const existingGatewayEndpoints = resources.filter((r) => {
      if (r.type !== 'AWS::EC2::VPCEndpoint') return false;
      const vpcEndpointType = r.properties.VpcEndpointType as string;
      return !vpcEndpointType || vpcEndpointType === 'Gateway';
    });

    const existingServices = existingGatewayEndpoints.map(
      (r) => r.properties.ServiceName as string,
    );
    const missingEndpoints: string[] = [];

    if (
      hasS3 &&
      !existingServices.some((s) => s?.includes('s3'))
    ) {
      missingEndpoints.push('com.amazonaws.REGION.s3');
    }
    if (
      hasDynamoDB &&
      !existingServices.some((s) => s?.includes('dynamodb'))
    ) {
      missingEndpoints.push('com.amazonaws.REGION.dynamodb');
    }

    if (missingEndpoints.length === 0) return null;

    const natIds = natGateways.map((n) => n.logicalId);
    const services = missingEndpoints
      .map((s) => s.split('.').pop())
      .join(', ');

    return {
      id: 'vpc-gateway-endpoints',
      title: `Add VPC Gateway Endpoints for ${services}`,
      description: `S3 and DynamoDB Gateway Endpoints are free and route traffic directly to the service, bypassing NAT Gateway. This eliminates NAT Gateway data processing charges ($0.045/GB) for these services.`,
      category: this.category,
      priority: 'high',
      estimatedMonthlySavings: 0,
      estimatedSavingsPercent: 0,
      affectedResources: natIds,
      actionItems: missingEndpoints.map(
        (ep) => `Add VPC Gateway Endpoint for ${ep}`,
      ),
      caveats: [
        'Savings depend on data transfer volume to S3/DynamoDB',
        'Gateway Endpoints are free; savings come from reduced NAT Gateway data processing',
        'Update route tables to include the Gateway Endpoint',
      ],
    };
  }

  private suggestConsolidation(
    natGateways: ResourceWithId[],
    resourceCosts: ResourceCost[],
  ): Recommendation | null {
    if (natGateways.length <= 1) return null;

    const totalCost = natGateways.reduce(
      (sum, ng) => sum + this.findCost(ng.logicalId, resourceCosts),
      0,
    );
    const perGatewayCost =
      totalCost > 0
        ? totalCost / natGateways.length
        : NAT_GATEWAY_HOURLY * HOURS_PER_MONTH;
    const savings = perGatewayCost * (natGateways.length - 1);

    return {
      id: 'nat-consolidation',
      title: `Consolidate ${natGateways.length} NAT Gateways (dev/test)`,
      description: `${natGateways.length} NAT Gateways detected. For non-production environments, a single NAT Gateway may be sufficient, saving ~$${savings.toFixed(2)}/month.`,
      category: this.category,
      priority: savings >= 50 ? 'high' : 'medium',
      estimatedMonthlySavings: Math.round(savings * 100) / 100,
      estimatedSavingsPercent: Math.round(
        ((natGateways.length - 1) / natGateways.length) * 100,
      ),
      affectedResources: natGateways.map((n) => n.logicalId),
      actionItems: [
        'Evaluate if multi-AZ NAT Gateway redundancy is needed for this environment',
        'Route all private subnets through a single NAT Gateway',
        `Remove ${natGateways.length - 1} redundant NAT Gateways`,
      ],
      caveats: [
        'Not recommended for production (single AZ failure risk)',
        'Cross-AZ data transfer charges may apply (~$0.01/GB)',
        'Only suitable for non-production environments',
      ],
    };
  }

  private findCost(logicalId: string, resourceCosts: ResourceCost[]): number {
    const cost = resourceCosts.find((c) => c.logicalId === logicalId);
    return cost?.monthlyCost.amount ?? 0;
  }
}
