import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SynthesisOptions, SynthesisResult, SynthesisError } from './types';

export class SynthesisOrchestrator {
  private readonly DEFAULT_OUTPUT_PATH = 'cdk.out';

  /**
   * Execute CDK synthesis
   */
  async synthesize(options: SynthesisOptions): Promise<SynthesisResult> {
    const startTime = Date.now();

    try {
      const outputPath = options.outputPath || this.DEFAULT_OUTPUT_PATH;
      const command = options.customCommand || 'npx cdk synth';

      await this.executeSynthesis(command, options.cdkAppPath, options.context, outputPath);

      const fullOutputPath = path.join(options.cdkAppPath, outputPath);
      const { templatePaths, stackNames } = await this.findTemplates(fullOutputPath);

      const duration = Date.now() - startTime;

      return {
        success: true,
        templatePaths,
        stackNames,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (error instanceof SynthesisError) {
        return {
          success: false,
          templatePaths: [],
          stackNames: [],
          error: errorMessage,
          duration,
        };
      }

      return {
        success: false,
        templatePaths: [],
        stackNames: [],
        error: `Synthesis failed: ${errorMessage}`,
        duration,
      };
    }
  }

  /**
   * Execute synthesis command
   *
   * Uses shell: false for security to prevent command injection attacks.
   * Arguments are passed as an array to avoid shell interpretation.
   */
  private async executeSynthesis(
    command: string,
    cdkAppPath: string,
    context?: Record<string, string>,
    outputPath?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');

      // Add context arguments
      const allArgs = [...args];
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          allArgs.push('-c', `${key}=${value}`);
        }
      }

      // Add output path if specified
      if (outputPath) {
        allArgs.push('--output', outputPath);
      }

      // Use shell: false for security and pass arguments properly
      const proc = spawn(cmd, allArgs, {
        cwd: cdkAppPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // Set up timeout to prevent hanging processes
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          proc.kill('SIGTERM');
          // Give process time to terminate gracefully, then force kill
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }, 5000);
          reject(
            new SynthesisError(
              'CDK synthesis timed out after 25 seconds',
              stderr || stdout,
            ),
          );
        }
      }, 25000); // 25 second timeout

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          reject(
            new SynthesisError(
              `Failed to execute synthesis command: ${error.message}`,
              stderr,
            ),
          );
        }
      });

      proc.on('close', (code: number | null) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          if (code !== 0) {
            reject(
              new SynthesisError(
                `CDK synthesis failed with exit code ${code}`,
                stderr || stdout,
              ),
            );
          } else {
            resolve();
          }
        }
      });
    });
  }

  /**
   * Find all CloudFormation templates in output directory
   */
  private async findTemplates(
    outputPath: string,
  ): Promise<{ templatePaths: string[]; stackNames: string[] }> {
    try {
      const files = await fs.readdir(outputPath);

      const templatePaths: string[] = [];
      const stackNames: string[] = [];

      for (const file of files) {
        // Match CloudFormation template files (stack-name.template.json or stack-name.template.yaml)
        if (
          file.endsWith('.template.json') ||
          file.endsWith('.template.yaml') ||
          file.endsWith('.template.yml')
        ) {
          const fullPath = path.join(outputPath, file);
          templatePaths.push(fullPath);

          // Extract stack name from filename
          const stackName = file
            .replace('.template.json', '')
            .replace('.template.yaml', '')
            .replace('.template.yml', '');
          stackNames.push(stackName);
        }
      }

      if (templatePaths.length === 0) {
        throw new Error('No CloudFormation templates found in output directory');
      }

      return { templatePaths, stackNames };
    } catch (error) {
      throw new Error(
        `Failed to find templates: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
