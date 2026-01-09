import { execSync } from 'child_process';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';
import * as path from 'path';

export interface WorkflowJob {
  name?: string;
  'runs-on': string | string[];
  steps: Array<{
    name?: string;
    uses?: string;
    run?: string;
    with?: Record<string, any>;
    env?: Record<string, string>;
  }>;
  env?: Record<string, string>;
  permissions?: Record<string, string>;
}

export interface GitHubWorkflow {
  name: string;
  on: Record<string, any>;
  jobs: Record<string, WorkflowJob>;
}

export class WorkflowTester {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = path.resolve(__dirname, '../..')) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Check if act is available on the system
   */
  isActAvailable(): boolean {
    try {
      execSync('which act', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse a GitHub workflow file
   */
  parseWorkflow(workflowPath: string): GitHubWorkflow {
    const fullPath = path.join(this.workspaceRoot, workflowPath);
    const content = readFileSync(fullPath, 'utf8');
    return yaml.load(content) as GitHubWorkflow;
  }

  /**
   * List jobs in a workflow using act
   */
  listWorkflowJobs(jobName?: string): string {
    if (!this.isActAvailable()) {
      throw new Error('act is not available. Install with: brew install act');
    }

    const command = jobName ? `act -j ${jobName} --list` : 'act --list';
    
    return execSync(command, {
      cwd: this.workspaceRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  }

  /**
   * Validate workflow syntax using act (dry run)
   */
  validateWorkflow(jobName?: string): boolean {
    if (!this.isActAvailable()) {
      throw new Error('act is not available. Install with: brew install act');
    }

    try {
      const command = jobName ? `act -j ${jobName} --dryrun` : 'act --dryrun';
      
      const result = execSync(command, {
        cwd: this.workspaceRoot,
        stdio: 'pipe',
        timeout: 15000, // 15 second timeout for validation
        encoding: 'utf8',
      });
      
      // Check if the dry run completed without errors
      // Act dry run should not contain error messages
      return !result.toLowerCase().includes('error') && 
             !result.toLowerCase().includes('failed');
    } catch (error) {
      // If act command fails, the workflow likely has syntax issues
      console.warn('Workflow validation failed:', error);
      return false;
    }
  }

  /**
   * Run workflow with act (use carefully - this actually executes)
   */
  async runWorkflow(jobName: string, options: {
    dryRun?: boolean;
    timeout?: number;
    env?: Record<string, string>;
  } = {}): Promise<string> {
    if (!this.isActAvailable()) {
      throw new Error('act is not available. Install with: brew install act');
    }

    const {
      dryRun = true,
      timeout = 30000,
      env = {},
    } = options;

    let command = `act -j ${jobName}`;
    if (dryRun) {
      command += ' --dryrun';
    }

    // Add environment variables
    for (const [key, value] of Object.entries(env)) {
      command += ` --env ${key}=${value}`;
    }

    return execSync(command, {
      cwd: this.workspaceRoot,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout,
    });
  }

  /**
   * Validate workflow structure and required fields
   */
  validateWorkflowStructure(workflow: GitHubWorkflow): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!workflow.name) {
      errors.push('Workflow must have a name');
    }

    if (!workflow.on) {
      errors.push('Workflow must have trigger events (on)');
    }

    if (!workflow.jobs || Object.keys(workflow.jobs).length === 0) {
      errors.push('Workflow must have at least one job');
    }

    // Validate each job
    for (const [jobId, job] of Object.entries(workflow.jobs || {})) {
      if (!job['runs-on']) {
        errors.push(`Job '${jobId}' must specify runs-on`);
      }

      if (!job.steps || job.steps.length === 0) {
        errors.push(`Job '${jobId}' must have at least one step`);
      }

      // Validate steps
      job.steps?.forEach((step, index) => {
        if (!step.uses && !step.run) {
          errors.push(`Job '${jobId}' step ${index + 1} must have either 'uses' or 'run'`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}