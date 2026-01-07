import * as fc from 'fast-check';
// Jest imports are global
import { ThresholdConfig } from '../../src/config/types';
import { ThresholdEnforcer } from '../../src/threshold/ThresholdEnforcer';

describe('ThresholdEnforcer - Property Tests', () => {
  const enforcer = new ThresholdEnforcer();

  const monthlyCostArb = fc.record({
    amount: fc.double({ min: 0, max: 1000, noNaN: true }),
    currency: fc.constant('USD'),
    confidence: fc.constantFrom('high', 'medium', 'low', 'unknown') as fc.Arbitrary<'high' | 'medium' | 'low' | 'unknown'>,
    assumptions: fc.array(fc.string()),
  });

  const resourceCostArb = fc.record({
    logicalId: fc.string().filter(s => s.length > 0),
    type: fc.constantFrom('AWS::EC2::Instance', 'AWS::S3::Bucket', 'AWS::Lambda::Function'),
    monthlyCost: monthlyCostArb,
  });

  const modifiedResourceCostArb = fc.record({
    logicalId: fc.string().filter(s => s.length > 0),
    type: fc.constantFrom('AWS::EC2::Instance', 'AWS::S3::Bucket'),
    monthlyCost: monthlyCostArb,
    oldMonthlyCost: monthlyCostArb,
    newMonthlyCost: monthlyCostArb,
    costDelta: fc.double({ min: -100, max: 100, noNaN: true }),
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should produce identical results for the same inputs', () => {
    const thresholdConfigArb = fc.record({
      default: fc.record({
        warning: fc.option(fc.double({ min: 0, max: 500, noNaN: true }), { nil: undefined }),
        error: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: undefined }),
      }),
    });

    const testDataArb = fc.record({
      costDelta: fc.double({ min: -100, max: 1000, noNaN: true }),
      addedResources: fc.array(resourceCostArb, { maxLength: 5 }),
      modifiedResources: fc.array(modifiedResourceCostArb, { maxLength: 3 }),
      config: thresholdConfigArb,
    });

    fc.assert(
      fc.property(testDataArb, ({ costDelta, addedResources, modifiedResources, config }) => {
        // Evaluate threshold multiple times with same inputs
        const result1 = enforcer.evaluateThreshold(
          costDelta,
          addedResources,
          modifiedResources,
          config as ThresholdConfig,
        );

        const result2 = enforcer.evaluateThreshold(
          costDelta,
          addedResources,
          modifiedResources,
          config as ThresholdConfig,
        );

        const result3 = enforcer.evaluateThreshold(
          costDelta,
          addedResources,
          modifiedResources,
          config as ThresholdConfig,
        );

        // All results should be identical
        expect(result1.passed).toBe(result2.passed);
        expect(result1.passed).toBe(result3.passed);
        expect(result1.level).toBe(result2.level);
        expect(result1.level).toBe(result3.level);
        expect(result1.threshold).toBe(result2.threshold);
        expect(result1.threshold).toBe(result3.threshold);
        expect(result1.delta).toBe(result2.delta);
        expect(result1.delta).toBe(result3.delta);
        expect(result1.message).toBe(result2.message);
        expect(result1.message).toBe(result3.message);
        expect(result1.recommendations).toEqual(result2.recommendations);
        expect(result1.recommendations).toEqual(result3.recommendations);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should correctly classify deltas relative to thresholds', () => {
    const thresholdConfigArb = fc.record({
      default: fc.record({
        warning: fc.double({ min: 50, max: 100, noNaN: true }),
        error: fc.double({ min: 150, max: 200, noNaN: true }),
      }),
    });

    fc.assert(
      fc.property(
        thresholdConfigArb,
        fc.double({ min: -50, max: 250, noNaN: true }),
        (config, costDelta) => {
          const result = enforcer.evaluateThreshold(
            costDelta,
            [],
            [],
            config as ThresholdConfig,
          );

          const warning = config.default.warning!;
          const error = config.default.error!;

          if (costDelta > error) {
            // Should be error level
            expect(result.level).toBe('error');
            expect(result.passed).toBe(false);
            expect(result.threshold).toBe(error);
          } else if (costDelta > warning) {
            // Should be warning level
            expect(result.level).toBe('warning');
            expect(result.passed).toBe(true); // Warnings still pass
            expect(result.threshold).toBe(warning);
          } else {
            // Should be none level
            expect(result.level).toBe('none');
            expect(result.passed).toBe(true);
          }

          // Delta should always match input
          expect(result.delta).toBe(costDelta);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should handle missing thresholds gracefully', () => {
    const costDeltaArb = fc.double({ min: -100, max: 1000, noNaN: true });

    fc.assert(
      fc.property(costDeltaArb, (costDelta) => {
        // No config
        const result1 = enforcer.evaluateThreshold(costDelta, [], []);
        expect(result1.passed).toBe(true);
        expect(result1.level).toBe('none');
        expect(result1.delta).toBe(costDelta);

        // Empty config
        const result2 = enforcer.evaluateThreshold(costDelta, [], [], {});
        expect(result2.passed).toBe(true);
        expect(result2.level).toBe('none');
        expect(result2.delta).toBe(costDelta);

        // Config with undefined thresholds
        const result3 = enforcer.evaluateThreshold(costDelta, [], [], {
          default: {},
        });
        expect(result3.passed).toBe(true);
        expect(result3.level).toBe('none');
        expect(result3.delta).toBe(costDelta);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should prioritize error threshold over warning threshold', () => {
    const configArb = fc.record({
      default: fc.record({
        warning: fc.double({ min: 10, max: 50, noNaN: true }),
        error: fc.double({ min: 60, max: 100, noNaN: true }),
      }),
    });

    fc.assert(
      fc.property(configArb, (config) => {
        const warning = config.default.warning!;
        const error = config.default.error!;

        // Delta that exceeds both thresholds
        const highDelta = error + 10;

        const result = enforcer.evaluateThreshold(
          highDelta,
          [],
          [],
          config as ThresholdConfig,
        );

        // Should be classified as error, not warning
        expect(result.level).toBe('error');
        expect(result.passed).toBe(false);
        expect(result.threshold).toBe(error);
        expect(result.threshold).not.toBe(warning);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should include recommendations when thresholds are exceeded', () => {
    const configArb = fc.record({
      default: fc.record({
        warning: fc.double({ min: 10, max: 50, noNaN: true }),
        error: fc.double({ min: 60, max: 100, noNaN: true }),
      }),
    });

    fc.assert(
      fc.property(
        configArb,
        fc.array(resourceCostArb, { minLength: 1, maxLength: 5 }),
        (config, addedResources) => {
          const error = config.default.error!;
          const highDelta = error + 50;

          const result = enforcer.evaluateThreshold(
            highDelta,
            addedResources,
            [],
            config as ThresholdConfig,
          );

          // Should have recommendations when threshold exceeded
          expect(result.recommendations.length).toBeGreaterThan(0);
          expect(Array.isArray(result.recommendations)).toBe(true);

          // Recommendations should be strings
          result.recommendations.forEach(rec => {
            expect(typeof rec).toBe('string');
            expect(rec.length).toBeGreaterThan(0);
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should handle environment-specific thresholds correctly', () => {
    const configArb = fc.record({
      default: fc.record({
        warning: fc.double({ min: 200, max: 300, noNaN: true }),
        error: fc.double({ min: 400, max: 500, noNaN: true }),
      }),
      environments: fc.record({
        production: fc.record({
          warning: fc.double({ min: 10, max: 30, noNaN: true }),
          error: fc.double({ min: 40, max: 60, noNaN: true }),
        }),
        development: fc.record({
          warning: fc.double({ min: 500, max: 600, noNaN: true }),
          error: fc.double({ min: 700, max: 800, noNaN: true }),
        }),
      }),
    });

    fc.assert(
      fc.property(configArb, (config) => {
        // Use a cost delta of 100 which is:
        // - Above production error (40-60)
        // - Below default warning (200-300)
        // - Below development warning (500-600)
        const costDelta = 100;

        // Should use production thresholds when environment is specified
        const prodResult = enforcer.evaluateThreshold(
          costDelta,
          [],
          [],
          config as ThresholdConfig,
          'production',
        );

        // Should use default thresholds when no environment specified
        const defaultResult = enforcer.evaluateThreshold(
          costDelta,
          [],
          [],
          config as ThresholdConfig,
        );

        // Should use development thresholds when environment is specified
        const devResult = enforcer.evaluateThreshold(
          costDelta,
          [],
          [],
          config as ThresholdConfig,
          'development',
        );

        // Production should be error (100 > any value in 40-60 range)
        expect(prodResult.level).toBe('error');
        expect(prodResult.passed).toBe(false);
        expect(prodResult.threshold).toBe(config.environments.production.error);

        // Default should be none (100 < any value in 200-300 range)
        expect(defaultResult.level).toBe('none');
        expect(defaultResult.passed).toBe(true);

        // Development should be none (100 < any value in 500-600 range)
        expect(devResult.level).toBe('none');
        expect(devResult.passed).toBe(true);

        // Verify environment selection works - different thresholds used
        expect(prodResult.threshold).not.toBe(defaultResult.threshold);
      }),
      { numRuns: 50 },
    );
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should handle negative cost deltas correctly', () => {
    const configArb = fc.record({
      default: fc.record({
        warning: fc.double({ min: 10, max: 50, noNaN: true }),
        error: fc.double({ min: 60, max: 100, noNaN: true }),
      }),
    });

    const negativeDeltaArb = fc.double({ min: -1000, max: -0.01, noNaN: true });

    fc.assert(
      fc.property(configArb, negativeDeltaArb, (config, costDelta) => {
        const result = enforcer.evaluateThreshold(
          costDelta,
          [],
          [],
          config as ThresholdConfig,
        );

        // Negative deltas (cost savings) should always pass
        expect(result.passed).toBe(true);
        expect(result.level).toBe('none');
        expect(result.delta).toBe(costDelta);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: production-readiness, Property 4: Threshold evaluation is consistent
  // Validates: Requirements 4.1, 4.2, 4.3
  it('should maintain message consistency for same threshold violations', () => {
    const config: ThresholdConfig = {
      default: {
        warning: 50,
        error: 100,
      },
    };

    const costDelta = 150;

    // Evaluate multiple times
    const results = Array.from({ length: 5 }, () =>
      enforcer.evaluateThreshold(costDelta, [], [], config),
    );

    // All messages should be identical
    const messages = results.map(r => r.message);
    const uniqueMessages = new Set(messages);
    expect(uniqueMessages.size).toBe(1);

    // Message should contain relevant information
    const message = messages[0];
    expect(message).toContain('150');
    expect(message).toContain('100');
    expect(message).toContain('error');
  });
});
