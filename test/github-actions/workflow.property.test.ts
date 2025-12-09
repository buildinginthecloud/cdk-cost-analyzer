import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { describe, it, expect } from 'vitest';

describe('GitHub Actions Workflow - Property Tests', () => {
  const workflowPath = path.join(
    process.cwd(),
    '.github',
    'workflows',
    'ci.yml',
  );

  // Feature: github-actions-ci, Property 3: Node.js version matches project requirements
  // Validates: Requirements 3.1
  it('should use Node.js version compatible with package.json requirements', () => {
    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent) as any;

    // Read package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Extract Node.js version requirement from package.json
    const nodeRequirement = packageJson.engines?.node;
    expect(nodeRequirement).toBeDefined();

    // Parse the minimum required version (e.g., ">= 18.0.0" -> 18)
    const minVersionMatch = nodeRequirement.match(/>=?\s*(\d+)/);
    expect(minVersionMatch).toBeTruthy();
    const minVersion = parseInt(minVersionMatch[1], 10);

    // Extract Node.js version from workflow
    const setupNodeStep = workflow.jobs.test.steps.find(
      (step: any) => step.uses?.startsWith('actions/setup-node'),
    );
    expect(setupNodeStep).toBeDefined();

    const workflowNodeVersion = setupNodeStep.with['node-version'];
    expect(workflowNodeVersion).toBeDefined();

    // Check if using matrix strategy
    const matrixStrategy = workflow.jobs.test.strategy?.matrix;
    if (matrixStrategy && matrixStrategy['node-version']) {
      // When using matrix, verify the matrix contains valid versions
      const nodeVersions = matrixStrategy['node-version'];
      expect(Array.isArray(nodeVersions)).toBe(true);

      // Property: All matrix versions should be >= minimum required version
      for (const version of nodeVersions) {
        const versionStr = String(version);
        const versionMatch = versionStr.match(/(\d+)/);
        expect(versionMatch).toBeTruthy();
        const majorVersion = parseInt(versionMatch![1], 10);
        expect(majorVersion).toBeGreaterThanOrEqual(minVersion);
      }
    } else {
      // When not using matrix, check the direct version
      const workflowVersionMatch = workflowNodeVersion.match(/(\d+)/);
      expect(workflowVersionMatch).toBeTruthy();
      const workflowVersion = parseInt(workflowVersionMatch[1], 10);

      // Property: Workflow Node.js version should be >= minimum required version
      expect(workflowVersion).toBeGreaterThanOrEqual(minVersion);
    }
  });

  // Feature: github-actions-ci, Property 1: Dependencies install before tests
  // Validates: Requirements 1.2
  it('should install dependencies before running tests', () => {
    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent) as any;

    const steps = workflow.jobs.test.steps;
    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);

    // Find dependency installation step (npm ci or npm install)
    const npmInstallStepIndex = steps.findIndex(
      (step: any) =>
        step.run?.includes('npm ci') || step.run?.includes('npm install'),
    );
    expect(npmInstallStepIndex).toBeGreaterThanOrEqual(0);

    // Find test execution step
    const testStepIndex = steps.findIndex(
      (step: any) =>
        step.run?.includes('npm test') ||
        step.run?.includes('npm run test') ||
        step.run?.includes('vitest'),
    );

    // If test step exists, verify dependency installation comes before it
    if (testStepIndex >= 0) {
      // Property: Dependencies must be installed before tests run
      expect(npmInstallStepIndex).toBeLessThan(testStepIndex);
    }
  });

  // Feature: github-actions-ci, Property 5: Cache restores before dependency installation
  // Validates: Requirements 4.2
  it('should configure cache in setup-node step before dependency installation', () => {
    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent) as any;

    const steps = workflow.jobs.test.steps;
    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);

    // Find the setup-node step
    const setupNodeStepIndex = steps.findIndex(
      (step: any) => step.uses?.startsWith('actions/setup-node'),
    );
    expect(setupNodeStepIndex).toBeGreaterThanOrEqual(0);

    const setupNodeStep = steps[setupNodeStepIndex];

    // Verify cache is configured in setup-node
    expect(setupNodeStep.with?.cache).toBeDefined();
    expect(setupNodeStep.with.cache).toBe('npm');

    // Find dependency installation step (npm ci or npm install)
    const npmInstallStepIndex = steps.findIndex(
      (step: any) =>
        step.run?.includes('npm ci') || step.run?.includes('npm install'),
    );

    // If npm install step exists, verify setup-node (with cache) comes before it
    if (npmInstallStepIndex >= 0) {
      // Property: Cache configuration (setup-node) must appear before dependency installation
      expect(setupNodeStepIndex).toBeLessThan(npmInstallStepIndex);
    }
  });

  // Feature: github-actions-ci, Property 6: Quality checks precede tests
  // Validates: Requirements 5.1
  it('should run quality checks (linting, type checking, build) before test execution', () => {
    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent) as any;

    const steps = workflow.jobs.test.steps;
    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);

    // Find quality check steps
    const lintStepIndex = steps.findIndex(
      (step: any) =>
        step.run?.includes('npm run eslint') ||
        step.run?.includes('eslint'),
    );

    const typeCheckStepIndex = steps.findIndex(
      (step: any) =>
        step.run?.includes('npm run lint') ||
        (step.run?.includes('tsc') && step.run?.includes('--noEmit')),
    );

    const buildStepIndex = steps.findIndex(
      (step: any) =>
        step.run?.includes('npm run build') || step.run?.includes('build'),
    );

    // Find test execution step
    const testStepIndex = steps.findIndex(
      (step: any) =>
        step.run?.includes('npm test') ||
        step.run?.includes('npm run test') ||
        step.run?.includes('vitest'),
    );

    // Property: If quality checks and tests exist, quality checks must precede tests
    if (testStepIndex >= 0) {
      if (lintStepIndex >= 0) {
        expect(lintStepIndex).toBeLessThan(testStepIndex);
      }
      if (typeCheckStepIndex >= 0) {
        expect(typeCheckStepIndex).toBeLessThan(testStepIndex);
      }
      if (buildStepIndex >= 0) {
        expect(buildStepIndex).toBeLessThan(testStepIndex);
      }
    }
  });

  // Feature: github-actions-ci, Property 4: Test command matches package.json
  // Validates: Requirements 3.3
  it('should use test command that matches package.json scripts', () => {
    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent) as any;

    // Read package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const steps = workflow.jobs.test.steps;
    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);

    // Find test execution step
    const testStep = steps.find(
      (step: any) =>
        step.run?.includes('npm test') ||
        step.run?.includes('npm run test'),
    );

    // If test step exists, verify it uses a valid script from package.json
    if (testStep) {
      const testCommand = testStep.run;
      expect(testCommand).toBeDefined();

      // Extract the script name from the command
      // Handles: "npm test", "npm run test", "npm run test:silent", etc.
      const scriptMatch =
        testCommand.match(/npm run (\S+)/) || testCommand.match(/npm (test)/);
      expect(scriptMatch).toBeTruthy();

      const scriptName = scriptMatch[1];
      expect(scriptName).toBeDefined();

      // Property: The script used in workflow must exist in package.json
      expect(packageJson.scripts).toHaveProperty(scriptName);
    }
  });

  // Feature: github-actions-ci, Property 2: Test failures are not suppressed
  // Validates: Requirements 1.5
  it('should not suppress test failures with continue-on-error', () => {
    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent) as any;

    const steps = workflow.jobs.test.steps;
    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);

    // Find test execution step
    const testStep = steps.find(
      (step: any) =>
        step.run?.includes('npm test') ||
        step.run?.includes('npm run test') ||
        step.run?.includes('vitest'),
    );

    // If test step exists, verify it doesn't suppress failures
    if (testStep) {
      // Property: Test step should not have continue-on-error enabled
      // If continue-on-error is present, it must be false or undefined
      const continueOnError = testStep['continue-on-error'];
      if (continueOnError !== undefined) {
        expect(continueOnError).toBe(false);
      }

      // Also verify the command doesn't use error suppression patterns
      const testCommand = testStep.run;
      expect(testCommand).toBeDefined();

      // Property: Test command should not use error suppression operators
      expect(testCommand).not.toMatch(/\|\|\s*true/); // || true
      expect(testCommand).not.toMatch(/;\s*true/); // ; true
      expect(testCommand).not.toMatch(/\|\|\s*:/); // || :
    }
  });

  // Feature: github-actions-ci, Property 7: Matrix versions are valid
  // Validates: Requirements 6.1
  it('should use valid Node.js versions in matrix strategy', () => {
    // Read the workflow file
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent) as any;

    // Check if matrix strategy is configured
    const matrixStrategy = workflow.jobs.test.strategy?.matrix;

    // If matrix strategy exists, validate the versions
    if (matrixStrategy && matrixStrategy['node-version']) {
      const nodeVersions = matrixStrategy['node-version'];
      expect(Array.isArray(nodeVersions)).toBe(true);
      expect(nodeVersions.length).toBeGreaterThan(0);

      // Define valid Node.js version patterns
      // Valid formats: "18.x", "20.x", "22.x", "18", "20", "22", etc.
      const validVersionPattern = /^(\d+)(\.x)?$/;

      // Known valid major versions (LTS and current)
      const validMajorVersions = [16, 18, 20, 22, 23];

      // Property: All matrix versions must be valid Node.js version strings
      for (const version of nodeVersions) {
        const versionStr = String(version);
        expect(versionStr).toMatch(validVersionPattern);

        // Extract major version number
        const match = versionStr.match(/^(\d+)/);
        expect(match).toBeTruthy();
        const majorVersion = parseInt(match![1], 10);

        // Property: Major version should be a known valid Node.js version
        expect(validMajorVersions).toContain(majorVersion);
      }

      // Verify that setup-node step uses matrix.node-version
      const setupNodeStep = workflow.jobs.test.steps.find(
        (step: any) => step.uses?.startsWith('actions/setup-node'),
      );
      expect(setupNodeStep).toBeDefined();

      const nodeVersionConfig = setupNodeStep.with['node-version'];
      expect(nodeVersionConfig).toBeDefined();

      // Property: When matrix is used, setup-node must reference matrix.node-version
      expect(nodeVersionConfig).toMatch(/\$\{\{\s*matrix\.node-version\s*\}\}/);
    }
  });
});
