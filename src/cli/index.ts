#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import { analyzeCosts } from '../api';
import { PipelineOrchestrator } from '../pipeline/PipelineOrchestrator';
import { GitLabIntegration } from '../integrations/GitLabIntegration';

const program = new Command();

program
  .name('cdk-cost-analyzer')
  .description('Analyze AWS CDK infrastructure changes and provide cost impact summaries')
  .version('1.0.0');

// Original command for direct template comparison
program
  .command('compare')
  .description('Compare two CloudFormation templates')
  .argument('<base>', 'Path to base CloudFormation template')
  .argument('<target>', 'Path to target CloudFormation template')
  .option('--region <region>', 'AWS region', 'eu-central-1')
  .option('--format <format>', 'Output format: text|json|markdown', 'text')
  .option('--config <path>', 'Path to configuration file')
  .action(async (basePath: string, targetPath: string, options: { region: string; format: string; config?: string }) => {
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

// New pipeline command for CI/CD integration with synthesis
program
  .command('pipeline')
  .description('Run cost analysis in CI/CD pipeline with automatic synthesis')
  .option('--base <path>', 'Path to base template (if not using synthesis)')
  .option('--target <path>', 'Path to target template (if not using synthesis)')
  .option('--synth', 'Enable automatic CDK synthesis')
  .option('--cdk-app-path <path>', 'Path to CDK application directory')
  .option('--region <region>', 'AWS region', 'eu-central-1')
  .option('--config <path>', 'Path to configuration file')
  .option('--environment <env>', 'Environment name for threshold selection')
  .option('--format <format>', 'Output format: text|json|markdown', 'text')
  .option('--post-to-gitlab', 'Post results to GitLab merge request')
  .action(async (options: {
    base?: string;
    target?: string;
    synth?: boolean;
    cdkAppPath?: string;
    region: string;
    config?: string;
    environment?: string;
    format: string;
    postToGitlab?: boolean;
  }) => {
    try {
      // Check AWS credentials
      if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
        console.error('Error: AWS credentials not configured');
        console.error('');
        console.error('Please set AWS credentials using one of:');
        console.error('  - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
        console.error('  - AWS_PROFILE environment variable');
        console.error('  - AWS credentials file (~/.aws/credentials)');
        console.error('');
        console.error('For GitLab CI, configure AWS credentials in CI/CD variables:');
        console.error('  Settings > CI/CD > Variables');
        console.error('  Add: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION');
        process.exit(1);
      }

      const orchestrator = new PipelineOrchestrator();

      const result = await orchestrator.runPipelineAnalysis({
        baseTemplate: options.base,
        targetTemplate: options.target,
        synthesize: options.synth,
        cdkAppPath: options.cdkAppPath,
        region: options.region,
        configPath: options.config,
        environment: options.environment,
      });

      // Display results
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.costAnalysis.summary);
        console.log('');

        // Display threshold status
        if (result.thresholdStatus.level !== 'none') {
          console.log('='.repeat(80));
          console.log('THRESHOLD STATUS');
          console.log('='.repeat(80));
          console.log(result.thresholdStatus.message);
          console.log('');

          if (result.thresholdStatus.recommendations.length > 0) {
            console.log('Recommendations:');
            result.thresholdStatus.recommendations.forEach((rec, i) => {
              console.log(`${i + 1}. ${rec}`);
            });
            console.log('');
          }
        }

        // Display config summary
        if (result.configUsed.configPath || result.configUsed.thresholds) {
          console.log('='.repeat(80));
          console.log('CONFIGURATION');
          console.log('='.repeat(80));
          if (result.configUsed.configPath) {
            console.log(`Config file: ${result.configUsed.configPath}`);
          }
          if (result.configUsed.thresholds) {
            console.log(`Thresholds: warning=$${result.configUsed.thresholds.warning || 'none'}, error=$${result.configUsed.thresholds.error || 'none'}`);
            if (result.configUsed.thresholds.environment) {
              console.log(`Environment: ${result.configUsed.thresholds.environment}`);
            }
          }
          if (result.configUsed.excludedResourceTypes?.length) {
            console.log(`Excluded resources: ${result.configUsed.excludedResourceTypes.join(', ')}`);
          }
          console.log('');
        }
      }

      // Post to GitLab if requested
      if (options.postToGitlab) {
        const gitlabToken = process.env.GITLAB_TOKEN || process.env.CI_JOB_TOKEN;
        const projectId = process.env.CI_PROJECT_ID;
        const mergeRequestIid = process.env.CI_MERGE_REQUEST_IID;
        const gitlabUrl = process.env.CI_SERVER_URL;

        if (!gitlabToken || !projectId || !mergeRequestIid || !gitlabUrl) {
          console.error('Warning: GitLab environment variables not found. Skipping GitLab post.');
          console.error('Required: CI_JOB_TOKEN, CI_PROJECT_ID, CI_MERGE_REQUEST_IID, CI_SERVER_URL');
        } else {
          try {
            const gitlab = new GitLabIntegration(gitlabToken, gitlabUrl);
            await gitlab.postCommentToMR(
              projectId,
              parseInt(mergeRequestIid),
              result.costAnalysis.summary
            );
            console.log('Results posted to GitLab merge request');
          } catch (error) {
            console.error(`Warning: Failed to post to GitLab: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // Exit with appropriate code based on threshold
      if (result.thresholdStatus.level === 'error' && !result.thresholdStatus.passed) {
        console.error('Pipeline failed: Cost threshold exceeded');
        process.exit(2);
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

// Default to compare command for backward compatibility
program
  .argument('[base]', 'Path to base CloudFormation template')
  .argument('[target]', 'Path to target CloudFormation template')
  .option('--region <region>', 'AWS region', 'eu-central-1')
  .option('--format <format>', 'Output format: text|json|markdown', 'text')
  .option('--config <path>', 'Path to configuration file')
  .action(async (basePath?: string, targetPath?: string, options?: { region: string; format: string; config?: string }) => {
    if (!basePath || !targetPath) {
      program.help();
      return;
    }

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
        region: options?.region || 'eu-central-1',
        format: (options?.format as 'text' | 'json' | 'markdown') || 'text',
      });

      if (options?.format === 'json') {
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

program.parse();
