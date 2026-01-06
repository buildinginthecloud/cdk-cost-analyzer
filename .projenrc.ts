import { typescript } from 'projen';
import { NodePackageManager, NpmAccess } from 'projen/lib/javascript';

const project = new typescript.TypeScriptProject({
  name: 'cdk-cost-analyzer',
  description: 'Analyze AWS CDK infrastructure changes and provide cost impact summaries',
  defaultReleaseBranch: 'main',
  packageManager: NodePackageManager.NPM,

  // Package metadata
  packageName: 'cdk-cost-analyzer',
  authorName: 'Yvo van Zee',
  authorEmail: 'yvo@buildinginthecloud.com',
  license: 'MIT',

  // Repository
  repository: 'https://gitlab.com/buildinginthecloud/cdk-cost-analyzer.git',
  homepage: 'https://github.com/buildinginthecloud/cdk-cost-analyzer',
  bugsUrl: 'https://github.com/buildinginthecloud/cdk-cost-analyzer/issues',

  // Publishing
  releaseToNpm: true,
  npmAccess: NpmAccess.PUBLIC,

  // CLI binary
  bin: {
    'cdk-cost-analyzer': 'dist/cli/index.js',
  },

  // Entry points
  entrypoint: 'dist/api/index.js',

  // Dependencies
  deps: [
    '@aws-sdk/client-pricing@^3.705.0',
    'commander@^12.1.0',
    'js-yaml@^4.1.0',
  ],

  devDeps: [
    '@types/js-yaml@^4.0.9',
    '@types/node@^22.10.1',
    'fast-check@^3.23.1',
    'vitest@^2.1.6',
  ],

  // Build configuration
  tsconfig: {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
    },
  },

  // TypeScript compiler options
  tsconfigDev: {
    compilerOptions: {
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
    },
  },

  // Disable default Jest since we use Vitest
  jest: false,

  // Keywords
  keywords: [
    'aws',
    'cdk',
    'cost',
    'analysis',
    'cloudformation',
  ],

  // Node version
  minNodeVersion: '18.0.0',

  // GitHub configuration
  github: true,
  githubOptions: {
    mergify: false,
    pullRequestLint: false,
  },

  // Release configuration
  release: true,
  releaseWorkflow: true,
  workflowNodeVersion: '18.x',
  
  // Custom build workflow steps
  buildWorkflow: true,
  buildWorkflowOptions: {
    preBuildSteps: [
      {
        name: 'Install example project dependencies, needed for testing',
        run: [
          'npm ci --prefix examples/single-stack',
          'npm ci --prefix examples/multi-stack'
        ].join('\n'),
      },
    ],
  },

  // Gitignore
  gitignore: [
    'node_modules/',
    'dist/',
    '*.log',
    '.DS_Store',
    'coverage/',
    '.env',
    '*.tgz',
    '.cdk-cost-analyzer-cache/',
    '.test-cache/',
  ],

  // Disable default projen tasks we don't need
  projenrcTs: true,

  // Linting
  eslint: true,
  prettier: false,

  // Additional scripts
  scripts: {
    'test:watch': 'vitest',
    'test:silent': 'vitest run --silent',
  },
});

// Override test command to use Vitest instead of Jest
project.testTask.reset('vitest run --silent');

// Add lint task
project.addTask('lint', {
  description: 'Run TypeScript compiler checks',
  exec: 'tsc --noEmit',
});

// Ensure build task compiles TypeScript
project.compileTask.reset('tsc');

project.synth();
