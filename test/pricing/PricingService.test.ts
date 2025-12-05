import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PricingService } from '../../src/pricing/PricingService';
import { ResourceWithId } from '../../src/diff/types';

vi.mock('@aws-sdk/client-pricing', () => ({
  PricingClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  GetProductsCommand: vi.fn(),
}));

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('unsupported resource types', () => {
    it('should return unknown confidence for unsupported resources', async () => {
      const resource: ResourceWithId = {
        logicalId: 'MyCloudFront',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await service.getResourceCost(resource, 'eu-central-1');

      expect(cost.confidence).toBe('unknown');
      expect(cost.amount).toBe(0);
      expect(cost.assumptions.some(a => a.includes('not supported'))).toBe(true);
    });
  });

  describe('cost delta calculation', () => {
    it('should calculate total delta correctly', async () => {
      const diff = {
        added: [],
        removed: [],
        modified: [],
      };

      const result = await service.getCostDelta(diff, 'eu-central-1');

      expect(result.totalDelta).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.addedCosts).toHaveLength(0);
      expect(result.removedCosts).toHaveLength(0);
      expect(result.modifiedCosts).toHaveLength(0);
    });
  });
});
