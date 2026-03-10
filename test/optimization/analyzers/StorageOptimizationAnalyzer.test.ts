import { ResourceWithId } from '../../../src/diff/types';
import { ResourceCost } from '../../../src/pricing/types';
import { StorageOptimizationAnalyzer } from '../../../src/optimization/analyzers/StorageOptimizationAnalyzer';

function makeCost(logicalId: string, amount: number): ResourceCost {
  return {
    logicalId,
    type: 'AWS::EC2::Volume',
    monthlyCost: { amount, currency: 'USD', confidence: 'medium', assumptions: [] },
  };
}

describe('StorageOptimizationAnalyzer', () => {
  const analyzer = new StorageOptimizationAnalyzer();

  describe('isApplicable', () => {
    it('should return true for S3 buckets', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Bucket', type: 'AWS::S3::Bucket', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(true);
    });

    it('should return true for EBS volumes', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Vol', type: 'AWS::EC2::Volume', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(true);
    });

    it('should return false for non-storage types', () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
      ];
      expect(analyzer.isApplicable(resources)).toBe(false);
    });
  });

  describe('S3 bucket analysis', () => {
    it('should recommend lifecycle rules and Intelligent-Tiering for bare bucket', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Bucket', type: 'AWS::S3::Bucket', properties: {} },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('Bucket');
      expect(recs[0].actionItems.length).toBeGreaterThanOrEqual(2);
    });

    it('should skip buckets with lifecycle and Intelligent-Tiering', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'Bucket',
        type: 'AWS::S3::Bucket',
        properties: {
          LifecycleConfiguration: { Rules: [] },
          IntelligentTieringConfigurations: [{}],
        },
      }];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });

    it('should recommend Intelligent-Tiering when only lifecycle exists', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'Bucket',
        type: 'AWS::S3::Bucket',
        properties: { LifecycleConfiguration: { Rules: [] } },
      }];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].actionItems).toEqual(
        expect.arrayContaining([expect.stringContaining('Intelligent-Tiering')]),
      );
    });
  });

  describe('EBS volume analysis', () => {
    it('should recommend gp3 for gp2 volumes', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Vol', type: 'AWS::EC2::Volume', properties: { VolumeType: 'gp2', Size: 500 } },
      ];
      const costs = [makeCost('Vol', 50)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('gp3');
      expect(recs[0].estimatedMonthlySavings).toBe(10);
      expect(recs[0].description).toContain('500 GB');
    });

    it('should recommend gp3 for volumes without explicit type (default gp2)', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Vol', type: 'AWS::EC2::Volume', properties: { Size: 100 } },
      ];
      const recs = await analyzer.analyze(resources, [makeCost('Vol', 10)], 'us-east-1');
      expect(recs).toHaveLength(1);
    });

    it('should skip gp3 volumes', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Vol', type: 'AWS::EC2::Volume', properties: { VolumeType: 'gp3' } },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });

    it('should skip io1/io2 volumes', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Vol', type: 'AWS::EC2::Volume', properties: { VolumeType: 'io2' } },
      ];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });
  });

  describe('LaunchTemplate EBS analysis', () => {
    it('should recommend gp3 for gp2 block devices in launch templates', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'LT',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            BlockDeviceMappings: [
              { DeviceName: '/dev/xvda', Ebs: { VolumeType: 'gp2', VolumeSize: 50 } },
            ],
          },
        },
      }];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      expect(recs).toHaveLength(1);
      expect(recs[0].title).toContain('/dev/xvda');
    });

    it('should skip launch templates with gp3 EBS', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'LT',
        type: 'AWS::EC2::LaunchTemplate',
        properties: {
          LaunchTemplateData: {
            BlockDeviceMappings: [
              { DeviceName: '/dev/xvda', Ebs: { VolumeType: 'gp3' } },
            ],
          },
        },
      }];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');
      expect(recs).toHaveLength(0);
    });
  });
});
