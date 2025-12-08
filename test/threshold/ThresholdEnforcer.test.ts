import { describe, it, expect, beforeEach } from 'vitest';
import { ThresholdEnforcer } from '../../src/threshold/ThresholdEnforcer';
import { ThresholdConfig } from '../../src/config/types';
import { ResourceCost } from '../../src/pricing/types';

describe('ThresholdEnforcer', () => {
  let enforcer: ThresholdEnforcer;

  beforeEach(() => {
    enforcer = new ThresholdEnforcer();
  });

  describe('evaluateThreshold', () => {
    it('should pass when no thresholds configured', () => {
      const result = enforcer.evaluateThreshold(100, [], []);
      
      expect(result.passed).toBe(true);
      expect(result.level).toBe('none');
      expect(result.delta).toBe(100);
    });

    it('should pass when delta is below warning threshold', () => {
      const config: ThresholdConfig = {
        default: {
          warning: 100,
          error: 200,
        },
      };

      const result = enforcer.evaluateThreshold(50, [], [], config);
      
      expect(result.passed).toBe(true);
      expect(result.level).toBe('none');
    });

    it('should warn when delta exceeds warning threshold', () => {
      const config: ThresholdConfig = {
        default: {
          warning: 50,
          error: 200,
        },
      };

      const result = enforcer.evaluateThreshold(100, [], [], config);
      
      expect(result.passed).toBe(true);
      expect(result.level).toBe('warning');
      expect(result.threshold).toBe(50);
      expect(result.message).toContain('warning threshold');
    });

    it('should fail when delta exceeds error threshold', () => {
      const config: ThresholdConfig = {
        default: {
          warning: 50,
          error: 100,
        },
      };

      const result = enforcer.evaluateThreshold(150, [], [], config);
      
      expect(result.passed).toBe(false);
      expect(result.level).toBe('error');
      expect(result.threshold).toBe(100);
      expect(result.message).toContain('error threshold');
    });

    it('should use environment-specific thresholds when available', () => {
      const config: ThresholdConfig = {
        default: {
          warning: 100,
          error: 200,
        },
        environments: {
          production: {
            warning: 25,
            error: 50,
          },
        },
      };

      // Delta of 60 exceeds production error threshold of 50
      const result = enforcer.evaluateThreshold(60, [], [], config, 'production');
      
      expect(result.passed).toBe(false);
      expect(result.level).toBe('error');
      expect(result.threshold).toBe(50);
    });

    it('should fallback to default thresholds when environment not found', () => {
      const config: ThresholdConfig = {
        default: {
          warning: 100,
          error: 200,
        },
        environments: {
          production: {
            warning: 25,
            error: 50,
          },
        },
      };

      // Delta of 250 exceeds default error threshold of 200
      const result = enforcer.evaluateThreshold(250, [], [], config, 'development');
      
      expect(result.passed).toBe(false);
      expect(result.level).toBe('error');
      expect(result.threshold).toBe(200); // Uses default
    });

    it('should provide recommendations on threshold violations', () => {
      const config: ThresholdConfig = {
        default: {
          error: 100,
        },
      };

      const addedResources: ResourceCost[] = [
        {
          logicalId: 'MyRDS',
          type: 'AWS::RDS::DBInstance',
          monthlyCost: {
            amount: 150,
            currency: 'USD',
            confidence: 'high',
            assumptions: [],
          },
        },
      ];

      const result = enforcer.evaluateThreshold(150, addedResources, [], config);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('RDS'))).toBe(true);
    });

    it('should identify top cost contributors', () => {
      const config: ThresholdConfig = {
        default: {
          warning: 50,
        },
      };

      const addedResources: ResourceCost[] = [
        {
          logicalId: 'Resource1',
          type: 'AWS::EC2::Instance',
          monthlyCost: {
            amount: 30,
            currency: 'USD',
            confidence: 'high',
            assumptions: [],
          },
        },
        {
          logicalId: 'Resource2',
          type: 'AWS::EC2::Instance',
          monthlyCost: {
            amount: 50,
            currency: 'USD',
            confidence: 'high',
            assumptions: [],
          },
        },
      ];

      const result = enforcer.evaluateThreshold(80, addedResources, [], config);
      
      expect(result.recommendations.some(r => r.includes('Resource2'))).toBe(true);
    });
  });

  describe('evaluateThreshold - consistency property', () => {
    it('should produce consistent results for same inputs', () => {
      const config: ThresholdConfig = {
        default: {
          warning: 50,
          error: 100,
        },
      };

      const result1 = enforcer.evaluateThreshold(75, [], [], config);
      const result2 = enforcer.evaluateThreshold(75, [], [], config);
      const result3 = enforcer.evaluateThreshold(75, [], [], config);
      
      expect(result1.passed).toBe(result2.passed);
      expect(result2.passed).toBe(result3.passed);
      expect(result1.level).toBe(result2.level);
      expect(result2.level).toBe(result3.level);
      expect(result1.threshold).toBe(result2.threshold);
      expect(result2.threshold).toBe(result3.threshold);
    });
  });
});
