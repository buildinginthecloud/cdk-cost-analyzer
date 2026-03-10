import { ResourceWithId } from '../../../src/diff/types';
import { ResourceCost } from '../../../src/pricing/types';
import { SpotInstanceAnalyzer } from '../../../src/optimization/analyzers/SpotInstanceAnalyzer';

function makeCost(logicalId: string, amount: number): ResourceCost {
  return {
    logicalId,
    type: 'AWS::AutoScaling::AutoScalingGroup',
    monthlyCost: { amount, currency: 'USD', confidence: 'medium', assumptions: [] },
  };
}

describe('SpotInstanceAnalyzer', () => {
  const analyzer = new SpotInstanceAnalyzer();

  describe('isApplicable', () => {
    it('should return true for ASGs', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'ASG', type: 'AWS::AutoScaling::AutoScalingGroup', properties: {} },
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

    it('should return false for non-applicable types', () => {
      expect(
        analyzer.isApplicable([
          { logicalId: 'DB', type: 'AWS::RDS::DBInstance', properties: {} },
        ]),
      ).toBe(false);
    });
  });

  describe('ASG analysis', () => {
    it('should recommend Spot for on-demand-only ASGs', async () => {
      const resources: ResourceWithId[] = [
        { logicalId: 'ASG', type: 'AWS::AutoScaling::AutoScalingGroup', properties: {} },
      ];
      const costs = [makeCost('ASG', 500)];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const spotRec = recs.find((r) => r.id === 'spot-ASG');
      expect(spotRec).toBeDefined();
      expect(spotRec!.estimatedMonthlySavings).toBe(150);
      expect(spotRec!.caveats).toEqual(
        expect.arrayContaining([expect.stringContaining('interrupted')]),
      );
    });

    it('should skip ASGs already using mixed instances with Spot', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'ASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          MixedInstancesPolicy: {
            InstancesDistribution: {
              OnDemandPercentageAboveBaseCapacity: 50,
            },
          },
        },
      }];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const spotRec = recs.find((r) => r.id === 'spot-ASG');
      expect(spotRec).toBeUndefined();
    });

    it('should recommend Spot for ASGs with 100% on-demand in mixed policy', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'ASG',
        type: 'AWS::AutoScaling::AutoScalingGroup',
        properties: {
          MixedInstancesPolicy: {
            InstancesDistribution: {
              OnDemandPercentageAboveBaseCapacity: 100,
            },
          },
        },
      }];
      const recs = await analyzer.analyze(resources, [makeCost('ASG', 400)], 'us-east-1');

      const spotRec = recs.find((r) => r.id === 'spot-ASG');
      expect(spotRec).toBeDefined();
    });
  });

  describe('ECS Fargate analysis', () => {
    it('should recommend Fargate Spot for Fargate services', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'Svc',
        type: 'AWS::ECS::Service',
        properties: { LaunchType: 'FARGATE' },
      }];
      const costs: ResourceCost[] = [{
        logicalId: 'Svc',
        type: 'AWS::ECS::Service',
        monthlyCost: { amount: 200, currency: 'USD', confidence: 'medium', assumptions: [] },
      }];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const spotRec = recs.find((r) => r.id === 'spot-ecs-Svc');
      expect(spotRec).toBeDefined();
      expect(spotRec!.title).toContain('Fargate Spot');
    });

    it('should skip non-Fargate ECS services', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'Svc',
        type: 'AWS::ECS::Service',
        properties: { LaunchType: 'EC2' },
      }];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const spotRec = recs.find((r) => r.id === 'spot-ecs-Svc');
      expect(spotRec).toBeUndefined();
    });

    it('should skip ECS services already using Spot capacity', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'Svc',
        type: 'AWS::ECS::Service',
        properties: {
          CapacityProviderStrategy: [
            { CapacityProvider: 'FARGATE', Weight: 1 },
            { CapacityProvider: 'FARGATE_SPOT', Weight: 1 },
          ],
        },
      }];
      const recs = await analyzer.analyze(resources, [], 'us-east-1');

      const spotRec = recs.find((r) => r.id === 'spot-ecs-Svc');
      expect(spotRec).toBeUndefined();
    });

    it('should analyze ECS services without explicit launch type (default Fargate)', async () => {
      const resources: ResourceWithId[] = [{
        logicalId: 'Svc',
        type: 'AWS::ECS::Service',
        properties: {},
      }];
      const costs: ResourceCost[] = [{
        logicalId: 'Svc',
        type: 'AWS::ECS::Service',
        monthlyCost: { amount: 100, currency: 'USD', confidence: 'medium', assumptions: [] },
      }];
      const recs = await analyzer.analyze(resources, costs, 'us-east-1');

      const spotRec = recs.find((r) => r.id === 'spot-ecs-Svc');
      expect(spotRec).toBeDefined();
    });
  });
});
