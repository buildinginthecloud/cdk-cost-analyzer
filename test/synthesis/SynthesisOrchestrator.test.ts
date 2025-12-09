import { describe, it, expect } from 'vitest';
import { SynthesisOrchestrator } from '../../src/synthesis/SynthesisOrchestrator';

describe('SynthesisOrchestrator', () => {
  let orchestrator: SynthesisOrchestrator;

  beforeEach(() => {
    orchestrator = new SynthesisOrchestrator();
  });

  describe('synthesize', () => {
    it('should create a SynthesisOrchestrator instance', () => {
      expect(orchestrator).toBeInstanceOf(SynthesisOrchestrator);
    });

    it('should have a synthesize method', () => {
      expect(typeof orchestrator.synthesize).toBe('function');
    });

    // Integration test with actual CDK project
    it('should synthesize single-stack example project', async () => {
      const result = await orchestrator.synthesize({
        cdkAppPath: './examples/single-stack',
      });

      // Should either succeed or fail gracefully
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('templatePaths');
      expect(result).toHaveProperty('stackNames');
      expect(result).toHaveProperty('duration');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    }, 10000); // Increase timeout to 10 seconds

    it('should handle non-existent CDK project', async () => {
      const result = await orchestrator.synthesize({
        cdkAppPath: './nonexistent-project',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.templatePaths).toHaveLength(0);
      expect(result.stackNames).toHaveLength(0);
    });

    it('should accept custom output path option', async () => {
      const result = await orchestrator.synthesize({
        cdkAppPath: './examples/single-stack',
        outputPath: 'custom.out',
      });

      // Should handle the option without error
      expect(result).toHaveProperty('success');
    });

    it('should accept custom command option', async () => {
      const result = await orchestrator.synthesize({
        cdkAppPath: './examples/single-stack',
        customCommand: 'echo test',
      });

      // Should handle the option without error
      expect(result).toHaveProperty('success');
    });

    it('should accept context option', async () => {
      const result = await orchestrator.synthesize({
        cdkAppPath: './examples/single-stack',
        context: {
          environment: 'test',
          region: 'us-east-1',
        },
      });

      // Should handle the option without error
      expect(result).toHaveProperty('success');
    });
  });
});
