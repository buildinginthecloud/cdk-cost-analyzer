#!/usr/bin/env node
"use strict";
/**
 * GitHub Action entry point for cdk-cost-analyzer.
 *
 * This module parses GitHub Action inputs, runs cost analysis,
 * and posts formatted comments to pull requests.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PipelineOrchestrator_1 = require("../pipeline/PipelineOrchestrator");
const GitHubIntegration_1 = require("../integrations/GitHubIntegration");
const GitHubActionReporter_1 = require("../reporter/GitHubActionReporter");
const Logger_1 = require("../utils/Logger");
/**
 * Detect CDK app directory by looking for cdk.json.
 */
function detectCdkApp(startPath) {
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
function getPRNumber() {
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
function parseRepository() {
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
function validatePath(inputPath) {
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
function validateCommentStrategy(value) {
    const validStrategies = ['new', 'update', 'delete-and-new'];
    if (!validStrategies.includes(value)) {
        throw new Error(`Invalid comment-strategy: '${value}'. Must be one of: ${validStrategies.join(', ')}`);
    }
    return value;
}
/**
 * Main action entry point.
 */
async function run() {
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
            Logger_1.Logger.setDebugEnabled(true);
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
        }
        else {
            core.info(`Detected CDK app at: ${cdkAppPath}`);
        }
        // Check if synthesis is needed
        const cdkOutDir = path.join(cdkAppPath, 'cdk.out');
        const needsSynthesis = !fs.existsSync(cdkOutDir);
        if (needsSynthesis) {
            core.info('CDK output not found. Synthesis will be performed.');
        }
        // Run cost analysis
        const orchestrator = new PipelineOrchestrator_1.PipelineOrchestrator();
        core.info(`Running cost analysis for region: ${awsRegion}`);
        const result = await orchestrator.runPipelineAnalysis({
            synthesize: needsSynthesis,
            cdkAppPath: cdkAppPath,
            region: awsRegion,
            configPath: configPath,
        });
        // Calculate base and target costs
        const baseCost = result.costAnalysis.removedResources.reduce((sum, r) => sum + r.monthlyCost.amount, 0) + result.costAnalysis.modifiedResources.reduce((sum, r) => sum + r.oldMonthlyCost.amount, 0);
        const targetCost = result.costAnalysis.addedResources.reduce((sum, r) => sum + r.monthlyCost.amount, 0) + result.costAnalysis.modifiedResources.reduce((sum, r) => sum + r.newMonthlyCost.amount, 0);
        // Generate GitHub-formatted report
        const reporter = new GitHubActionReporter_1.GitHubActionReporter();
        const costDelta = {
            totalDelta: result.costAnalysis.totalDelta,
            currency: result.costAnalysis.currency,
            addedCosts: result.costAnalysis.addedResources,
            removedCosts: result.costAnalysis.removedResources,
            modifiedCosts: result.costAnalysis.modifiedResources,
        };
        const report = reporter.generateReport(costDelta, baseCost, targetCost);
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
            const integration = new GitHubIntegration_1.GitHubIntegration({
                token: githubToken,
                apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
            });
            await integration.postPRComment(repoInfo.owner, repoInfo.repo, prNumber, report, commentStrategy);
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
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed(String(error));
        }
    }
}
// Run the action
run();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWN0aW9uL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsb0RBQXNDO0FBQ3RDLHdEQUEwQztBQUMxQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLDJFQUF3RTtBQUN4RSx5RUFBc0U7QUFFdEUsMkVBQXdFO0FBQ3hFLDRDQUF5QztBQUV6Qzs7R0FFRztBQUNILFNBQVMsWUFBWSxDQUFDLFNBQWlCO0lBQ3JDLGdEQUFnRDtJQUNoRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNyRCxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztRQUMvQixPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBRUQsOEJBQThCO0lBQzlCLE1BQU0sVUFBVSxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNoRSxLQUFLLE1BQU0sR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQzdCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2xELElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQzlCLE9BQU8sT0FBTyxDQUFDO1FBQ2pCLENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQVMsV0FBVztJQUNsQixNQUFNLE9BQU8sR0FBRyxNQUFNLENB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Q0FBQyxDQUFDO1FBQ2hDLENBQUM7YUFBTSxDQUFDO1lBQ04sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNoQyxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFFRCxpQkFBaUI7QUFDakIsR0FBRyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIEdpdEh1YiBBY3Rpb24gZW50cnkgcG9pbnQgZm9yIGNkay1jb3N0LWFuYWx5emVyLlxuICpcbiAqIFRoaXMgbW9kdWxlIHBhcnNlcyBHaXRIdWIgQWN0aW9uIGlucHV0cywgcnVucyBjb3N0IGFuYWx5c2lzLFxuICogYW5kIHBvc3RzIGZvcm1hdHRlZCBjb21tZW50cyB0byBwdWxsIHJlcXVlc3RzLlxuICovXG5cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnQGFjdGlvbnMvY29yZSc7XG5pbXBvcnQgKiBhcyBnaXRodWIgZnJvbSAnQGFjdGlvbnMvZ2l0aHViJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBQaXBlbGluZU9yY2hlc3RyYXRvciB9IGZyb20gJy4uL3BpcGVsaW5lL1BpcGVsaW5lT3JjaGVzdHJhdG9yJztcbmltcG9ydCB7IEdpdEh1YkludGVncmF0aW9uIH0gZnJvbSAnLi4vaW50ZWdyYXRpb25zL0dpdEh1YkludGVncmF0aW9uJztcbmltcG9ydCB7IENvbW1lbnRTdHJhdGVneSB9IGZyb20gJy4uL2ludGVncmF0aW9ucy90eXBlcyc7XG5pbXBvcnQgeyBHaXRIdWJBY3Rpb25SZXBvcnRlciB9IGZyb20gJy4uL3JlcG9ydGVyL0dpdEh1YkFjdGlvblJlcG9ydGVyJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL0xvZ2dlcic7XG5cbi8qKlxuICogRGV0ZWN0IENESyBhcHAgZGlyZWN0b3J5IGJ5IGxvb2tpbmcgZm9yIGNkay5qc29uLlxuICovXG5mdW5jdGlvbiBkZXRlY3RDZGtBcHAoc3RhcnRQYXRoOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBDaGVjayBpZiBjZGsuanNvbiBleGlzdHMgaW4gdGhlIHByb3ZpZGVkIHBhdGhcbiAgY29uc3QgY2RrSnNvblBhdGggPSBwYXRoLmpvaW4oc3RhcnRQYXRoLCAnY2RrLmpzb24nKTtcbiAgaWYgKGZzLmV4aXN0c1N5bmMoY2RrSnNvblBhdGgpKSB7XG4gICAgcmV0dXJuIHN0YXJ0UGF0aDtcbiAgfVxuXG4gIC8vIENoZWNrIGNvbW1vbiBzdWJkaXJlY3Rvcmllc1xuICBjb25zdCBjb21tb25EaXJzID0gWydpbmZyYXN0cnVjdHVyZScsICdjZGsnLCAnaW5mcmEnLCAnZGVwbG95J107XG4gIGZvciAoY29uc3QgZGlyIG9mIGNvbW1vbkRpcnMpIHtcbiAgICBjb25zdCBzdWJQYXRoID0gcGF0aC5qb2luKHN0YXJ0UGF0aCwgZGlyKTtcbiAgICBjb25zdCBzdWJDZGtKc29uID0gcGF0aC5qb2luKHN1YlBhdGgsICdjZGsuanNvbicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHN1YkNka0pzb24pKSB7XG4gICAgICByZXR1cm4gc3ViUGF0aDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIFBhcnNlIFBSIG51bWJlciBmcm9tIEdpdEh1YiBjb250ZXh0LlxuICogT25seSByZXR1cm5zIG51bWJlciBmb3IgcHVsbF9yZXF1ZXN0IGV2ZW50cy5cbiAqL1xuZnVuY3Rpb24gZ2V0UFJOdW1iZXIoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgY29udGV4dCA9IGdpdGh1Yi5jb250ZXh0O1xuXG4gIC8vIE9ubHkgYWNjZXB0IHB1bGxfcmVxdWVzdCBldmVudHNcbiAgaWYgKGNvbnRleHQuZXZlbnROYW1lID09PSAncHVsbF9yZXF1ZXN0JyAmJiBjb250ZXh0LnBheWxvYWQucHVsbF9yZXF1ZXN0KSB7XG4gICAgcmV0dXJuIGNvbnRleHQucGF5bG9hZC5wdWxsX3JlcXVlc3QubnVtYmVyO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBQYXJzZSByZXBvc2l0b3J5IG93bmVyIGFuZCBuYW1lIGZyb20gR2l0SHViIGNvbnRleHQuXG4gKi9cbmZ1bmN0aW9uIHBhcnNlUmVwb3NpdG9yeSgpOiB7IG93bmVyOiBzdHJpbmc7IHJlcG86IHN0cmluZyB9IHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgY29udGV4dCA9IGdpdGh1Yi5jb250ZXh0O1xuXG4gIGlmIChjb250ZXh0LnJlcG8ub3duZXIgJiYgY29udGV4dC5yZXBvLnJlcG8pIHtcbiAgICByZXR1cm4ge1xuICAgICAgb3duZXI6IGNvbnRleHQucmVwby5vd25lcixcbiAgICAgIHJlcG86IGNvbnRleHQucmVwby5yZXBvLFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBpbnB1dCBwYXRoIHRvIHByZXZlbnQgcGF0aCB0cmF2ZXJzYWwuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aChpbnB1dFBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHdvcmtzcGFjZSA9IHByb2Nlc3MuZW52LkdJVEhVQl9XT1JLU1BBQ0UgfHwgcHJvY2Vzcy5jd2QoKTtcbiAgY29uc3QgcmVzb2x2ZWQgPSBwYXRoLnJlc29sdmUod29ya3NwYWNlLCBpbnB1dFBhdGgpO1xuXG4gIC8vIEVuc3VyZSBwYXRoIGlzIHdpdGhpbiB3b3Jrc3BhY2VcbiAgaWYgKCFyZXNvbHZlZC5zdGFydHNXaXRoKHdvcmtzcGFjZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFBhdGggJyR7aW5wdXRQYXRofScgaXMgb3V0c2lkZSB3b3Jrc3BhY2UuIFBvdGVudGlhbCBwYXRoIHRyYXZlcnNhbCBhdHRhY2suYCk7XG4gIH1cblxuICByZXR1cm4gcmVzb2x2ZWQ7XG59XG5cbi8qKlxuICogVmFsaWRhdGUgY29tbWVudCBzdHJhdGVneSBpbnB1dC5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVDb21tZW50U3RyYXRlZ3kodmFsdWU6IHN0cmluZyk6IENvbW1lbnRTdHJhdGVneSB7XG4gIGNvbnN0IHZhbGlkU3RyYXRlZ2llczogQ29tbWVudFN0cmF0ZWd5W10gPSBbJ25ldycsICd1cGRhdGUnLCAnZGVsZXRlLWFuZC1uZXcnXTtcbiAgaWYgKCF2YWxpZFN0cmF0ZWdpZXMuaW5jbHVkZXModmFsdWUgYXMgQ29tbWVudFN0cmF0ZWd5KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbnZhbGlkIGNvbW1lbnQtc3RyYXRlZ3k6ICcke3ZhbHVlfScuIE11c3QgYmUgb25lIG9mOiAke3ZhbGlkU3RyYXRlZ2llcy5qb2luKCcsICcpfWBcbiAgICApO1xuICB9XG4gIHJldHVybiB2YWx1ZSBhcyBDb21tZW50U3RyYXRlZ3k7XG59XG5cbi8qKlxuICogTWFpbiBhY3Rpb24gZW50cnkgcG9pbnQuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICAvLyBQYXJzZSBhbmQgdmFsaWRhdGUgaW5wdXRzXG4gICAgY29uc3QgcmF3SW5wdXRQYXRoID0gY29yZS5nZXRJbnB1dCgncGF0aCcpIHx8ICcuLyc7XG4gICAgY29uc3QgaW5wdXRQYXRoID0gdmFsaWRhdGVQYXRoKHJhd0lucHV0UGF0aCk7XG4gICAgY29uc3QgZ2l0aHViVG9rZW4gPSBjb3JlLmdldElucHV0KCdnaXRodWItdG9rZW4nLCB7IHJlcXVpcmVkOiB0cnVlIH0pO1xuICAgIGNvbnN0IGF3c1JlZ2lvbiA9IGNvcmUuZ2V0SW5wdXQoJ2F3cy1yZWdpb24nKSB8fCAndXMtZWFzdC0xJztcbiAgICBjb25zdCBjb25maWdQYXRoID0gY29yZS5nZXRJbnB1dCgnY29uZmlnLXBhdGgnKTtcbiAgICBjb25zdCByYXdDb21tZW50U3RyYXRlZ3kgPSBjb3JlLmdldElucHV0KCdjb21tZW50LXN0cmF0ZWd5JykgfHwgJ3VwZGF0ZSc7XG4gICAgY29uc3QgY29tbWVudFN0cmF0ZWd5ID0gdmFsaWRhdGVDb21tZW50U3RyYXRlZ3kocmF3Q29tbWVudFN0cmF0ZWd5KTtcbiAgICBjb25zdCBkZWJ1Z01vZGUgPSBjb3JlLmdldEJvb2xlYW5JbnB1dCgnZGVidWcnKTtcblxuICAgIC8vIEVuYWJsZSBkZWJ1ZyBsb2dnaW5nIGlmIHJlcXVlc3RlZFxuICAgIGlmIChkZWJ1Z01vZGUpIHtcbiAgICAgIExvZ2dlci5zZXREZWJ1Z0VuYWJsZWQodHJ1ZSk7XG4gICAgICBjb3JlLmRlYnVnKCdEZWJ1ZyBsb2dnaW5nIGVuYWJsZWQnKTtcbiAgICB9XG5cbiAgICBjb3JlLmluZm8oJ1N0YXJ0aW5nIENESyBDb3N0IEFuYWx5c2lzLi4uJyk7XG5cbiAgICAvLyBWYWxpZGF0ZSBHaXRIdWIgY29udGV4dFxuICAgIGNvbnN0IHJlcG9JbmZvID0gcGFyc2VSZXBvc2l0b3J5KCk7XG4gICAgaWYgKCFyZXBvSW5mbykge1xuICAgICAgY29yZS5zZXRGYWlsZWQoJ0NvdWxkIG5vdCBkZXRlcm1pbmUgcmVwb3NpdG9yeSBmcm9tIEdpdEh1YiBjb250ZXh0Jyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcHJOdW1iZXIgPSBnZXRQUk51bWJlcigpO1xuICAgIGlmICghcHJOdW1iZXIpIHtcbiAgICAgIGNvcmUud2FybmluZygnTm90IHJ1bm5pbmcgaW4gYSBwdWxsX3JlcXVlc3QgZXZlbnQuIFNraXBwaW5nIFBSIGNvbW1lbnQuJyk7XG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0IG9yIHVzZSBwcm92aWRlZCBDREsgYXBwIHBhdGhcbiAgICBsZXQgY2RrQXBwUGF0aCA9IGRldGVjdENka0FwcChpbnB1dFBhdGgpO1xuXG4gICAgaWYgKCFjZGtBcHBQYXRoKSB7XG4gICAgICBjb3JlLndhcm5pbmcoYENvdWxkIG5vdCBkZXRlY3QgQ0RLIGFwcCBpbiAke2lucHV0UGF0aH0uIFVzaW5nIHByb3ZpZGVkIHBhdGguYCk7XG4gICAgICBjZGtBcHBQYXRoID0gaW5wdXRQYXRoO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3JlLmluZm8oYERldGVjdGVkIENESyBhcHAgYXQ6ICR7Y2RrQXBwUGF0aH1gKTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBzeW50aGVzaXMgaXMgbmVlZGVkXG4gICAgY29uc3QgY2RrT3V0RGlyID0gcGF0aC5qb2luKGNka0FwcFBhdGgsICdjZGsub3V0Jyk7XG4gICAgY29uc3QgbmVlZHNTeW50aGVzaXMgPSAhZnMuZXhpc3RzU3luYyhjZGtPdXREaXIpO1xuXG4gICAgaWYgKG5lZWRzU3ludGhlc2lzKSB7XG4gICAgICBjb3JlLmluZm8oJ0NESyBvdXRwdXQgbm90IGZvdW5kLiBTeW50aGVzaXMgd2lsbCBiZSBwZXJmb3JtZWQuJyk7XG4gICAgfVxuXG4gICAgLy8gUnVuIGNvc3QgYW5hbHlzaXNcbiAgICBjb25zdCBvcmNoZXN0cmF0b3IgPSBuZXcgUGlwZWxpbmVPcmNoZXN0cmF0b3IoKTtcblxuICAgIGNvcmUuaW5mbyhgUnVubmluZyBjb3N0IGFuYWx5c2lzIGZvciByZWdpb246ICR7YXdzUmVnaW9ufWApO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgb3JjaGVzdHJhdG9yLnJ1blBpcGVsaW5lQW5hbHlzaXMoe1xuICAgICAgc3ludGhlc2l6ZTogbmVlZHNTeW50aGVzaXMsXG4gICAgICBjZGtBcHBQYXRoOiBjZGtBcHBQYXRoLFxuICAgICAgcmVnaW9uOiBhd3NSZWdpb24sXG4gICAgICBjb25maWdQYXRoOiBjb25maWdQYXRoLFxuICAgIH0pO1xuXG4gICAgLy8gQ2FsY3VsYXRlIGJhc2UgYW5kIHRhcmdldCBjb3N0c1xuICAgIGNvbnN0IGJhc2VDb3N0ID0gcmVzdWx0LmNvc3RBbmFseXNpcy5yZW1vdmVkUmVzb3VyY2VzLnJlZHVjZShcbiAgICAgIChzdW0sIHIpID0+IHN1bSArIHIubW9udGhseUNvc3QuYW1vdW50LFxuICAgICAgMFxuICAgICkgKyByZXN1bHQuY29zdEFuYWx5c2lzLm1vZGlmaWVkUmVzb3VyY2VzLnJlZHVjZShcbiAgICAgIChzdW0sIHIpID0+IHN1bSArIHIub2xkTW9udGhseUNvc3QuYW1vdW50LFxuICAgICAgMFxuICAgICk7XG5cbiAgICBjb25zdCB0YXJnZXRDb3N0ID0gcmVzdWx0LmNvc3RBbmFseXNpcy5hZGRlZFJlc291cmNlcy5yZWR1Y2UoXG4gICAgICAoc3VtLCByKSA9PiBzdW0gKyByLm1vbnRobHlDb3N0LmFtb3VudCxcbiAgICAgIDBcbiAgICApICsgcmVzdWx0LmNvc3RBbmFseXNpcy5tb2RpZmllZFJlc291cmNlcy5yZWR1Y2UoXG4gICAgICAoc3VtLCByKSA9PiBzdW0gKyByLm5ld01vbnRobHlDb3N0LmFtb3VudCxcbiAgICAgIDBcbiAgICApO1xuXG4gICAgLy8gR2VuZXJhdGUgR2l0SHViLWZvcm1hdHRlZCByZXBvcnRcbiAgICBjb25zdCByZXBvcnRlciA9IG5ldyBHaXRIdWJBY3Rpb25SZXBvcnRlcigpO1xuICAgIGNvbnN0IGNvc3REZWx0YSA9IHtcbiAgICAgIHRvdGFsRGVsdGE6IHJlc3VsdC5jb3N0QW5hbHlzaXMudG90YWxEZWx0YSxcbiAgICAgIGN1cnJlbmN5OiByZXN1bHQuY29zdEFuYWx5c2lzLmN1cnJlbmN5LFxuICAgICAgYWRkZWRDb3N0czogcmVzdWx0LmNvc3RBbmFseXNpcy5hZGRlZFJlc291cmNlcyxcbiAgICAgIHJlbW92ZWRDb3N0czogcmVzdWx0LmNvc3RBbmFseXNpcy5yZW1vdmVkUmVzb3VyY2VzLFxuICAgICAgbW9kaWZpZWRDb3N0czogcmVzdWx0LmNvc3RBbmFseXNpcy5tb2RpZmllZFJlc291cmNlcyxcbiAgICB9O1xuICAgIGNvbnN0IHJlcG9ydCA9IHJlcG9ydGVyLmdlbmVyYXRlUmVwb3J0KFxuICAgICAgY29zdERlbHRhLFxuICAgICAgYmFzZUNvc3QsXG4gICAgICB0YXJnZXRDb3N0LFxuICAgICk7XG5cbiAgICAvLyBPdXRwdXQgdG8gY29uc29sZVxuICAgIGNvbnNvbGUubG9nKCdcXG4nICsgcmVwb3J0ICsgJ1xcbicpO1xuXG4gICAgLy8gU2V0IG91dHB1dHNcbiAgICBjb3JlLnNldE91dHB1dCgndG90YWwtZGVsdGEnLCByZXN1bHQuY29zdEFuYWx5c2lzLnRvdGFsRGVsdGEudG9TdHJpbmcoKSk7XG4gICAgY29yZS5zZXRPdXRwdXQoJ2N1cnJlbmN5JywgcmVzdWx0LmNvc3RBbmFseXNpcy5jdXJyZW5jeSk7XG4gICAgY29yZS5zZXRPdXRwdXQoJ2FkZGVkLWNvdW50JywgcmVzdWx0LmNvc3RBbmFseXNpcy5hZGRlZFJlc291cmNlcy5sZW5ndGgudG9TdHJpbmcoKSk7XG4gICAgY29yZS5zZXRPdXRwdXQoJ3JlbW92ZWQtY291bnQnLCByZXN1bHQuY29zdEFuYWx5c2lzLnJlbW92ZWRSZXNvdXJjZXMubGVuZ3RoLnRvU3RyaW5nKCkpO1xuICAgIGNvcmUuc2V0T3V0cHV0KCdtb2RpZmllZC1jb3VudCcsIHJlc3VsdC5jb3N0QW5hbHlzaXMubW9kaWZpZWRSZXNvdXJjZXMubGVuZ3RoLnRvU3RyaW5nKCkpO1xuICAgIGNvcmUuc2V0T3V0cHV0KCd0aHJlc2hvbGQtcGFzc2VkJywgcmVzdWx0LnRocmVzaG9sZFN0YXR1cy5wYXNzZWQudG9TdHJpbmcoKSk7XG4gICAgY29yZS5zZXRPdXRwdXQoJ3RocmVzaG9sZC1sZXZlbCcsIHJlc3VsdC50aHJlc2hvbGRTdGF0dXMubGV2ZWwpO1xuXG4gICAgLy8gUG9zdCBjb21tZW50IHRvIFBSIGlmIGluIFBSIGNvbnRleHRcbiAgICBpZiAocHJOdW1iZXIpIHtcbiAgICAgIGNvcmUuaW5mbyhgUG9zdGluZyBjb3N0IGFuYWx5c2lzIHRvIFBSICMke3ByTnVtYmVyfS4uLmApO1xuXG4gICAgICBjb25zdCBpbnRlZ3JhdGlvbiA9IG5ldyBHaXRIdWJJbnRlZ3JhdGlvbih7XG4gICAgICAgIHRva2VuOiBnaXRodWJUb2tlbixcbiAgICAgICAgYXBpVXJsOiBwcm9jZXNzLmVudi5HSVRIVUJfQVBJX1VSTCB8fCAnaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbScsXG4gICAgICB9KTtcblxuICAgICAgYXdhaXQgaW50ZWdyYXRpb24ucG9zdFBSQ29tbWVudChcbiAgICAgICAgcmVwb0luZm8ub3duZXIsXG4gICAgICAgIHJlcG9JbmZvLnJlcG8sXG4gICAgICAgIHByTnVtYmVyLFxuICAgICAgICByZXBvcnQsXG4gICAgICAgIGNvbW1lbnRTdHJhdGVneSxcbiAgICAgICk7XG5cbiAgICAgIGNvcmUuaW5mbygnQ29zdCBhbmFseXNpcyBwb3N0ZWQgdG8gcHVsbCByZXF1ZXN0Jyk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdGhyZXNob2xkIHN0YXR1c1xuICAgIGlmIChyZXN1bHQudGhyZXNob2xkU3RhdHVzLmxldmVsID09PSAnZXJyb3InICYmICFyZXN1bHQudGhyZXNob2xkU3RhdHVzLnBhc3NlZCkge1xuICAgICAgY29yZS5zZXRGYWlsZWQoYENvc3QgdGhyZXNob2xkIGV4Y2VlZGVkOiAke3Jlc3VsdC50aHJlc2hvbGRTdGF0dXMubWVzc2FnZX1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0LnRocmVzaG9sZFN0YXR1cy5sZXZlbCA9PT0gJ3dhcm5pbmcnICYmICFyZXN1bHQudGhyZXNob2xkU3RhdHVzLnBhc3NlZCkge1xuICAgICAgY29yZS53YXJuaW5nKGBDb3N0IHRocmVzaG9sZCB3YXJuaW5nOiAke3Jlc3VsdC50aHJlc2hvbGRTdGF0dXMubWVzc2FnZX1gKTtcbiAgICB9XG5cbiAgICBjb3JlLmluZm8oJ0Nvc3QgYW5hbHlzaXMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBjb3JlLnNldEZhaWxlZChlcnJvci5tZXNzYWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29yZS5zZXRGYWlsZWQoU3RyaW5nKGVycm9yKSk7XG4gICAgfVxuICB9XG59XG5cbi8vIFJ1biB0aGUgYWN0aW9uXG5ydW4oKTtcbiJdfQ==