import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { describe, it, expect } from 'vitest';

describe('GitHub Actions Workflow - Unit Tests', () => {
  const workflowPath = path.join(
    process.cwd(),
    '.github',
    'workflows',
    'ci.yml',
  );

  // Task 8.1: Write unit test for workflow file existence
  // Requirements: 1.1
  describe('Workflow file existence', () => {
    it('should have .github/workflows/ci.yml file', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    it('should be a valid YAML file', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      expect(() => yaml.load(workflowContent)).not.toThrow();
    });

    it('should have a workflow name defined', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.name).toBeDefined();
      expect(typeof workflow.name).toBe('string');
      expect(workflow.name.length).toBeGreaterThan(0);
    });
  });

  // Task 8.2: Write unit test for trigger configuration
  // Requirements: 1.1, 2.1
  describe('Trigger configuration', () => {
    it('should have push trigger configured', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.on).toBeDefined();
      expect(workflow.on.push).toBeDefined();
    });

    it('should have pull_request trigger configured', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.on).toBeDefined();
      expect(workflow.on.pull_request).toBeDefined();
    });

    it('should trigger on main branch for push events', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.on.push.branches).toBeDefined();
      expect(Array.isArray(workflow.on.push.branches)).toBe(true);
      expect(workflow.on.push.branches).toContain('main');
    });

    it('should trigger on all branches for pull_request events', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.on.pull_request.branches).toBeDefined();
      expect(Array.isArray(workflow.on.pull_request.branches)).toBe(true);
      expect(workflow.on.pull_request.branches).toContain('**');
    });
  });

  // Task 8.3: Write unit test for required steps presence
  // Requirements: 5.2
  describe('Required steps presence', () => {
    it('should have a test job defined', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.jobs).toBeDefined();
      expect(workflow.jobs.test).toBeDefined();
    });

    it('should have checkout step', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      const checkoutStep = steps.find(
        (step: any) => step.uses?.startsWith('actions/checkout'),
      );
      expect(checkoutStep).toBeDefined();
    });

    it('should have Node.js setup step', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      const setupNodeStep = steps.find(
        (step: any) => step.uses?.startsWith('actions/setup-node'),
      );
      expect(setupNodeStep).toBeDefined();
    });

    it('should have dependency installation step', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      const installStep = steps.find(
        (step: any) =>
          step.run?.includes('npm ci') || step.run?.includes('npm install'),
      );
      expect(installStep).toBeDefined();
    });

    it('should have linting step', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      const lintStep = steps.find(
        (step: any) =>
          step.run?.includes('npm run eslint') ||
          step.run?.includes('eslint'),
      );
      expect(lintStep).toBeDefined();
    });

    it('should have type checking step', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      const typeCheckStep = steps.find(
        (step: any) =>
          step.run?.includes('npm projen lint') ||
          step.run?.includes('npx projen lint') ||
          (step.run?.includes('tsc') && step.run?.includes('--noEmit')),
      );
      expect(typeCheckStep).toBeDefined();
    });

    it('should have build step', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      const buildStep = steps.find(
        (step: any) =>
          step.run?.includes('npm run build') || step.run?.includes('build'),
      );
      expect(buildStep).toBeDefined();
    });

    it('should have test execution step', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      const testStep = steps.find(
        (step: any) =>
          step.run?.includes('npm test') ||
          step.run?.includes('npm run test') ||
          step.run?.includes('npx projen test') ||
          step.run?.includes('npx projen build') ||
          step.run?.includes('vitest'),
      );
      expect(testStep).toBeDefined();
    });

    it('should run on ubuntu-latest', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.jobs.test['runs-on']).toBe('ubuntu-latest');
    });

    it('should have all steps with names', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      const steps = workflow.jobs.test.steps;
      steps.forEach((step: any) => {
        expect(step.name).toBeDefined();
        expect(typeof step.name).toBe('string');
        expect(step.name.length).toBeGreaterThan(0);
      });
    });
  });
});
