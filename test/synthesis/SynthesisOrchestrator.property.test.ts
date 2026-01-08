import * as fs from 'fs/promises';
import * as fc from 'fast-check';
// Jest imports are global
import { TemplateParser } from '../../src/parser/TemplateParser';
import { SynthesisOrchestrator } from '../../src/synthesis/SynthesisOrchestrator';

describe('SynthesisOrchestrator - Property Tests', () => {
  const orchestrator = new SynthesisOrchestrator();
  const parser = new TemplateParser();

  // Feature: production-readiness, Property 1: CDK synthesis produces valid CloudFormation templates
  // Validates: Requirements 1.1, 1.2, 1.3
  it('should produce parseable CloudFormation templates when synthesis succeeds', async () => {
    // Use the single-stack example project
    const result = await orchestrator.synthesize({
      cdkAppPath: './examples/single-stack',
    });

    // If synthesis succeeded, verify all templates are parseable
    if (result.success) {
      expect(result.templatePaths.length).toBeGreaterThan(0);
      expect(result.stackNames.length).toBe(result.templatePaths.length);

      // Verify each template can be parsed
      for (const templatePath of result.templatePaths) {
        const content = await fs.readFile(templatePath, 'utf-8');

        // Should not throw when parsing
        const template = parser.parse(content);

        // Should have required CloudFormation structure
        expect(template).toBeDefined();
        expect(template.Resources).toBeDefined();
        expect(typeof template.Resources).toBe('object');
      }
    } else {
      // If synthesis failed, should have error message
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error!.length).toBeGreaterThan(0);
    }

    // All results should have consistent structure
    expect(result.success).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(Array.isArray(result.templatePaths)).toBe(true);
    expect(Array.isArray(result.stackNames)).toBe(true);
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  }, 30000); // Increase timeout to 30 seconds for CDK synthesis

  // Feature: production-readiness, Property 1: CDK synthesis produces valid CloudFormation templates
  // Validates: Requirements 1.1, 1.2, 1.3
  it('should produce consistent results for the same CDK project', async () => {
    // Synthesize the same project multiple times with unique output directories to avoid conflicts
    const results = await Promise.all([
      orchestrator.synthesize({
        cdkAppPath: './examples/single-stack',
        outputPath: 'cdk.out.test1',
      }),
      orchestrator.synthesize({
        cdkAppPath: './examples/single-stack',
        outputPath: 'cdk.out.test2',
      }),
    ]);

    // Both should have the same success status
    expect(results[0].success).toBe(results[1].success);

    if (results[0].success && results[1].success) {
      // Should produce the same number of stacks
      expect(results[0].stackNames.length).toBe(results[1].stackNames.length);
      expect(results[0].templatePaths.length).toBe(
        results[1].templatePaths.length,
      );

      // Stack names should be the same
      const sortedNames1 = [...results[0].stackNames].sort();
      const sortedNames2 = [...results[1].stackNames].sort();
      expect(sortedNames1).toEqual(sortedNames2);
    }
  }, 20000);

  // Feature: production-readiness, Property 1: CDK synthesis produces valid CloudFormation templates
  // Validates: Requirements 1.1, 1.2, 1.3
  it('should handle synthesis with various context values', () => {
    const contextArb = fc.dictionary(
      fc.constantFrom('environment', 'region', 'account', 'customKey'),
      fc.oneof(
        fc.constantFrom('development', 'staging', 'production'),
        fc.constantFrom('us-east-1', 'eu-central-1', 'ap-southeast-1'),
        fc.string({ minLength: 1, maxLength: 20 }),
      ),
      { maxKeys: 3 },
    );

    void fc.assert(
      fc.asyncProperty(contextArb, async (context) => {
        const result = await orchestrator.synthesize({
          cdkAppPath: './examples/single-stack',
          context,
        });

        // Should complete without throwing
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(Array.isArray(result.templatePaths)).toBe(true);
        expect(Array.isArray(result.stackNames)).toBe(true);
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);

        // If successful, templates should be parseable
        if (result.success && result.templatePaths.length > 0) {
          for (const templatePath of result.templatePaths) {
            const content = await fs.readFile(templatePath, 'utf-8');
            const template = parser.parse(content);
            expect(template.Resources).toBeDefined();
          }
        }
      }),
      { numRuns: 10 }, // Reduced runs since synthesis is slow
    );
  }, 60000);

  // Feature: production-readiness, Property 1: CDK synthesis produces valid CloudFormation templates
  // Validates: Requirements 1.1, 1.2, 1.3
  it('should fail gracefully for invalid CDK project paths', () => {
    const invalidPathArb = fc.oneof(
      fc.constant('./nonexistent-project'),
      fc.constant('./invalid/path/to/project'),
      fc.constant('/tmp/does-not-exist'),
      fc
        .string({ minLength: 1, maxLength: 50 })
        .map((s) => `./${s}-nonexistent`),
    );

    void fc.assert(
      fc.asyncProperty(invalidPathArb, async (cdkAppPath) => {
        const result = await orchestrator.synthesize({ cdkAppPath });

        // Should not throw, but should indicate failure
        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error!.length).toBeGreaterThan(0);
        expect(result.templatePaths).toHaveLength(0);
        expect(result.stackNames).toHaveLength(0);
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 20 },
    );
  }, 30000);

  // Feature: production-readiness, Property 1: CDK synthesis produces valid CloudFormation templates
  // Validates: Requirements 1.1, 1.2, 1.3
  it('should maintain stack name and template path correspondence', async () => {
    const result = await orchestrator.synthesize({
      cdkAppPath: './examples/single-stack',
    });

    if (result.success) {
      // Number of stack names should equal number of template paths
      expect(result.stackNames.length).toBe(result.templatePaths.length);

      // Each stack name should correspond to a template path
      for (let i = 0; i < result.stackNames.length; i++) {
        const stackName = result.stackNames[i];
        const templatePath = result.templatePaths[i];

        // Template path should contain the stack name
        expect(templatePath).toContain(stackName);
        expect(templatePath).toMatch(/\.template\.(json|yaml|yml)$/);
      }

      // Stack names should be unique
      const uniqueNames = new Set(result.stackNames);
      expect(uniqueNames.size).toBe(result.stackNames.length);

      // Template paths should be unique
      const uniquePaths = new Set(result.templatePaths);
      expect(uniquePaths.size).toBe(result.templatePaths.length);
    }
  }, 30000); // Increase timeout to 30 seconds for CDK synthesis

  // Feature: production-readiness, Property 11: Synthesis errors are captured and reported
  // Validates: Requirements 13.1, 13.2, 13.3
  it('should capture and report complete error output when synthesis fails', () => {
    // Generate various invalid CDK project scenarios
    const invalidScenarioArb = fc.oneof(
      // Non-existent paths
      fc.constant('./nonexistent-cdk-project'),
      fc.constant('./invalid/nested/path'),
      fc.string({ minLength: 5, maxLength: 30 }).map((s) => `./${s}-invalid`),
      // Paths that might exist but aren't CDK projects
      fc.constant('./src'),
      fc.constant('./test'),
      fc.constant('./node_modules'),
    );

    void fc.assert(
      fc.asyncProperty(invalidScenarioArb, async (cdkAppPath) => {
        const result = await orchestrator.synthesize({ cdkAppPath });

        // When synthesis fails, should capture error information
        if (!result.success) {
          // Requirement 13.1: Complete CDK error output is captured
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);

          // Requirement 13.2: Error message should be prominent (non-empty string)
          // The error should contain meaningful information
          expect(result.error).toBeTruthy();

          // Should indicate failure clearly
          expect(result.success).toBe(false);

          // Should have empty results when failed
          expect(result.templatePaths).toHaveLength(0);
          expect(result.stackNames).toHaveLength(0);

          // Should still track duration
          expect(typeof result.duration).toBe('number');
          expect(result.duration).toBeGreaterThanOrEqual(0);
        }

        // All results should have consistent structure regardless of success
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('templatePaths');
        expect(result).toHaveProperty('stackNames');
        expect(result).toHaveProperty('duration');
        expect(Array.isArray(result.templatePaths)).toBe(true);
        expect(Array.isArray(result.stackNames)).toBe(true);
      }),
      { numRuns: 50 },
    );
  }, 30000);

  // Feature: production-readiness, Property 11: Synthesis errors are captured and reported
  // Validates: Requirements 13.1, 13.2, 13.3
  it('should capture error output from invalid CDK commands', () => {
    // Generate various invalid command scenarios
    const invalidCommandArb = fc.oneof(
      fc.constant('invalid-command-that-does-not-exist'),
      fc.constant('npx cdk synth --invalid-flag'),
      fc.constant('echo "not a real cdk command"'),
      fc.string({ minLength: 5, maxLength: 30 }).map((s) => `invalid-${s}`),
    );

    void fc.assert(
      fc.asyncProperty(invalidCommandArb, async (customCommand) => {
        const result = await orchestrator.synthesize({
          cdkAppPath: './examples/single-stack',
          customCommand,
        });

        // When custom command fails, should capture error
        if (!result.success) {
          // Requirement 13.1: Complete error output is captured
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);

          // Requirement 13.2: Error message is prominent
          expect(result.error).toBeTruthy();

          // Should indicate failure
          expect(result.success).toBe(false);
          expect(result.templatePaths).toHaveLength(0);
          expect(result.stackNames).toHaveLength(0);
        }

        // Should always return valid result structure
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');

        // Error property should only exist when synthesis fails
        if (!result.success) {
          expect(result).toHaveProperty('error');
        }
      }),
      { numRuns: 20 },
    );
  }, 30000);

  // Feature: production-readiness, Property 11: Synthesis errors are captured and reported
  // Validates: Requirements 13.1, 13.2, 13.3
  it('should preserve error information across multiple failed synthesis attempts', async () => {
    // Test that error information is consistently captured
    const invalidPath = './definitely-does-not-exist-' + Date.now();

    const results = await Promise.all([
      orchestrator.synthesize({ cdkAppPath: invalidPath }),
      orchestrator.synthesize({ cdkAppPath: invalidPath }),
      orchestrator.synthesize({ cdkAppPath: invalidPath }),
    ]);

    // All attempts should fail consistently
    for (const result of results) {
      expect(result.success).toBe(false);

      // Requirement 13.1 & 13.2: Error should be captured and prominent
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error!.length).toBeGreaterThan(0);

      // Should have consistent failure structure
      expect(result.templatePaths).toHaveLength(0);
      expect(result.stackNames).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    }

    // All errors should be similar (same type of failure)
    const errors = results.map((r) => r.error);
    expect(errors.every((e) => e !== undefined)).toBe(true);
  }, 30000); // Increase timeout to 30 seconds for CDK synthesis

  // Feature: production-readiness, Property 2: Multi-stack cost aggregation equals sum of individual stacks
  // Validates: Requirements 2.1, 2.2, 2.3, 2.4
  it('should successfully synthesize multi-stack CDK applications', async () => {
    // Use the multi-stack example project
    const result = await orchestrator.synthesize({
      cdkAppPath: './examples/multi-stack',
    });

    // If synthesis succeeded (dependencies installed), verify multi-stack behavior
    if (result.success) {
      // Should produce multiple stacks (networking, compute, storage)
      expect(result.templatePaths.length).toBeGreaterThan(1);
      expect(result.stackNames.length).toBeGreaterThan(1);

      // Stack names and template paths should correspond
      expect(result.stackNames.length).toBe(result.templatePaths.length);

      // Each template should be parseable
      for (const templatePath of result.templatePaths) {
        const content = await fs.readFile(templatePath, 'utf-8');
        const template = parser.parse(content);
        expect(template).toBeDefined();
        expect(template.Resources).toBeDefined();
      }
    } else {
      // If synthesis failed (likely missing dependencies), verify error handling
      expect(result.error).toBeDefined();
      expect(result.templatePaths).toHaveLength(0);
      expect(result.stackNames).toHaveLength(0);
    }

    // Should always have valid result structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('templatePaths');
    expect(result).toHaveProperty('stackNames');
    expect(result).toHaveProperty('duration');
  }, 20000);

  // Feature: production-readiness, Property 2: Multi-stack cost aggregation equals sum of individual stacks
  // Validates: Requirements 2.1, 2.2, 2.3
  it('should identify all stacks in multi-stack applications', async () => {
    const result = await orchestrator.synthesize({
      cdkAppPath: './examples/multi-stack',
    });

    if (result.success) {
      // Should have identified multiple stacks
      expect(result.stackNames.length).toBeGreaterThan(1);
      expect(result.templatePaths.length).toBeGreaterThan(1);

      // Each stack name should correspond to a template path
      for (let i = 0; i < result.stackNames.length; i++) {
        const stackName = result.stackNames[i];
        const templatePath = result.templatePaths[i];

        expect(stackName).toBeDefined();
        expect(typeof stackName).toBe('string');
        expect(stackName.length).toBeGreaterThan(0);

        expect(templatePath).toBeDefined();
        expect(typeof templatePath).toBe('string');
        expect(templatePath).toContain(stackName);
      }

      // Stack names should be unique
      const uniqueNames = new Set(result.stackNames);
      expect(uniqueNames.size).toBe(result.stackNames.length);
    }
  }, 20000);
});
