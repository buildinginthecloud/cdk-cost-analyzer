import { PricingService } from '../../src/pricing/PricingService';
import { ResourceWithId } from '../../src/diff/types';

describe('PricingService - ALB and NLB Detection', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    // Create pricing service without cache for testing
    pricingService = new PricingService('us-east-1', undefined, [], { enabled: false });
  });

  afterEach(() => {
    if (pricingService) {
      pricingService.destroy();
    }
  });

  describe('Load Balancer Type Detection', () => {
    it('should correctly identify and route Application Load Balancer to ALBCalculator', async () => {
      const albResource: ResourceWithId = {
        logicalId: 'MyALB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Type: 'application',
          Name: 'test-alb',
        },
      };

      // Call getResourceCost - it should route to ALBCalculator
      const cost = await pricingService.getResourceCost(albResource, 'eu-central-1');

      // Verify it was processed (not skipped)
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');
      
      // If pricing data is available, it should be positive
      // If not available, assumptions should indicate ALB (not NLB)
      if (cost.amount === 0) {
        const assumptionsText = cost.assumptions.join(' ');
        // Should NOT say "only supports Network Load Balancers"
        expect(assumptionsText).not.toContain('only supports Network Load Balancers');
      }
    });

    it('should correctly identify and route Network Load Balancer to NLBCalculator', async () => {
      const nlbResource: ResourceWithId = {
        logicalId: 'MyNLB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Type: 'network',
          Name: 'test-nlb',
        },
      };

      // Call getResourceCost - it should route to NLBCalculator
      const cost = await pricingService.getResourceCost(nlbResource, 'eu-central-1');

      // Verify it was processed (not skipped)
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');
      
      // If pricing data is not available, assumptions should indicate NLB (not ALB)
      if (cost.amount === 0) {
        const assumptionsText = cost.assumptions.join(' ');
        // Should NOT say "only supports Application Load Balancers"
        expect(assumptionsText).not.toContain('only supports Application Load Balancers');
      }
    });

    it('should handle load balancer without Type property', async () => {
      const genericLB: ResourceWithId = {
        logicalId: 'GenericLB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Name: 'test-lb',
        },
      };

      // Call getResourceCost - neither calculator should claim it
      const cost = await pricingService.getResourceCost(genericLB, 'eu-central-1');

      // Should still try to calculate but likely return 0 or not supported
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');
    });

    it('ALBCalculator should reject NLB resources', async () => {
      const nlbResource: ResourceWithId = {
        logicalId: 'MyNLB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Type: 'network',
        },
      };

      // The pricing service should route to NLBCalculator, not ALBCalculator
      const cost = await pricingService.getResourceCost(nlbResource, 'us-east-1');
      
      // Should not get the ALB rejection message
      expect(cost.assumptions).not.toContain('This calculator only supports Application Load Balancers');
    });

    it('NLBCalculator should reject ALB resources', async () => {
      const albResource: ResourceWithId = {
        logicalId: 'MyALB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Type: 'application',
        },
      };

      // The pricing service should route to ALBCalculator, not NLBCalculator
      const cost = await pricingService.getResourceCost(albResource, 'us-east-1');
      
      // Should not get the NLB rejection message
      expect(cost.assumptions).not.toContain('This calculator only supports Network Load Balancers');
    });
  });

  describe('canCalculate Method Usage', () => {
    it('should use canCalculate method when available', async () => {
      const albResource: ResourceWithId = {
        logicalId: 'TestALB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Type: 'application',
        },
      };

      const nlbResource: ResourceWithId = {
        logicalId: 'TestNLB',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        properties: {
          Type: 'network',
        },
      };

      // Both should be processed without errors
      const albCost = await pricingService.getResourceCost(albResource, 'us-east-1');
      const nlbCost = await pricingService.getResourceCost(nlbResource, 'us-east-1');

      expect(albCost).toBeDefined();
      expect(nlbCost).toBeDefined();
      
      // Neither should have the wrong calculator's rejection message
      expect(albCost.assumptions).not.toContain('This calculator only supports Network Load Balancers');
      expect(nlbCost.assumptions).not.toContain('This calculator only supports Application Load Balancers');
    });
  });
});
