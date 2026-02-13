#!/usr/bin/env node
/**
 * GitHub Action entry point for cdk-cost-analyzer.
 *
 * This module parses GitHub Action inputs, runs cost analysis,
 * and posts formatted comments to pull requests.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { PipelineOrchestrator } from '../pipeline/PipelineOrchestrator';
import { GitHubIntegration } from '../integrations/GitHubIntegration';
import { CommentStrategy } from '../integrations/types';
import { GitHubActionReporter } from '../reporter/GitHubActionReporter';
import { Logger } from '../utils/Logger';

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
 * Parse PR number from GitHub context.
 * Only returns number for pull_request events.
 */
function getPRNumber(): number | undefined {
  const context = github.context;

  // Only accept pull_request events
  if (context.eventName === 'pull_request' && context.payload.pull_request) {
    return context.payload.pull_request.number;
  }

  return undefined;
}

/**
 * Parse repository owner and name from GitHub context.
 */
function parseRepository(): { owner: string; repo: string } | undefined {
  const context = github.context;

  if (context.repo.owner && context.repo.repo) {
    return {
      owner: context.repo.owner,
      repo: context.repo.repo,
    };
  }

  return undefined;
}

/**
 * Validate and sanitize input path to prevent path traversal.
 */
function validatePath(inputPath: string): string {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const resolved = path.resolve(workspace, inputPath);

  // Ensure path is within workspace
  if (!resolved.startsWith(workspace)) {
    throw new Error(`Path '${inputPath}' is outside workspace. Potential path traversal attack.`);
  }

  return resolved;
}

/**
 * Validate comment strategy input.
 */
function validateCommentStrategy(value: string): CommentStrategy {
  const validStrategies: CommentStrategy[] = ['new', 'update', 'delete-and-new'];
  if (!validStrategies.includes(value as CommentStrategy)) {
    throw new Error(
      `Invalid comment-strategy: '${value}'. Must be one of: ${validStrategies.join(', ')}`
    );
  }
  return value as CommentStrategy;
}

/**
 * Main action entry point.
 */
async function run(): Promise<void> {
  try {
    // Parse and validate inputs
    const rawInputPath = core.getInput('path') || './';
    const inputPath = validatePath(rawInputPath);
    const githubToken = core.getInput('github-token', { required: true });
    const awsRegion = core.getInput('aws-region') || 'us-east-1';
    const configPath = core.getInput('config-path');
    const rawCommentStrategy = core.getInput('comment-strategy') || 'update';
    const commentStrategy = validateCommentStrategy(rawCommentStrategy);
    const debugMode = core.getBooleanInput('debug');

    // Enable debug logging if requested
    if (debugMode) {
      Logger.setDebugEnabled(true);
      core.debug('Debug logging enabled');
    }

    core.info('Starting CDK Cost Analysis...');

    // Validate GitHub context
    const repoInfo = parseRepository();
    if (!repoInfo) {
      core.setFailed('Could not determine repository from GitHub context');
      return;
    }

    const prNumber = getPRNumber();
    if (!prNumber) {
      core.warning('Not running in a pull_request event. Skipping PR comment.');
    }

    // Detect or use provided CDK app path
    let cdkAppPath = detectCdkApp(inputPath);

    if (!cdkAppPath) {
      core.warning(`Could not detect CDK app in ${inputPath}. Using provided path.`);
      cdkAppPath = inputPath;
    } else {
      core.info(`Detected CDK app at: ${cdkAppPath}`);
    }

    // Check if synthesis is needed
    const cdkOutDir = path.join(cdkAppPath, 'cdk.out');
    const needsSynthesis = !fs.existsSync(cdkOutDir);

    if (needsSynthesis) {
      core.info('CDK output not found. Synthesis will be performed.');
    }

    // Run cost analysis
    const orchestrator = new PipelineOrchestrator();

    core.info(`Running cost analysis for region: ${awsRegion}`);

    const result = await orchestrator.runPipelineAnalysis({
      synthesize: needsSynthesis,
      cdkAppPath: cdkAppPath,
      region: awsRegion,
      configPath: configPath,
    });

    // Calculate base and target costs
    const baseCost = result.costAnalysis.removedResources.reduce(
      (sum, r) => sum + r.monthlyCost.amount,
      0
    ) + result.costAnalysis.modifiedResources.reduce(
      (sum, r) => sum + r.oldMonthlyCost.amount,
      0
    );

    const targetCost = result.costAnalysis.addedResources.reduce(
      (sum, r) => sum + r.monthlyCost.amount,
      0
    ) + result.costAnalysis.modifiedResources.reduce(
      (sum, r) => sum + r.newMonthlyCost.amount,
      0
    );

    // Generate GitHub-formatted report
    const reporter = new GitHubActionReporter();
    const costDelta = {
      totalDelta: result.costAnalysis.totalDelta,
      currency: result.costAnalysis.currency,
      addedCosts: result.costAnalysis.addedResources,
      removedCosts: result.costAnalysis.removedResources,
      modifiedCosts: result.costAnalysis.modifiedResources,
    };
    const report = reporter.generateReport(
      costDelta,
      baseCost,
      targetCost,
    );

    // Output to console
    console.log('\n' + report + '\n');

    // Set outputs
    core.setOutput('total-delta', result.costAnalysis.totalDelta.toString());
    core.setOutput('currency', result.costAnalysis.currency);
    core.setOutput('added-count', result.costAnalysis.addedResources.length.toString());
    core.setOutput('removed-count', result.costAnalysis.removedResources.length.toString());
    core.setOutput('modified-count', result.costAnalysis.modifiedResources.length.toString());
    core.setOutput('threshold-passed', result.thresholdStatus.passed.toString());
    core.setOutput('threshold-level', result.thresholdStatus.level);

    // Post comment to PR if in PR context
    if (prNumber) {
      core.info(`Posting cost analysis to PR #${prNumber}...`);

      const integration = new GitHubIntegration({
        token: githubToken,
        apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
      });

      await integration.postPRComment(
        repoInfo.owner,
        repoInfo.repo,
        prNumber,
        report,
        commentStrategy,
      );

      core.info('Cost analysis posted to pull request');
    }

    // Check threshold status
    if (result.thresholdStatus.level === 'error' && !result.thresholdStatus.passed) {
      core.setFailed(`Cost threshold exceeded: ${result.thresholdStatus.message}`);
      return;
    }

    if (result.thresholdStatus.level === 'warning' && !result.thresholdStatus.passed) {
      core.warning(`Cost threshold warning: ${result.thresholdStatus.message}`);
    }

    core.info('Cost analysis completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

// Run the action
run();
