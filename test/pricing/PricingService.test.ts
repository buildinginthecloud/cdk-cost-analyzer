// Jest imports are global
import { ResourceWithId } from '../../src/diff/types';
import { PricingClient } from '../../src/pricing/PricingClient';
import { PricingService } from '../../src/pricing/PricingService';

describe('PricingService', () => {
  let service: PricingService;
  let mockPricingClient: PricingClient;

  beforeEach(() => {
    // Create a mock pricing client using dependency injection
    mockPricingClient = {
      getPrice: jest.fn().mockResolvedValue(0.1),
    } as any;

    service = new PricingService(
      'us-east-1',
      undefined,
      undefined,
      undefined,
      mockPricingClient,
    );
  });

  describe('unsupported resource types', () => {
    it('should return unknown confidence for unsupported resources', async () => {
      const resource: ResourceWithId = {
        logicalId: 'MyUnsupportedResource',
        type: 'AWS::SomeService::UnsupportedType',
        properties: {},
      };

      const cost = await service.getResourceCost(resource, 'eu-central-1');

      expect(cost.confidence).toBe('unknown');
      expect(cost.amount).toBe(0);
      expect(cost.assumptions.some((a) => a.includes('not supported'))).toBe(
        true,
      );
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

  describe('calculator registration', () => {
    it('should support CloudFront distributions', async () => {
      const resource: ResourceWithId = {
        logicalId: 'MyCloudFront',
        type: 'AWS::CloudFront::Distribution',
        properties: {},
      };

      const cost = await service.getResourceCost(resource, 'us-east-1');

      // Should not return 'not supported' error
      expect(cost.assumptions.some((a) => a.includes('not supported'))).toBe(
        false,
      );
      // Should have CloudFront-specific assumptions
      expect(
        cost.assumptions.some(
          (a) => a.includes('data transfer') || a.includes('requests'),
        ),
      ).toBe(true);
    });

    it('should support ElastiCache clusters', async () => {
      const resource: ResourceWithId = {
        logicalId: 'MyCache',
        type: 'AWS::ElastiCache::CacheCluster',
        properties: {
          CacheNodeType: 'cache.t3.micro',
          Engine: 'redis',
          NumCacheNodes: 1,
        },
      };

      const cost = await service.getResourceCost(resource, 'us-east-1');

      // Should not return 'not supported' error
      expect(cost.assumptions.some((a) => a.includes('not supported'))).toBe(
        false,
      );
      // Should have ElastiCache-specific assumptions
      expect(
        cost.assumptions.some(
          (a) => a.includes('Node type') || a.includes('Engine'),
        ),
      ).toBe(true);
    });
  });
});
