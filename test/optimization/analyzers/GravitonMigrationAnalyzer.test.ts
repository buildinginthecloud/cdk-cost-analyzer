import { ResourceWithId } from '../../../src/diff/types';
import { ResourceCost } from '../../../src/pricing/types';
import { GravitonMigrationAnalyzer } from '../../../src/optimization/analyzers/GravitonMigrationAnalyzer';

function makeCost(logicalId: string, amount: number): ResourceCost {
  return {
    logicalId,
    type: 'AWS::EC2::Instance',
    monthlyCost: { amount, currency: 'USD', confidence: 'medium', assumptions: [] },
  };
}

describe('GravitonMigrationAnalyzer', () => {
  const analyzer = new GravitonMigrationAnalyzer();

  describe('isApplicable', () => {
    it('should return true for EC2 instances', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(true);
    });

    it('should return true for RDS instances', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(true);
    });

    it('should return false for unsupported types', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Bucket', type: 'AWS::S3::Bucket', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(false);
    });
  });

  describe('EC2 analysis', () => {
    it('should recommend Graviton for m5 instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.xlarge' } },
      ];
      const costs = [makeCost('Web', 140)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('m7g.xlarge');
      expect(recs[0].estimatedSavingsPercent).toBe(20);
      expect(recs[0].estimatedMonthlySavings).toBe(28);
    });

    it('should recommend Graviton for c5a instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Compute', type: 'AWS::EC2::Instance', properties: { InstanceType: 'c5a.2xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Compute', 200)], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('c7g.2xlarge');
    });

    it('should recommend Graviton for t3 instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Dev', type: 'AWS::EC2::Instance', properties: { InstanceType: 't3.medium' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Dev', 30)], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('t4g.medium');
    });

    it('should skip instances already using Graviton', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm7g.xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });

    it('should skip instances without InstanceType', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });

    it('should handle LaunchTemplate InstanceType', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'LT',
        type: 'AWS::EC2::LaunchTemplate',
        properties: { LaunchTemplateData: { InstanceType: 'm5.large' } },
      }];
      const recs = await analyzer.analyze(resources, [makeCost('LT', 70)], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('m7g.large');
    });
  });

  describe('RDS analysis', () => {
    it('should recommend Graviton for db.m5 instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: { DBInstanceClass: 'db.m5.large' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('DB', 175)], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('db.m7g.large');
      expect(recs[0].estimatedMonthlySavings).toBe(35);
    });

    it('should recommend Graviton for db.r5 instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: { DBInstanceClass: 'db.r5.xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('DB', 300)], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('db.r7g.xlarge');
      expect(recs[0].priority).toBe('high');
    });

    it('should skip already Graviton RDS instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: { DBInstanceClass: 'db.r7g.large' } },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });
  });

  describe('ElastiCache analysis', () => {
    it('should recommend Graviton for cache.m5 nodes', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Cache', type: 'AWS::ElastiCache::CacheCluster', properties: { CacheNodeType: 'cache.m5.large' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Cache', 100)], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('cache.m7g.large');
    });

    it('should skip Graviton ElastiCache nodes', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Cache', type: 'AWS::ElastiCache::CacheCluster', properties: { CacheNodeType: 'cache.m7g.large' } },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });
  });

  describe('priority levels', () => {
    it('should set high priority when savings >= $50', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Big', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.4xlarge' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Big', 500)], 'us-east-1');
      expect(recs[0].priority).toBe('high');
    });

    it('should set low priority when savings < $20', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Small', type: 'AWS::EC2::Instance', properties: { InstanceType: 't3.micro' } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Small', 10)], 'us-east-1');
      expect(recs[0].priority).toBe('low');
    });
  });
});
