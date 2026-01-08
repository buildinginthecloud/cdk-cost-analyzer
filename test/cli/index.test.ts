import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
// Jest imports are global
import { analyzeCosts } from '../../src/api';

// Mock the API module
jest.mock('../../src/api', () => ({
  analyzeCosts: jest.fn(),
}));

describe('CLI Unit Tests', () => {
  const testDir = path.join(__dirname, 'test-templates-unit');
  const baseTemplatePath = path.join(testDir, 'base.json');
  const targetTemplatePath = path.join(testDir, 'target.json');
  const invalidTemplatePath = path.join(testDir, 'invalid.json');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const baseTemplate = {
      Resources: {
        Bucket1: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    };

    const targetTemplate = {
      Resources: {
        Bucket1: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
        Bucket2: {
          Type: 'AWS::S3::Bucket',
          Properties: {},
        },
      },
    };

    fs.writeFileSync(baseTemplatePath, JSON.stringify(baseTemplate, null, 2));
    fs.writeFileSync(targetTemplatePath, JSON.stringify(targetTemplate, null, 2));
    fs.writeFileSync(invalidTemplatePath, 'invalid json content');

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock implementation
    (analyzeCosts as any).mockResolvedValue({
      totalDelta: 10.5,
      currency: 'USD',
      addedResources: [],
      removedResources: [],
      modifiedResources: [],
      summary: 'Cost Analysis Summary\n\nTotal Monthly Cost Delta: +$10.50',
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // Test: CLI with valid template files
  it('should process valid template files successfully', async () => {
    const originalLog = console.log;
    const originalExit = process.exit;
    let stdoutOutput = '';
    let exitCode: number | undefined;

    class ExitError extends Error {
      constructor(public code: number) {
        super('EXIT_CALLED');
        this.name = 'ExitError';
      }
    }

    console.log = jest.fn((message: string) => {
      stdoutOutput += message + '\n';
    });

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new ExitError(code || 0);
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof ExitError) {
              throw error;
            }
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath]);
    } catch (error: any) {
      if (!(error instanceof Error && error.name === 'ExitError')) {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    expect(analyzeCosts).toHaveBeenCalled();
    expect(stdoutOutput).toContain('Cost Analysis Summary');
    expect(exitCode).toBe(0);
  });

  // Test: CLI with missing base file
  it('should exit with error when base template file is missing', async () => {
    const originalError = console.error;
    const originalExit = process.exit;
    let stderrOutput = '';
    let exitCode: number | undefined;

    console.error = jest.fn((...args: any[]) => {
      stderrOutput += args.join(' ') + '\n';
    });

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new Error('EXIT_CALLED');
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', '/nonexistent/base.json', targetTemplatePath]);
    } catch (error: any) {
      if (error.message !== 'EXIT_CALLED') {
        throw error;
      }
    } finally {
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(stderrOutput).toContain('Error: Base template file not found');
    expect(exitCode).toBe(1);
  });

  // Test: CLI with missing target file
  it('should exit with error when target template file is missing', async () => {
    const originalError = console.error;
    const originalExit = process.exit;
    let stderrOutput = '';
    let exitCode: number | undefined;

    console.error = jest.fn((...args: any[]) => {
      stderrOutput += args.join(' ') + '\n';
    });

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new Error('EXIT_CALLED');
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, '/nonexistent/target.json']);
    } catch (error: any) {
      if (error.message !== 'EXIT_CALLED') {
        throw error;
      }
    } finally {
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(stderrOutput).toContain('Error: Target template file not found');
    expect(exitCode).toBe(1);
  });

  // Test: CLI with invalid region
  it('should handle invalid region gracefully', async () => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalExit = process.exit;
    let stderrOutput = '';
    let exitCode: number | undefined;

    console.error = jest.fn((...args: any[]) => {
      stderrOutput += args.join(' ') + '\n';
    });

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new Error('EXIT_CALLED');
    });

    // Mock analyzeCosts to throw error for invalid region
    (analyzeCosts as any).mockRejectedValueOnce(new Error('Invalid region: invalid-region-123'));

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath, '--region', 'invalid-region-123']);
    } catch (error: any) {
      if (error.message !== 'EXIT_CALLED') {
        throw error;
      }
    } finally {
      console.log = originalLog;
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(stderrOutput).toContain('Error:');
    expect(stderrOutput).toContain('Invalid region');
    expect(exitCode).toBe(1);
  });

  // Test: --help flag
  it('should display help information when --help flag is used', () => {
    const program = new Command();
    program
      .name('cdk-cost-analyzer')
      .description('Analyze AWS CDK infrastructure changes and provide cost impact summaries')
      .version('1.0.0')
      .argument('<base>', 'Path to base CloudFormation template')
      .argument('<target>', 'Path to target CloudFormation template')
      .option('--region <region>', 'AWS region', 'eu-central-1')
      .option('--format <format>', 'Output format: text|json|markdown', 'text');

    const helpText = program.helpInformation();

    expect(helpText).toContain('cdk-cost-analyzer');
    expect(helpText).toContain('Analyze AWS CDK infrastructure changes');
    expect(helpText).toContain('--region');
    expect(helpText).toContain('--format');
    expect(helpText).toContain('<base>');
    expect(helpText).toContain('<target>');
  });

  // Test: --version flag
  it('should display version when --version flag is used', () => {
    const program = new Command();
    program
      .name('cdk-cost-analyzer')
      .version('1.0.0');

    expect(program.version()).toBe('1.0.0');
  });

  // Test: Output to stdout (text format)
  it('should output text report to stdout', async () => {
    const originalLog = console.log;
    const originalExit = process.exit;
    let stdoutOutput = '';
    let exitCode: number | undefined;

    class ExitError extends Error {
      constructor(public code: number) {
        super('EXIT_CALLED');
        this.name = 'ExitError';
      }
    }

    console.log = jest.fn((message: string) => {
      stdoutOutput += message + '\n';
    });

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new ExitError(code || 0);
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof ExitError) {
              throw error;
            }
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath, '--format', 'text']);
    } catch (error: any) {
      if (!(error instanceof Error && error.name === 'ExitError')) {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    expect(stdoutOutput).toContain('Cost Analysis Summary');
    expect(stdoutOutput).not.toContain('{'); // Should not be JSON
    expect(exitCode).toBe(0);
  });

  // Test: Output to stdout (JSON format)
  it('should output JSON report to stdout', async () => {
    const originalLog = console.log;
    const originalExit = process.exit;
    let stdoutOutput = '';
    let exitCode: number | undefined;

    class ExitError extends Error {
      constructor(public code: number) {
        super('EXIT_CALLED');
        this.name = 'ExitError';
      }
    }

    console.log = jest.fn((message: string) => {
      stdoutOutput += message + '\n';
    });

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new ExitError(code || 0);
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof ExitError) {
              throw error;
            }
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath, '--format', 'json']);
    } catch (error: any) {
      if (!(error instanceof Error && error.name === 'ExitError')) {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    expect(stdoutOutput).toContain('{');
    expect(stdoutOutput).toContain('totalDelta');
    expect(stdoutOutput).toContain('currency');

    // Verify it's valid JSON
    const jsonOutput = stdoutOutput.trim();
    expect(() => JSON.parse(jsonOutput)).not.toThrow();

    expect(exitCode).toBe(0);
  });

  // Test: Error output to stderr
  it('should output errors to stderr', async () => {
    const originalError = console.error;
    const originalExit = process.exit;
    let stderrOutput = '';
    let exitCode: number | undefined;

    console.error = jest.fn((...args: any[]) => {
      stderrOutput += args.join(' ') + '\n';
    });

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new Error('EXIT_CALLED');
    });

    // Mock analyzeCosts to throw an error
    (analyzeCosts as any).mockRejectedValueOnce(new Error('Failed to parse template'));

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath]);
    } catch (error: any) {
      if (error.message !== 'EXIT_CALLED') {
        throw error;
      }
    } finally {
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(stderrOutput).toContain('Error:');
    expect(stderrOutput).toContain('Failed to parse template');
    expect(exitCode).toBe(1);
  });

  // Test: Exit codes - success
  it('should exit with code 0 on success', async () => {
    const originalLog = console.log;
    const originalExit = process.exit;
    let exitCode: number | undefined;

    class ExitError extends Error {
      constructor(public code: number) {
        super('EXIT_CALLED');
        this.name = 'ExitError';
      }
    }

    console.log = jest.fn();

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new ExitError(code || 0);
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof ExitError) {
              throw error;
            }
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath]);
    } catch (error: any) {
      if (!(error instanceof Error && error.name === 'ExitError')) {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    expect(exitCode).toBe(0);
  });

  // Test: Exit codes - failure
  it('should exit with code 1 on failure', async () => {
    const originalError = console.error;
    const originalExit = process.exit;
    let exitCode: number | undefined;

    console.error = jest.fn();

    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code || 0;
      throw new Error('EXIT_CALLED');
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', '/nonexistent/base.json', targetTemplatePath]);
    } catch (error: any) {
      if (error.message !== 'EXIT_CALLED') {
        throw error;
      }
    } finally {
      console.error = originalError;
      process.exit = originalExit;
    }

    expect(exitCode).toBe(1);
  });

  // Test: Default region value
  it('should use default region eu-central-1 when not specified', async () => {
    const originalLog = console.log;
    const originalExit = process.exit;

    console.log = jest.fn();

    (process.exit as any) = jest.fn((_code?: number) => {
      throw new Error('EXIT_CALLED');
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath]);
    } catch (error: any) {
      if (error.message !== 'EXIT_CALLED') {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    expect(analyzeCosts).toHaveBeenCalled();
    const callArgs = (analyzeCosts as any).mock.calls[0][0];
    expect(callArgs.region).toBe('eu-central-1');
  });

  // Test: Default format value
  it('should use default format text when not specified', async () => {
    const originalLog = console.log;
    const originalExit = process.exit;

    console.log = jest.fn();

    (process.exit as any) = jest.fn((_code?: number) => {
      throw new Error('EXIT_CALLED');
    });

    try {
      const program = new Command();
      program
        .name('cdk-cost-analyzer')
        .argument('<base>', 'Path to base CloudFormation template')
        .argument('<target>', 'Path to target CloudFormation template')
        .option('--region <region>', 'AWS region', 'eu-central-1')
        .option('--format <format>', 'Output format: text|json|markdown', 'text')
        .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
          try {
            if (!fs.existsSync(basePath)) {
              console.error(`Error: Base template file not found: ${basePath}`);
              process.exit(1);
            }

            if (!fs.existsSync(targetPath)) {
              console.error(`Error: Target template file not found: ${targetPath}`);
              process.exit(1);
            }

            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            const result = await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });

            if (options.format === 'json') {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(result.summary);
            }

            process.exit(0);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Error: ${error.message}`);
            } else {
              console.error(`Error: ${String(error)}`);
            }
            process.exit(1);
          }
        });

      await program.parseAsync(['node', 'cli', baseTemplatePath, targetTemplatePath]);
    } catch (error: any) {
      if (error.message !== 'EXIT_CALLED') {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    expect(analyzeCosts).toHaveBeenCalled();
    const callArgs = (analyzeCosts as any).mock.calls[0][0];
    expect(callArgs.format).toBe('text');
  });
});
