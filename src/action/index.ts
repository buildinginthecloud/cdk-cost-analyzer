#!/usr/bin/env node
/**
 * GitHub Action entry point for cdk-cost-analyzer.
 *
 * This module parses GitHub Action inputs, runs cost analysis,
 * and posts formatted comments to pull requests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PipelineOrchestrator } from '../pipeline/PipelineOrchestrator';
import { GitHubIntegration } from '../integrations/GitHubIntegration';
import { CommentStrategy } from '../integrations/types';
import { GitHubActionReporter } from '../reporter/GitHubActionReporter';
import { Logger } from '../utils/Logger';

/**
 * Get action input from environment variable.
 * GitHub Actions sets INPUT_<NAME> for each input.
 */
function getInput(name: string, required: boolean = false): string | undefined {
  const envName = `INPUT_${name.toUpperCase().replace(/-/g, '_')}`;
  const value = process.env[envName] || '';

  if (required && !value) {
    throw new Error(`Input required and not supplied: ${name}`);
  }

  return value || undefined;
}

/**
 * Set action output by writing to GITHUB_OUTPUT file.
 */
function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

/**
 * Set action to failed status.
 */
function setFailed(message: string): void {
  console.error(`::error::${message}`);
  process.exit(1);
}

/**
 * Log a warning message.
 */
function warning(message: string): void {
  console.log(`::warning::${message}`);
}

/**
 * Log an info message.
 */
function info(message: string): void {
  console.log(message);
}

/**
 * Log a debug message.
 */
function debug(message: string): void {
  console.log(`::debug::${message}`);
}

/**
 * Detect CDK app directory by looking for cdk.json.
 */
function detectCdkApp(startPath: string): string | undefined {
  // Check if cdk.json exists in the provided path
  const cdkJsonPath = path.join(startPath, 'cdk.json');
  if (fs.existsSync(cdkJsonPath)) {
    return startPath;
  }

  // Check common subdirectories
  const commonDirs = ['infrastructure', 'cdk', 'infra', 'deploy'];
  for (const dir of commonDirs) {
    const subPath = path.join(startPath, dir);
    const subCdkJson = path.join(subPath, 'cdk.json');
    if (fs.existsSync(subCdkJson)) {
      return subPath;
    }
  }

  return undefined;
}

/**
 * Parse PR number from GitHub event.
 */
function getPRNumber(): number | undefined {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    return undefined;
  }

  try {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
    return event.pull_request?.number || event.issue?.number;
  } catch {
    return undefined;
  }
}

/**
 * Parse repository owner and name from GITHUB_REPOSITORY.
 */
function parseRepository(): { owner: string; repo: string } | undefined {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return undefined;
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    return undefined;
  }

  return { owner, repo };
}

/**
 * Main action entry point.
 */
async function run(): Promise<void> {
  try {
    // Parse inputs
    const inputPath = getInput('path') || './';
    const githubToken = getInput('github-token', true)!;
    const awsRegion = getInput('aws-region') || 'us-east-1';
    const configPath = getInput('config-path');
    const commentStrategy = (getInput('comment-strategy') || 'update') as CommentStrategy;
    const debugMode = getInput('debug') === 'true';

    // Enable debug logging if requested
    if (debugMode) {
      Logger.setDebugEnabled(true);
      debug('Debug logging enabled');
    }

    info('Starting CDK Cost Analysis...');

    // Validate GitHub context
    const repoInfo = parseRepository();
    if (!repoInfo) {
      setFailed('Could not determine repository from GITHUB_REPOSITORY environment variable');
      return;
    }

    const prNumber = getPRNumber();
    if (!prNumber) {
      warning('Not running in a pull request context. Skipping PR comment.');
    }

    // Detect or use provided CDK app path
    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
    const basePath = path.isAbsolute(inputPath)
      ? inputPath
      : path.join(workspacePath, inputPath);

    let cdkAppPath = detectCdkApp(basePath);

    if (!cdkAppPath) {
      warning(`Could not detect CDK app in ${basePath}. Using provided path.`);
      cdkAppPath = basePath;
    } else {
      info(`Detected CDK app at: ${cdkAppPath}`);
    }

    // Check if synthesis is needed
    const cdkOutDir = path.join(cdkAppPath, 'cdk.out');
    const needsSynthesis = !fs.existsSync(cdkOutDir);

    if (needsSynthesis) {
      info('CDK output not found. Synthesis will be performed.');
    }

    // Run cost analysis
    const orchestrator = new PipelineOrchestrator();

    info(`Running cost analysis for region: ${awsRegion}`);

    const result = await orchestrator.runPipelineAnalysis({
      synthesize: needsSynthesis,
      cdkAppPath: cdkAppPath,
      region: awsRegion,
      configPath: configPath,
    });

    // Generate GitHub-formatted report
    const reporter = new GitHubActionReporter();
    const report = reporter.generateReport({
      totalDelta: result.costAnalysis.totalDelta,
      currency: result.costAnalysis.currency,
      addedCosts: result.costAnalysis.addedResources,
      removedCosts: result.costAnalysis.removedResources,
      modifiedCosts: result.costAnalysis.modifiedResources,
    });

    // Output to console
    console.log('\n' + report + '\n');

    // Set outputs
    setOutput('total-delta', result.costAnalysis.totalDelta.toString());
    setOutput('currency', result.costAnalysis.currency);
    setOutput('added-count', result.costAnalysis.addedResources.length.toString());
    setOutput('removed-count', result.costAnalysis.removedResources.length.toString());
    setOutput('modified-count', result.costAnalysis.modifiedResources.length.toString());
    setOutput('threshold-passed', result.thresholdStatus.passed.toString());
    setOutput('threshold-level', result.thresholdStatus.level);

    // Post comment to PR if in PR context
    if (prNumber) {
      info(`Posting cost analysis to PR #${prNumber}...`);

      const github = new GitHubIntegration({
        token: githubToken,
        apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
      });

      await github.postPRComment(
        repoInfo.owner,
        repoInfo.repo,
        prNumber,
        report,
        commentStrategy,
      );

      info('Cost analysis posted to pull request');
    }

    // Check threshold status
    if (result.thresholdStatus.level === 'error' && !result.thresholdStatus.passed) {
      setFailed(`Cost threshold exceeded: ${result.thresholdStatus.message}`);
      return;
    }

    if (result.thresholdStatus.level === 'warning' && !result.thresholdStatus.passed) {
      warning(`Cost threshold warning: ${result.thresholdStatus.message}`);
    }

    info('Cost analysis completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed(String(error));
    }
  }
}

// Run the action
run();
