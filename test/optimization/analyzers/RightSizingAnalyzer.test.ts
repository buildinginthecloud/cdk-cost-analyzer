import { ResourceWithId } from '../../../src/diff/types';
import { ResourceCost } from '../../../src/pricing/types';
import { RightSizingAnalyzer } from '../../../src/optimization/analyzers/RightSizingAnalyzer';

function makeCost(logicalId: string, amount: number): ResourceCost {
  return {
    logicalId,
    type: 'AWS::EC2::Instance',
    monthlyCost: { amount, currency: 'USD', confidence: 'medium', assumptions: [] },
  };
}

describe('RightSizingAnalyzer', () => {
  const analyzer = new RightSizingAnalyzer();

  describe('isApplicable', () => {
    it('should return true for EC2 instances', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
        ]),
      ).toBe(true);
    });

    it('should return true for RDS instances', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: {} },
        ]),
      ).toBe(true);
    });

    it('should return false for non-compute types', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'Bucket', type: 'AWS::S3::Bucket', properties: {} },
        ]),
      ).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should recommend downsizing for 2xlarge EC2 instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.2xlarge' } },
      ];
      const costs = [makeCost('Web', 280)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('m5.2xlarge');
      expect(recs[0].description).toContain('m5.xlarge');
      expect(recs[0].estimatedMonthlySavings).toBe(140);
    });

    it('should recommend downsizing for 4xlarge instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Big', type: 'AWS::EC2::Instance', properties: { InstanceType: 'c5.4xlarge' } },
      ];
      const costs = [makeCost('Big', 500)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].description).toContain('c5.2xlarge');
    });

    it('should not recommend downsizing for xlarge and smaller', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Small', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Small', 140)], 'us-east-1');
      expect(recs).toHaveLength(0);
    });

    it('should not recommend downsizing for small instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Tiny', type: 'AWS::EC2::Instance', properties: { InstanceType: 't3.small' } },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });

    it('should handle RDS instance classes', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: { DBInstanceClass: 'db.r5.2xlarge' } },
      ];
      const costs = [makeCost('DB', 400)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].description).toContain('db.r5.xlarge');
    });

    it('should handle ElastiCache node types', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Cache', type: 'AWS::ElastiCache::CacheCluster', properties: { CacheNodeType: 'cache.r5.2xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Cache', 300)], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].description).toContain('cache.r5.xlarge');
    });

    it('should skip resources without instance type', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });

    it('should set high priority for savings >= $100', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Big', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.4xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Big', 500)], 'us-east-1');
      expect(recs[0].priority).toBe('high');
    });

    it('should include CloudWatch monitoring in action items', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.2xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Web', 280)], 'us-east-1');
      expect(recs[0].actionItems).toEqual(
        expect.arrayContaining([expect.stringContaining('CloudWatch')]),
      );
    });
  });
});
