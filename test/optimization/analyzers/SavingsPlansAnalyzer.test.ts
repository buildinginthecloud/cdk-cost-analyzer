import { ResourceWithId } from '../../../src/diff/types';
import { ResourceCost } from '../../../src/pricing/types';
import { SavingsPlansAnalyzer } from '../../../src/optimization/analyzers/SavingsPlansAnalyzer';

function makeCost(logicalId: string, type: string, amount: number): ResourceCost {
  return {
    logicalId,
    type,
    monthlyCost: { amount, currency: 'USD', confidence: 'medium', assumptions: [] },
  };
}

describe('SavingsPlansAnalyzer', () => {
  const analyzer = new SavingsPlansAnalyzer();

  describe('isApplicable', () => {
    it('should return true for EC2 instances', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
        ]),
      ).toBe(true);
    });

    it('should return true for Lambda functions', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'Fn', type: 'AWS::Lambda::Function', properties: {} },
        ]),
      ).toBe(true);
    });

    it('should return true for ECS services', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'Svc', type: 'AWS::ECS::Service', properties: {} },
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
    it('should recommend Compute Savings Plan for mixed compute resources', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web', type: 'AWS::EC2::Instance', properties: {} },
        { logicalId: 'Fn', type: 'AWS::Lambda::Function', properties: {} },
      ];
      const costs = [
        makeCost('Web', 'AWS::EC2::Instance', 200),
        makeCost('Fn', 'AWS::Lambda::Function', 100),
      ];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const computeSP = recs.find((r) => r.id === 'compute-savings-plan');
      expect(computeSP).toBeDefined();
      expect(computeSP!.estimatedMonthlySavings).toBe(90);
      expect(computeSP!.description).toContain('across EC2, Fargate, and Lambda');
    });

    it('should recommend EC2 Instance Savings Plan when EC2 cost is significant', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Web1', type: 'AWS::EC2::Instance', properties: {} },
        { logicalId: 'Web2', type: 'AWS::EC2::Instance', properties: {} },
      ];
      const costs = [
        makeCost('Web1', 'AWS::EC2::Instance', 300),
        makeCost('Web2', 'AWS::EC2::Instance', 200),
      ];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const ec2SP = recs.find((r) => r.id === 'ec2-savings-plan');
      expect(ec2SP).toBeDefined();
      expect(ec2SP!.estimatedSavingsPercent).toBe(35);
    });

    it('should skip when aggregate compute cost is below threshold', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Fn', type: 'AWS::Lambda::Function', properties: {} },
      ];
      const costs = [makeCost('Fn', 'AWS::Lambda::Function', 20)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs).toHaveLength(0);
    });

    it('should handle ASG and ECS task definitions as compute', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'ASG', type: 'AWS::AutoScaling::AutoScalingGroup', properties: {} },
        { logicalId: 'Task', type: 'AWS::ECS::TaskDefinition', properties: {} },
      ];
      const costs = [
        makeCost('ASG', 'AWS::AutoScaling::AutoScalingGroup', 500),
        makeCost('Task', 'AWS::ECS::TaskDefinition', 300),
      ];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      expect(recs.length).toBeGreaterThanOrEqual(1);
      const computeSP = recs.find((r) => r.id === 'compute-savings-plan');
      expect(computeSP!.affectedResources).toContain('ASG');
      expect(computeSP!.affectedResources).toContain('Task');
    });

    it('should not recommend EC2 SP when only Lambda exists', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Fn1', type: 'AWS::Lambda::Function', properties: {} },
        { logicalId: 'Fn2', type: 'AWS::Lambda::Function', properties: {} },
      ];
      const costs = [
        makeCost('Fn1', 'AWS::Lambda::Function', 100),
        makeCost('Fn2', 'AWS::Lambda::Function', 100),
      ];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const ec2SP = recs.find((r) => r.id === 'ec2-savings-plan');
      expect(ec2SP).toBeUndefined();
    });

    it('should set high priority for large compute savings', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'Big', type: 'AWS::EC2::Instance', properties: {} },
      ];
      const costs = [makeCost('Big', 'AWS::EC2::Instance', 2000)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const computeSP = recs.find((r) => r.id === 'compute-savings-plan');
      expect(computeSP!.priority).toBe('high');
    });
  });
});
