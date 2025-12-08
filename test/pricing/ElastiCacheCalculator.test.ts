import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElastiCacheCalculator } from "../../src/pricing/calculators/ElastiCacheCalculator";
import { PricingClient } from "../../src/pricing/types";

describe("ElastiCacheCalculator", () => {
  const calculator = new ElastiCacheCalculator();

  describe("supports", () => {
    it("should support AWS::ElastiCache::CacheCluster", () => {
      expect(calculator.supports("AWS::ElastiCache::CacheCluster")).toBe(true);
    });

    it("should not support other resource types", () => {
      expect(calculator.supports("AWS::S3::Bucket")).toBe(false);
      expect(calculator.supports("AWS::Lambda::Function")).toBe(false);
      expect(calculator.supports("AWS::EC2::Instance")).toBe(false);
      expect(calculator.supports("AWS::RDS::DBInstance")).toBe(false);
    });
  });

  describe("calculateCost", () => {
    const mockPricingClient: PricingClient = {
      getPrice: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    // Redis cluster cost calculation tests
    describe("Redis cluster cost calculation", () => {
      it("should calculate cost for single-node Redis cluster", async () => {
        // Mock pricing: $0.034 per hour for cache.t3.micro
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.034 * 730 = 24.82
        // Total cost: 24.82 * 1 = 24.82
        expect(result.amount).toBeCloseTo(24.82, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
        expect(result.assumptions).toContain(
          "Assumes 730 hours per month (24/7 operation)",
        );
        expect(result.assumptions).toContain("Node type: cache.t3.micro");
        expect(result.assumptions).toContain("Engine: redis");
        expect(result.assumptions).toContain("Number of cache nodes: 1");
        expect(result.assumptions).toContain("Single-AZ deployment");
      });

      it("should calculate cost for cache.m5.large Redis cluster", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.136);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.m5.large",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.136 * 730 = 99.28
        expect(result.amount).toBeCloseTo(99.28, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
      });

      it("should calculate cost for cache.r5.xlarge Redis cluster", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.252);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.r5.xlarge",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.252 * 730 = 183.96
        expect(result.amount).toBeCloseTo(183.96, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
      });
    });

    // Memcached cluster cost calculation tests
    describe("Memcached cluster cost calculation", () => {
      it("should calculate cost for single-node Memcached cluster", async () => {
        // Mock pricing: $0.034 per hour for cache.t3.micro
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyMemcachedCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "memcached",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.034 * 730 = 24.82
        expect(result.amount).toBeCloseTo(24.82, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
        expect(result.assumptions).toContain("Engine: memcached");
      });

      it("should calculate cost for cache.m5.large Memcached cluster", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.136);

        const resource = {
          logicalId: "MyMemcachedCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.m5.large",
            Engine: "memcached",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.136 * 730 = 99.28
        expect(result.amount).toBeCloseTo(99.28, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
      });
    });

    // Multi-node cluster cost tests
    describe("Multi-node cluster costs", () => {
      it("should calculate cost for 3-node Redis cluster", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 3,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.034 * 730 = 24.82
        // Total cost: 24.82 * 3 = 74.46
        expect(result.amount).toBeCloseTo(74.46, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
        expect(result.assumptions).toContain("Number of cache nodes: 3");
        // Check that per-node cost is included (format may vary due to floating point)
        const perNodeAssumption = result.assumptions.find((a) =>
          a.includes("Per-node monthly cost:"),
        );
        expect(perNodeAssumption).toBeDefined();
        expect(perNodeAssumption).toContain("24.82");
      });

      it("should calculate cost for 5-node Memcached cluster", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.068);

        const resource = {
          logicalId: "MyMemcachedCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.small",
            Engine: "memcached",
            NumCacheNodes: 5,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.068 * 730 = 49.64
        // Total cost: 49.64 * 5 = 248.20
        expect(result.amount).toBeCloseTo(248.2, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
        expect(result.assumptions).toContain("Number of cache nodes: 5");
      });

      it("should default to 1 node when NumCacheNodes is not specified", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Should default to 1 node
        expect(result.amount).toBeCloseTo(24.82, 2);
        expect(result.assumptions).toContain("Number of cache nodes: 1");
      });
    });

    // Multi-AZ replica cost tests
    describe("Multi-AZ replica costs", () => {
      it("should double cost for cross-az deployment", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
            AZMode: "cross-az",
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.034 * 730 = 24.82
        // Total cost: 24.82 * 1 = 24.82
        // Multi-AZ: 24.82 * 2 = 49.64
        expect(result.amount).toBeCloseTo(49.64, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
        expect(result.assumptions).toContain(
          "Multi-AZ deployment with replica nodes (cost doubled)",
        );
      });

      it("should double cost for multi-node cross-az deployment", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.068);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.small",
            Engine: "redis",
            NumCacheNodes: 3,
            AZMode: "cross-az",
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Expected calculation:
        // Per-node cost: 0.068 * 730 = 49.64
        // Total cost: 49.64 * 3 = 148.92
        // Multi-AZ: 148.92 * 2 = 297.84
        expect(result.amount).toBeCloseTo(297.84, 2);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("high");
        expect(result.assumptions).toContain(
          "Multi-AZ deployment with replica nodes (cost doubled)",
        );
      });

      it("should not double cost for single-az deployment", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
            AZMode: "single-az",
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Should not double for single-az
        expect(result.amount).toBeCloseTo(24.82, 2);
        expect(result.assumptions).toContain("Single-AZ deployment");
      });

      it("should default to single-az when AZMode is not specified", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        // Should default to single-az
        expect(result.amount).toBeCloseTo(24.82, 2);
        expect(result.assumptions).toContain("Single-AZ deployment");
      });
    });

    // Missing pricing data tests
    describe("Handling of missing pricing data", () => {
      it("should handle missing CacheNodeType property", async () => {
        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(result.amount).toBe(0);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("unknown");
        expect(result.assumptions).toContain(
          "Cache node type or engine not specified",
        );
        expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
      });

      it("should handle missing Engine property", async () => {
        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(result.amount).toBe(0);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("unknown");
        expect(result.assumptions).toContain(
          "Cache node type or engine not specified",
        );
        expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
      });

      it("should handle missing both CacheNodeType and Engine properties", async () => {
        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(result.amount).toBe(0);
        expect(result.currency).toBe("USD");
        expect(result.confidence).toBe("unknown");
        expect(result.assumptions).toContain(
          "Cache node type or engine not specified",
        );
        expect(mockPricingClient.getPrice).not.toHaveBeenCalled();
      });

      it("should handle pricing data unavailable", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(null);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe("unknown");
        expect(result.assumptions[0]).toContain(
          "Pricing data not available for node type cache.t3.micro with engine redis in region us-east-1",
        );
      });

      it("should handle pricing API errors", async () => {
        vi.mocked(mockPricingClient.getPrice).mockRejectedValue(
          new Error("API timeout"),
        );

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        const result = await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(result.amount).toBe(0);
        expect(result.confidence).toBe("unknown");
        expect(result.assumptions[0]).toContain("Failed to fetch pricing");
        expect(result.assumptions[0]).toContain("API timeout");
      });
    });

    // Engine normalization tests
    describe("Engine normalization", () => {
      it("should normalize lowercase redis engine", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
          serviceCode: "AmazonElastiCache",
          region: "US East (N. Virginia)",
          filters: [
            { field: "instanceType", value: "cache.t3.micro" },
            { field: "cacheEngine", value: "Redis" },
          ],
        });
      });

      it("should normalize lowercase memcached engine", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyMemcachedCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "memcached",
            NumCacheNodes: 1,
          },
        };

        await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
          serviceCode: "AmazonElastiCache",
          region: "US East (N. Virginia)",
          filters: [
            { field: "instanceType", value: "cache.t3.micro" },
            { field: "cacheEngine", value: "Memcached" },
          ],
        });
      });
    });

    // Region normalization tests
    describe("Region normalization", () => {
      it("should normalize us-east-1 region", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.034);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        await calculator.calculateCost(
          resource,
          "us-east-1",
          mockPricingClient,
        );

        expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
          serviceCode: "AmazonElastiCache",
          region: "US East (N. Virginia)",
          filters: expect.any(Array),
        });
      });

      it("should normalize eu-central-1 region", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.038);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        await calculator.calculateCost(
          resource,
          "eu-central-1",
          mockPricingClient,
        );

        expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
          serviceCode: "AmazonElastiCache",
          region: "EU (Frankfurt)",
          filters: expect.any(Array),
        });
      });

      it("should normalize ap-southeast-1 region", async () => {
        vi.mocked(mockPricingClient.getPrice).mockResolvedValue(0.038);

        const resource = {
          logicalId: "MyRedisCluster",
          type: "AWS::ElastiCache::CacheCluster",
          properties: {
            CacheNodeType: "cache.t3.micro",
            Engine: "redis",
            NumCacheNodes: 1,
          },
        };

        await calculator.calculateCost(
          resource,
          "ap-southeast-1",
          mockPricingClient,
        );

        expect(mockPricingClient.getPrice).toHaveBeenCalledWith({
          serviceCode: "AmazonElastiCache",
          region: "Asia Pacific (Singapore)",
          filters: expect.any(Array),
        });
      });
    });
  });
});
