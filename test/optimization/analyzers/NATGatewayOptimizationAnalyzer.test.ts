import { ResourceWithId } from '../../../src/diff/types';
import { ResourceCost } from '../../../src/pricing/types';
import { NATGatewayOptimizationAnalyzer } from '../../../src/optimization/analyzers/NATGatewayOptimizationAnalyzer';

function makeCost(logicalId: string, amount: number): ResourceCost {
  return {
    logicalId,
    type: 'AWS::EC2::NatGateway',
    monthlyCost: { amount, currency: 'USD', confidence: 'medium', assumptions: [] },
  };
}

describe('NATGatewayOptimizationAnalyzer', () => {
  const analyzer = new NATGatewayOptimizationAnalyzer();

  describe('isApplicable', () => {
    it('should return true when NAT Gateways exist', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(true);
    });

    it('should return false without NAT Gateways', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(false);
    });
  });

  describe('NAT instance recommendation', () => {
    it('should suggest NAT instance replacement for each NAT Gateway', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
      ];
      const costs = [makeCost('NAT1', 32.85)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const natInstanceRec = recs.find((r) => r.id === 'nat-instance-NAT1');
      expect(natInstanceRec).toBeDefined();
      expect(natInstanceRec!.estimatedMonthlySavings).toBeGreaterThan(0);
      expect(natInstanceRec!.caveats).toEqual(
        expect.arrayContaining([expect.stringContaining('Not recommended for production')]),
      );
    });

    it('should use fallback pricing when cost data is unavailable', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const natInstanceRec = recs.find((r) => r.id === 'nat-instance-NAT1');
      expect(natInstanceRec).toBeDefined();
      expect(natInstanceRec!.estimatedMonthlySavings).toBeGreaterThan(25);
    });
  });

  describe('VPC endpoint recommendation', () => {
    it('should suggest VPC Gateway Endpoint for S3', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
        { logicalId: 'Bucket', type: 'AWS::S3::Bucket', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const vpcRec = recs.find((r) => r.id === 'vpc-gateway-endpoints');
      expect(vpcRec).toBeDefined();
      expect(vpcRec!.priority).toBe('high');
      expect(vpcRec!.actionItems).toEqual(
        expect.arrayContaining([expect.stringContaining('s3')]),
      );
    });

    it('should suggest VPC Gateway Endpoint for DynamoDB', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
        { logicalId: 'Table', type: 'AWS::DynamoDB::Table', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const vpcRec = recs.find((r) => r.id === 'vpc-gateway-endpoints');
      expect(vpcRec).toBeDefined();
      expect(vpcRec!.actionItems).toEqual(
        expect.arrayContaining([expect.stringContaining('dynamodb')]),
      );
    });

    it('should not suggest VPC endpoints when Gateway endpoints already exist', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
        { logicalId: 'Bucket', type: 'AWS::S3::Bucket', properties: {} },
        {
          logicalId: 'S3Endpoint',
          type: 'AWS::EC2::VPCEndpoint',
          properties: {
            VpcEndpointType: 'Gateway',
            ServiceName: 'com.amazonaws.us-east-1.s3',
          },
        },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const vpcRec = recs.find((r) => r.id === 'vpc-gateway-endpoints');
      expect(vpcRec).toBeUndefined();
    });

    it('should not suggest VPC endpoints when no S3/DynamoDB', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const vpcRec = recs.find((r) => r.id === 'vpc-gateway-endpoints');
      expect(vpcRec).toBeUndefined();
    });
  });

  describe('consolidation recommendation', () => {
    it('should suggest consolidation for multiple NAT Gateways', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
        { logicalId: 'NAT2', type: 'AWS::EC2::NatGateway', properties: {} },
        { logicalId: 'NAT3', type: 'AWS::EC2::NatGateway', properties: {} },
      ];
      const costs = [
        makeCost('NAT1', 32.85),
        makeCost('NAT2', 32.85),
        makeCost('NAT3', 32.85),
      ];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const consolidationRec = recs.find((r) => r.id === 'nat-consolidation');
      expect(consolidationRec).toBeDefined();
      expect(consolidationRec!.title).toContain('3 NAT Gateways');
      expect(consolidationRec!.estimatedMonthlySavings).toBeCloseTo(65.7, 0);
    });

    it('should not suggest consolidation for a single NAT Gateway', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'NAT1', type: 'AWS::EC2::NatGateway', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const consolidationRec = recs.find((r) => r.id === 'nat-consolidation');
      expect(consolidationRec).toBeUndefined();
    });
  });
});
