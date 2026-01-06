import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineOrchestrator } from '../../src/pipeline/PipelineOrchestrator';

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator;

  beforeEach(() => {
    orchestrator = new PipelineOrchestrator();
  });

  describe('runPipelineAnalysis', () => {
    it('should create a PipelineOrchestrator instance', () => {
      expect(orchestrator).toBeInstanceOf(PipelineOrchestrator);
    });

    it('should have a runPipelineAnalysis method', () => {
      expect(typeof orchestrator.runPipelineAnalysis).toBe('function');
    });

    it('should require either templates or synthesis', async () => {
      await expect(
        orchestrator.runPipelineAnalysis({
          synthesize: false,
        }),
      ).rejects.toThrow('Either provide template paths or enable synthesis');
    });

    it('should accept template paths', async () => {
      // This will fail because templates don't exist, but validates the interface
      const promise = orchestrator.runPipelineAnalysis({
        synthesize: false,
        baseTemplate: './examples/simple/base.json',
        targetTemplate: './examples/simple/target.json',
        region: 'eu-central-1',
      });

      // Should either succeed or fail with a specific error
      await expect(promise).resolves.toHaveProperty('costAnalysis');
    });

    it.skip('should accept synthesis options', async () => {
      // This will attempt synthesis - may fail but validates interface
      // Use unique output directory to avoid conflicts with parallel tests
      // SKIPPED: CDK synthesis fails in CI environment due to missing dependencies
      const promise = orchestrator.runPipelineAnalysis({
        synthesize: true,
        cdkAppPath: './examples/single-stack',
        outputPath: 'cdk.out.pipeline-test',
        region: 'eu-central-1',
      });

      // Should return a result structure
      await expect(promise).resolves.toMatchObject({
        costAnalysis: expect.any(Object),
        thresholdStatus: expect.any(Object),
        configUsed: expect.any(Object),
      });
    }, 30000); // Increase timeout to 30 seconds for CI environment

    it('should reject when config file not found', async () => {
      const promise = orchestrator.runPipelineAnalysis({
        synthesize: false,
        baseTemplate: './examples/simple/base.json',
        targetTemplate: './examples/simple/target.json',
        configPath: './.nonexistent-config.yml',
      });

      // Should reject with configuration error
      await expect(promise).rejects.toThrow('Configuration file not found');
    });

    it('should accept environment parameter', async () => {
      const promise = orchestrator.runPipelineAnalysis({
        synthesize: false,
        baseTemplate: './examples/simple/base.json',
        targetTemplate: './examples/simple/target.json',
        environment: 'production',
      });

      // Should handle environment option
      await expect(promise).resolves.toHaveProperty('thresholdStatus');
    });

    it('should accept region parameter', async () => {
      const promise = orchestrator.runPipelineAnalysis({
        synthesize: false,
        baseTemplate: './examples/simple/base.json',
        targetTemplate: './examples/simple/target.json',
        region: 'us-west-2',
      });

      // Should handle region option
      await expect(promise).resolves.toHaveProperty('costAnalysis');
    });
  });
});
