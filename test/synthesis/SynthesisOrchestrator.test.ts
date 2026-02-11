// Jest imports are global
import * as fs from 'fs/promises';
import { SynthesisOrchestrator } from '../../src/synthesis/SynthesisOrchestrator';

// Mock child_process spawn to control subprocess behavior
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: jest.fn(),
  };
});

// Mock fs/promises for findTemplates tests
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
}));

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;

describe('SynthesisOrchestrator', () => {
  let orchestrator: SynthesisOrchestrator;

  beforeEach(() => {
    orchestrator = new SynthesisOrchestrator();
    jest.clearAllMocks();
  });

  describe('synthesize', () => {
    it('should create a SynthesisOrchestrator instance', () => {
      expect(orchestrator).toBeInstanceOf(SynthesisOrchestrator);
    });

    it('should have a synthesize method', () => {
      expect(typeof orchestrator.synthesize).toBe('function');
    });

    it('should return success result with templates and stack names when synthesis succeeds', async () => {
      // Create mock child process that succeeds
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      // Mock readdir to return template files
      mockReaddir.mockResolvedValue([
        'TestStack.template.json',
        'AnotherStack.template.yaml',
        'manifest.json', // Non-template file
      ] as any);

      // Start synthesize
      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
        outputPath: 'cdk.out',
      });

      // Simulate successful completion
      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      const result = await resultPromise;

      // Verify success result (lines 23-31)
      expect(result.success).toBe(true);
      expect(result.templatePaths).toHaveLength(2);
      expect(result.stackNames).toContain('TestStack');
      expect(result.stackNames).toContain('AnotherStack');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle SynthesisError correctly', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      // Simulate error event with SynthesisError
      setImmediate(() => {
        mockProc.stderr.emit('data', Buffer.from('CDK synth error'));
        mockProc.emit('error', new Error('ENOENT'));
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.templatePaths).toHaveLength(0);
      expect(result.stackNames).toHaveLength(0);
    });

    it('should handle generic errors correctly', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      // Mock readdir to throw an error
      mockReaddir.mockRejectedValue(new Error('Directory not found'));

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Synthesis failed');
    });
  });

  describe('executeSynthesis - cleanup function', () => {
    it('should cleanup timeout and listeners on close event (lines 104-113)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);
      mockReaddir.mockResolvedValue(['Stack.template.json'] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      await resultPromise;

      // Verify cleanup was called
      expect(mockProc.removeAllListeners).toHaveBeenCalled();
    });

    it('should cleanup on error event', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('error', new Error('spawn ENOENT'));
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockProc.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('executeSynthesis - timeout and forceKill', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should timeout after 15 seconds and attempt graceful termination (lines 132-152)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      // Simulate stdout/stderr data
      mockProc.stdout.emit('data', Buffer.from('Synthesizing...'));
      mockProc.stderr.emit('data', Buffer.from('Warning: something'));

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(15000);

      // Allow promise to settle
      await Promise.resolve();
      jest.advanceTimersByTime(1000); // For the killTimeout

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should force kill if process does not respond to SIGTERM (lines 115-129)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      // Fast-forward to trigger timeout
      jest.advanceTimersByTime(15000);
      await Promise.resolve();

      // Fast-forward for force kill timeout
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      await resultPromise;

      // Should have attempted SIGTERM first, then SIGKILL
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should handle forceKill when process.kill throws (line 122-125)', async () => {
      const originalKill = process.kill;
      process.kill = jest.fn().mockImplementation(() => {
        throw new Error('Process already dead');
      });

      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      jest.advanceTimersByTime(15000);
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      const result = await resultPromise;

      // Should complete without throwing despite process.kill error
      expect(result.success).toBe(false);

      process.kill = originalKill;
    });
  });

  describe('executeSynthesis - close handler', () => {
    it('should handle non-zero exit code on close (lines 177-192)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.stderr.emit('data', Buffer.from('Error: Cannot find module'));
        mockProc.emit('close', 1);
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('exit code 1');
    });

    it('should resolve successfully on zero exit code', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);
      mockReaddir.mockResolvedValue(['MyStack.template.json'] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
    });
  });

  describe('executeSynthesis - exit handler with signal', () => {
    it('should handle termination by signal (lines 196-218)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('exit', null, 'SIGKILL');
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('terminated by signal SIGKILL');
    });

    it('should handle non-zero exit code on exit event (lines 208-215)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.stderr.emit('data', Buffer.from('Compilation error'));
        mockProc.emit('exit', 2, null);
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('exit code 2');
    });

    it('should resolve on zero exit code via exit event', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);
      mockReaddir.mockResolvedValue(['App.template.yml'] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('exit', 0, null);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
    });
  });

  describe('findTemplates', () => {
    it('should find all template files with different extensions (lines 235-252)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      // Include all supported template extensions
      mockReaddir.mockResolvedValue([
        'Stack1.template.json',
        'Stack2.template.yaml',
        'Stack3.template.yml',
        'manifest.json',
        'tree.json',
        'asset-12345',
      ] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.templatePaths).toHaveLength(3);
      expect(result.stackNames).toContain('Stack1');
      expect(result.stackNames).toContain('Stack2');
      expect(result.stackNames).toContain('Stack3');
    });

    it('should throw error when no templates found (lines 254-258)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      // No template files
      mockReaddir.mockResolvedValue([
        'manifest.json',
        'tree.json',
        'asset-12345',
      ] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('No CloudFormation templates found');
    });

    it('should handle readdir errors (lines 259-263)', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);
      mockReaddir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to find templates');
    });
  });

  describe('context handling', () => {
    it('should add context arguments correctly', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);
      mockReaddir.mockResolvedValue(['Stack.template.json'] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
        context: {
          env: 'prod',
          region: 'us-west-2',
        },
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      await resultPromise;

      // Verify spawn was called with context arguments
      expect(mockSpawn).toHaveBeenCalled();
      const spawnArgs = mockSpawn.mock.calls[0][1];
      expect(spawnArgs).toContain('-c');
      expect(spawnArgs).toContain('env=prod');
      expect(spawnArgs).toContain('region=us-west-2');
    });
  });

  describe('custom command handling', () => {
    it('should use custom command when provided', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);
      mockReaddir.mockResolvedValue(['Stack.template.json'] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
        customCommand: 'yarn cdk synth',
      });

      setImmediate(() => {
        mockProc.emit('close', 0);
      });

      await resultPromise;

      // Verify spawn was called with custom command
      expect(mockSpawn).toHaveBeenCalledWith('yarn', expect.arrayContaining(['cdk', 'synth']), expect.any(Object));
    });
  });

  describe('stdout/stderr handling', () => {
    it('should capture stdout and stderr data', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        mockProc.stdout.emit('data', Buffer.from('Bundling...'));
        mockProc.stderr.emit('data', Buffer.from('Error: Module not found'));
        mockProc.emit('close', 1);
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      // Error should include stderr content
      expect(result.error).toContain('exit code 1');
    });
  });

  describe('duplicate resolution prevention', () => {
    it('should not resolve multiple times when multiple events fire', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.pid = 12345;
      mockProc.killed = false;
      mockProc.kill = jest.fn();
      mockProc.removeAllListeners = jest.fn();
      mockProc.stdout.removeAllListeners = jest.fn();
      mockProc.stderr.removeAllListeners = jest.fn();

      mockSpawn.mockReturnValue(mockProc);
      mockReaddir.mockResolvedValue(['Stack.template.json'] as any);

      const resultPromise = orchestrator.synthesize({
        cdkAppPath: '/test/project',
      });

      setImmediate(() => {
        // Emit both close and exit - should only resolve once
        mockProc.emit('close', 0);
        mockProc.emit('exit', 0, null);
      });

      const result = await resultPromise;

      // Should succeed without hanging or throwing
      expect(result.success).toBe(true);
    });
  });
});
