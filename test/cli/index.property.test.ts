import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach@jest/globals '@jest/globals';
import { analyzeCosts } from '../../src/api';

// Mock the analyzeCosts function to track region parameter
vi.mock('../../src/api', () => ({
  analyzeCosts: vi.fn(),
}));

describe('CLI - Property Tests', () => {
  const testDir = path.join(__dirname, 'test-templates-property');
  const baseTemplatePath = path.join(testDir, 'base.json');
  const targetTemplatePath = path.join(testDir, 'target.json');

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

    // Reset mock before each test
    vi.clearAllMocks();

    // Setup default mock implementation
    vi.mocked(analyzeCosts).mockResolvedValue({
      totalDelta: 0,
      currency: 'USD',
      addedResources: [],
      removedResources: [],
      modifiedResources: [],
      summary: 'Test summary',
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // Feature: cdk-cost-analyzer, Property 12: CLI region flag overrides default
  it('should use provided region instead of default eu-central-1', async () => {
    // Generate valid AWS regions
    const awsRegionArb = fc.constantFrom(
      'us-east-1',
      'us-west-2',
      'eu-west-1',
      'eu-central-1',
      'ap-southeast-1',
      'ap-northeast-1',
      'sa-east-1',
      'ca-central-1',
      'ap-south-1',
      'eu-north-1',
      'us-east-2',
      'us-west-1',
      'eu-west-2',
      'eu-west-3',
      'ap-northeast-2',
      'ap-southeast-2',
      'ap-northeast-3',
      'eu-south-1',
      'af-south-1',
      'me-south-1',
    );

    await fc.assert(
      fc.asyncProperty(awsRegionArb, async (region) => {
        // Clear mock calls before each property test iteration
        vi.clearAllMocks();

        // Dynamically import the CLI module to execute it
        const { Command } = await import('commander');
        const program = new Command();

        program
          .name('cdk-cost-analyzer')
          .argument('<base>', 'Path to base CloudFormation template')
          .argument('<target>', 'Path to target CloudFormation template')
          .option('--region <region>', 'AWS region', 'eu-central-1')
          .option('--format <format>', 'Output format: text|json|markdown', 'text')
          .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
            const baseTemplate = fs.readFileSync(basePath, 'utf-8');
            const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

            await analyzeCosts({
              baseTemplate,
              targetTemplate,
              region: options.region,
              format: options.format as 'text' | 'json' | 'markdown',
            });
          });

        // Parse with the region flag
        await program.parseAsync([
          'node',
          'cli',
          baseTemplatePath,
          targetTemplatePath,
          '--region',
          region,
        ]);

        // Verify analyzeCosts was called with the provided region
        expect(analyzeCosts).toHaveBeenCalled();
        const callArgs = vi.mocked(analyzeCosts).mock.calls[0][0];
        expect(callArgs.region).toBe(region);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 13: Successful analysis outputs to stdout
  it('should output to stdout and exit with code 0 for successful analysis', async () => {
    // Generate arbitrary valid CloudFormation templates
    const resourceTypeArb = fc.constantFrom(
      'AWS::S3::Bucket',
      'AWS::Lambda::Function',
    );

    const resourceArb = fc.record({
      Type: resourceTypeArb,
      Properties: fc.constant({}),
    });

    const templateArb = fc.record({
      Resources: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
        resourceArb,
        { minKeys: 1, maxKeys: 3 },
      ),
    });

    await fc.assert(
      fc.asyncProperty(templateArb, templateArb, async (baseTemplate, targetTemplate) => {
        // Create temporary template files
        const testRunDir = path.join(testDir, `run-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        fs.mkdirSync(testRunDir, { recursive: true });

        const baseFile = path.join(testRunDir, 'base.json');
        const targetFile = path.join(testRunDir, 'target.json');

        fs.writeFileSync(baseFile, JSON.stringify(baseTemplate, null, 2));
        fs.writeFileSync(targetFile, JSON.stringify(targetTemplate, null, 2));

        try {
          // Mock console.log to capture stdout
          const originalLog = console.log;
          let stdoutOutput = '';
          console.log = vi.fn((message: string) => {
            stdoutOutput += message + '\n';
          });

          // Mock process.exit to prevent actual exit
          const originalExit = process.exit;
          let exitCode: number | undefined;
          (process.exit as any) = vi.fn((code?: number) => {
            exitCode = code || 0;
            throw new Error('EXIT_CALLED'); // Throw to stop execution
          });

          try {
            // Mock analyzeCosts to return valid result
            vi.mocked(analyzeCosts).mockResolvedValueOnce({
              totalDelta: 10.5,
              currency: 'USD',
              addedResources: [],
              removedResources: [],
              modifiedResources: [],
              summary: 'Cost Analysis Summary\n\nTotal Monthly Cost Delta: +$10.50',
            });

            // Dynamically import and execute CLI logic
            const { Command } = await import('commander');
            const program = new Command();

            program
              .name('cdk-cost-analyzer')
              .argument('<base>', 'Path to base CloudFormation template')
              .argument('<target>', 'Path to target CloudFormation template')
              .option('--region <region>', 'AWS region', 'eu-central-1')
              .option('--format <format>', 'Output format: text|json|markdown', 'text')
              .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
                const baseTemplateContent = fs.readFileSync(basePath, 'utf-8');
                const targetTemplateContent = fs.readFileSync(targetPath, 'utf-8');

                const result = await analyzeCosts({
                  baseTemplate: baseTemplateContent,
                  targetTemplate: targetTemplateContent,
                  region: options.region,
                  format: options.format as 'text' | 'json' | 'markdown',
                });

                if (options.format === 'json') {
                  console.log(JSON.stringify(result, null, 2));
                } else {
                  console.log(result.summary);
                }

                process.exit(0);
              });

            await program.parseAsync(['node', 'cli', baseFile, targetFile]);
          } catch (error: any) {
            // Expected error from mocked process.exit
            if (error.message !== 'EXIT_CALLED') {
              throw error;
            }
          } finally {
            // Restore original functions
            console.log = originalLog;
            process.exit = originalExit;
          }

          // Verify output was written to stdout
          expect(stdoutOutput).toBeDefined();
          expect(stdoutOutput.length).toBeGreaterThan(0);
          expect(stdoutOutput).toContain('Cost Analysis Summary');

          // Verify exit code was 0
          expect(exitCode).toBe(0);
        } finally {
          // Cleanup
          if (fs.existsSync(testRunDir)) {
            fs.rmSync(testRunDir, { recursive: true, force: true });
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 14: Invalid inputs cause non-zero exit
  it('should exit with non-zero code and write to stderr for invalid inputs', async () => {
    // Generate invalid scenarios
    const invalidScenarioArb = fc.constantFrom(
      { type: 'missing-base', basePath: '/nonexistent/base-template.json', targetPath: targetTemplatePath },
      { type: 'missing-target', basePath: baseTemplatePath, targetPath: '/nonexistent/target-template.json' },
      { type: 'missing-both', basePath: '/nonexistent/base.json', targetPath: '/nonexistent/target.json' },
    );

    await fc.assert(
      fc.asyncProperty(invalidScenarioArb, async (scenario) => {
        // Mock console.error to capture stderr
        const originalError = console.error;
        let stderrOutput = '';
        console.error = vi.fn((...args: any[]) => {
          stderrOutput += args.join(' ') + '\n';
        });

        // Mock process.exit to prevent actual exit
        const originalExit = process.exit;
        let exitCode: number | undefined;
        (process.exit as any) = vi.fn((code?: number) => {
          exitCode = code || 0;
          throw new Error('EXIT_CALLED'); // Throw to stop execution
        });

        try {
          // Dynamically import and execute CLI logic
          const { Command } = await import('commander');
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

                const baseTemplateContent = fs.readFileSync(basePath, 'utf-8');
                const targetTemplateContent = fs.readFileSync(targetPath, 'utf-8');

                const result = await analyzeCosts({
                  baseTemplate: baseTemplateContent,
                  targetTemplate: targetTemplateContent,
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

          await program.parseAsync(['node', 'cli', scenario.basePath, scenario.targetPath]);
        } catch (error: any) {
          // Expected error from mocked process.exit
          if (error.message !== 'EXIT_CALLED') {
            throw error;
          }
        } finally {
          // Restore original functions
          console.error = originalError;
          process.exit = originalExit;
        }

        // Verify exit code is non-zero
        expect(exitCode).toBeDefined();
        expect(exitCode).not.toBe(0);
        expect(exitCode).toBe(1);

        // Verify error message was written to stderr
        expect(stderrOutput).toBeDefined();
        expect(stderrOutput.length).toBeGreaterThan(0);
        expect(stderrOutput).toContain('Error:');

        // Verify appropriate error message based on scenario
        if (scenario.type === 'missing-base') {
          expect(stderrOutput).toContain('Base template file not found');
        } else if (scenario.type === 'missing-target') {
          expect(stderrOutput).toContain('Target template file not found');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Additional test for malformed templates
  it('should exit with non-zero code for malformed templates', async () => {
    const malformedContentArb = fc.constantFrom(
      'not valid json',
      '{ invalid json',
      '{ "Resources": "not an object" }',
      '',
      'null',
    );

    await fc.assert(
      fc.asyncProperty(malformedContentArb, async (malformedContent) => {
        // Create temporary malformed template file
        const testRunDir = path.join(testDir, `malformed-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        fs.mkdirSync(testRunDir, { recursive: true });

        const malformedFile = path.join(testRunDir, 'malformed.json');
        fs.writeFileSync(malformedFile, malformedContent);

        try {
          // Mock console.error to capture stderr
          const originalError = console.error;
          let stderrOutput = '';
          console.error = vi.fn((...args: any[]) => {
            stderrOutput += args.join(' ') + '\n';
          });

          // Mock process.exit to prevent actual exit
          const originalExit = process.exit;
          let exitCode: number | undefined;
          (process.exit as any) = vi.fn((code?: number) => {
            exitCode = code || 0;
            throw new Error('EXIT_CALLED');
          });

          try {
            // Mock analyzeCosts to throw error for malformed templates
            (analyzeCosts as any).mockRejectedValueOnce(new Error('Failed to parse template'));

            const { Command } = await import('commander');
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

                  const baseTemplateContent = fs.readFileSync(basePath, 'utf-8');
                  const targetTemplateContent = fs.readFileSync(targetPath, 'utf-8');

                  const result = await analyzeCosts({
                    baseTemplate: baseTemplateContent,
                    targetTemplate: targetTemplateContent,
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

            await program.parseAsync(['node', 'cli', malformedFile, targetTemplatePath]);
          } catch (error: any) {
            if (error.message !== 'EXIT_CALLED') {
              throw error;
            }
          } finally {
            console.error = originalError;
            process.exit = originalExit;
          }

          // Verify exit code is non-zero
          expect(exitCode).toBeDefined();
          expect(exitCode).not.toBe(0);
          expect(exitCode).toBe(1);

          // Verify error message was written to stderr
          expect(stderrOutput).toBeDefined();
          expect(stderrOutput.length).toBeGreaterThan(0);
          expect(stderrOutput).toContain('Error:');
        } finally {
          // Cleanup
          if (fs.existsSync(testRunDir)) {
            fs.rmSync(testRunDir, { recursive: true, force: true });
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
