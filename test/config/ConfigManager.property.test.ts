import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ConfigManager } from "../../src/config/ConfigManager";
import { CostAnalyzerConfig } from "../../src/config/types";

describe("ConfigManager - Property Tests", () => {
  const manager = new ConfigManager();

  // Feature: production-readiness, Property 3: Configuration file validation catches invalid schemas
  // Validates: Requirements 6.5
  it("should reject configurations with negative threshold values", () => {
    const invalidThresholdConfigArb = fc
      .record({
        thresholds: fc.record({
          default: fc.record({
            warning: fc.option(
              fc.double({ min: -1000, max: -0.01, noNaN: true }),
              { nil: undefined },
            ),
            error: fc.option(
              fc.double({ min: -1000, max: -0.01, noNaN: true }),
              { nil: undefined },
            ),
          }),
        }),
      })
      .filter((config) => {
        // Ensure at least one threshold value is negative
        const def = config.thresholds.default;
        return (
          (def.warning !== undefined && def.warning < 0) ||
          (def.error !== undefined && def.error < 0)
        );
      });

    fc.assert(
      fc.property(invalidThresholdConfigArb, (config) => {
        const result = manager.validateConfig(config as CostAnalyzerConfig);

        // Should be invalid
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // Should have descriptive error messages
        const hasThresholdError = result.errors.some((err) =>
          err.includes("must be non-negative"),
        );
        expect(hasThresholdError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 3: Configuration file validation catches invalid schemas
  // Validates: Requirements 6.5
  it("should reject configurations with negative usage assumptions", () => {
    const invalidUsageAssumptionsArb = fc.oneof(
      fc.record({
        usageAssumptions: fc.record({
          s3: fc.record({
            storageGB: fc.double({ min: -1000, max: -0.01, noNaN: true }),
          }),
        }),
      }),
      fc.record({
        usageAssumptions: fc.record({
          lambda: fc.record({
            invocationsPerMonth: fc.double({
              min: -1000,
              max: -0.01,
              noNaN: true,
            }),
          }),
        }),
      }),
      fc.record({
        usageAssumptions: fc.record({
          natGateway: fc.record({
            dataProcessedGB: fc.double({ min: -1000, max: -0.01, noNaN: true }),
          }),
        }),
      }),
      fc.record({
        usageAssumptions: fc.record({
          alb: fc.record({
            newConnectionsPerSecond: fc.double({
              min: -1000,
              max: -0.01,
              noNaN: true,
            }),
          }),
        }),
      }),
      fc.record({
        usageAssumptions: fc.record({
          cloudfront: fc.record({
            dataTransferGB: fc.double({ min: -1000, max: -0.01, noNaN: true }),
          }),
        }),
      }),
    );

    fc.assert(
      fc.property(invalidUsageAssumptionsArb, (config) => {
        const result = manager.validateConfig(config as CostAnalyzerConfig);

        // Should be invalid
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // Should have descriptive error messages
        const hasUsageAssumptionError = result.errors.some((err) =>
          err.includes("must be non-negative"),
        );
        expect(hasUsageAssumptionError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 3: Configuration file validation catches invalid schemas
  // Validates: Requirements 6.5
  it("should reject configurations with non-positive cache duration", () => {
    const invalidCacheConfigArb = fc.record({
      cache: fc.record({
        durationHours: fc.oneof(
          fc.constant(0),
          fc.double({ min: -1000, max: -0.01, noNaN: true }),
        ),
      }),
    });

    fc.assert(
      fc.property(invalidCacheConfigArb, (config) => {
        const result = manager.validateConfig(config as CostAnalyzerConfig);

        // Should be invalid
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // Should have descriptive error message
        const hasCacheError = result.errors.some((err) =>
          err.includes("cache.durationHours must be positive"),
        );
        expect(hasCacheError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 3: Configuration file validation catches invalid schemas
  // Validates: Requirements 6.5
  it("should accept valid configurations with all fields", () => {
    const validConfigArb = fc.record({
      thresholds: fc.option(
        fc.record({
          default: fc.option(
            fc.record({
              warning: fc.option(
                fc.double({ min: 0, max: 1000, noNaN: true }),
                { nil: undefined },
              ),
              error: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), {
                nil: undefined,
              }),
            }),
            { nil: undefined },
          ),
          environments: fc.option(
            fc.dictionary(
              fc.constantFrom("development", "staging", "production"),
              fc.record({
                warning: fc.option(
                  fc.double({ min: 0, max: 1000, noNaN: true }),
                  { nil: undefined },
                ),
                error: fc.option(
                  fc.double({ min: 0, max: 1000, noNaN: true }),
                  { nil: undefined },
                ),
              }),
            ),
            { nil: undefined },
          ),
        }),
        { nil: undefined },
      ),
      usageAssumptions: fc.option(
        fc.record({
          s3: fc.option(
            fc.record({
              storageGB: fc.option(
                fc.double({ min: 0, max: 10000, noNaN: true }),
                { nil: undefined },
              ),
              getRequests: fc.option(fc.integer({ min: 0, max: 1000000 }), {
                nil: undefined,
              }),
              putRequests: fc.option(fc.integer({ min: 0, max: 1000000 }), {
                nil: undefined,
              }),
            }),
            { nil: undefined },
          ),
          lambda: fc.option(
            fc.record({
              invocationsPerMonth: fc.option(
                fc.integer({ min: 0, max: 10000000 }),
                { nil: undefined },
              ),
              averageDurationMs: fc.option(
                fc.integer({ min: 0, max: 900000 }),
                { nil: undefined },
              ),
            }),
            { nil: undefined },
          ),
          natGateway: fc.option(
            fc.record({
              dataProcessedGB: fc.option(
                fc.double({ min: 0, max: 10000, noNaN: true }),
                { nil: undefined },
              ),
            }),
            { nil: undefined },
          ),
          alb: fc.option(
            fc.record({
              newConnectionsPerSecond: fc.option(
                fc.integer({ min: 0, max: 10000 }),
                { nil: undefined },
              ),
              activeConnectionsPerMinute: fc.option(
                fc.integer({ min: 0, max: 100000 }),
                { nil: undefined },
              ),
              processedBytesGB: fc.option(
                fc.double({ min: 0, max: 10000, noNaN: true }),
                { nil: undefined },
              ),
            }),
            { nil: undefined },
          ),
          cloudfront: fc.option(
            fc.record({
              dataTransferGB: fc.option(
                fc.double({ min: 0, max: 10000, noNaN: true }),
                { nil: undefined },
              ),
              requests: fc.option(fc.integer({ min: 0, max: 100000000 }), {
                nil: undefined,
              }),
            }),
            { nil: undefined },
          ),
        }),
        { nil: undefined },
      ),
      cache: fc.option(
        fc.record({
          enabled: fc.option(fc.boolean(), { nil: undefined }),
          durationHours: fc.option(
            fc.double({ min: 0.01, max: 168, noNaN: true }),
            { nil: undefined },
          ),
        }),
        { nil: undefined },
      ),
      exclusions: fc.option(
        fc.record({
          resourceTypes: fc.option(
            fc.array(
              fc.constantFrom(
                "AWS::IAM::Role",
                "AWS::IAM::Policy",
                "AWS::Logs::LogGroup",
              ),
              { maxLength: 5 },
            ),
            { nil: undefined },
          ),
        }),
        { nil: undefined },
      ),
    });

    fc.assert(
      fc.property(validConfigArb, (config) => {
        const result = manager.validateConfig(config as CostAnalyzerConfig);

        // Should be valid
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 3: Configuration file validation catches invalid schemas
  // Validates: Requirements 6.5
  it("should warn when warning threshold exceeds error threshold", () => {
    const warningExceedsErrorArb = fc.record({
      thresholds: fc.record({
        default: fc.record({
          warning: fc.double({ min: 100, max: 1000, noNaN: true }),
          error: fc.double({ min: 1, max: 99, noNaN: true }),
        }),
      }),
    });

    fc.assert(
      fc.property(warningExceedsErrorArb, (config) => {
        const result = manager.validateConfig(config as CostAnalyzerConfig);

        // Should still be valid (warning, not error)
        expect(result.valid).toBe(true);

        // But should have a warning
        expect(result.warnings.length).toBeGreaterThan(0);
        const hasWarningMessage = result.warnings.some(
          (warn) =>
            warn.includes("warning") &&
            warn.includes("greater than") &&
            warn.includes("error"),
        );
        expect(hasWarningMessage).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 3: Configuration file validation catches invalid schemas
  // Validates: Requirements 6.5
  it("should validate environment-specific thresholds independently", () => {
    const multiEnvConfigArb = fc.record({
      thresholds: fc.record({
        environments: fc.dictionary(
          fc.constantFrom("development", "staging", "production"),
          fc.record({
            warning: fc.option(
              fc.double({ min: -100, max: 1000, noNaN: true }),
              { nil: undefined },
            ),
            error: fc.option(fc.double({ min: -100, max: 1000, noNaN: true }), {
              nil: undefined,
            }),
          }),
          { minKeys: 1, maxKeys: 3 },
        ),
      }),
    });

    fc.assert(
      fc.property(multiEnvConfigArb, (config) => {
        const result = manager.validateConfig(config as CostAnalyzerConfig);

        // Check if any environment has negative values
        const hasNegativeValues = Object.values(
          config.thresholds!.environments!,
        ).some(
          (levels) =>
            (levels.warning !== undefined && levels.warning < 0) ||
            (levels.error !== undefined && levels.error < 0),
        );

        if (hasNegativeValues) {
          // Should be invalid
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);

          // Should mention the environment in error
          const hasEnvError = result.errors.some((err) =>
            err.includes("thresholds.environments"),
          );
          expect(hasEnvError).toBe(true);
        } else {
          // Should be valid if all values are non-negative
          expect(result.valid).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
