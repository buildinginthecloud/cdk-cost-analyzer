import { ResourceWithId } from '../../../src/diff/types';
import { ResourceCost } from '../../../src/pricing/types';
import { ReservedInstanceAnalyzer } from '../../../src/optimization/analyzers/ReservedInstanceAnalyzer';

function makeCost(logicalId: string, type: string, amount: number): ResourceCost {
  return {
    logicalId,
    type,
    monthlyCost: { amount, currency: 'USD', confidence: 'medium', assumptions: [] },
  };
}

describe('ReservedInstanceAnalyzer', () => {
  const analyzer = new ReservedInstanceAnalyzer();

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

    it('should return false for non-RI-eligible types', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Fn', type: 'AWS::Lambda::Function', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should recommend RI for EC2 instances above threshold', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.xlarge' } },
      ];
      const costs = [makeCost('Web', 'AWS::EC2::Instance', 200)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].id).toBe('ri-Web');
      expect(recs[0].estimatedSavingsPercent).toBe(30);
      expect(recs[0].estimatedMonthlySavings).toBe(60);
      expect(recs[0].description).toContain('m5.xlarge');
    });

    it('should recommend RI for RDS instances', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: { DBInstanceClass: 'db.r5.large' } },
      ];
      const costs = [makeCost('DB', 'AWS::RDS::DBInstance', 300)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].description).toContain('RDS');
      expect(recs[0].description).toContain('db.r5.large');
    });

    it('should skip resources below minimum cost threshold', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Tiny', type: 'AWS::EC2::Instance', properties: { InstanceType: 't3.nano' } },
      ];
      const costs = [makeCost('Tiny', 'AWS::EC2::Instance', 10)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(0);
    });

    it('should skip non-eligible resource types', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Fn', type: 'AWS::Lambda::Function', properties: {} },
      ];
      const costs = [makeCost('Fn', 'AWS::Lambda::Function', 500)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(0);
    });

    it('should set high priority for large savings', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Big', type: 'AWS::EC2::Instance', properties: { InstanceType: 'm5.8xlarge' } },
      ];
      const costs = [makeCost('Big', 'AWS::EC2::Instance', 1000)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs[0].priority).toBe('high');
      expect(recs[0].estimatedMonthlySavings).toBe(300);
    });

    it('should handle ElastiCache and Redshift types', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Cache', type: 'AWS::ElastiCache::CacheCluster', properties: { CacheNodeType: 'cache.r5.large' } },
        { logicalId: 'DW', type: 'AWS::Redshift::Cluster', properties: { NodeType: 'dc2.large' } },
      ];
      const costs = [
        makeCost('Cache', 'AWS::ElastiCache::CacheCluster', 200),
        makeCost('DW', 'AWS::Redshift::Cluster', 500),
      ];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(2);
      const cacheRec = recs.find((r) => r.id === 'ri-Cache');
      const dwRec = recs.find((r) => r.id === 'ri-DW');
      expect(cacheRec!.description).toContain('ElastiCache');
      expect(dwRec!.description).toContain('Redshift');
    });

    it('should handle resources without cost data', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      expect(recs).toHaveLength(0);
    });
  });
});
