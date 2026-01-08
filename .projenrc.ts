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

  // Repository - use consistent GitHub URLs
  repository: 'https://github.com/buildinginthecloud/cdk-cost-analyzer.git',
  homepage: 'https://github.com/buildinginthecloud/cdk-cost-analyzer',
  bugsUrl: 'https://github.com/buildinginthecloud/cdk-cost-analyzer/issues',

  // Publishing configuration
  releaseToNpm: false,
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

  // Testing configuration
  jest: true,
  jestOptions: {
    jestConfig: {
      testTimeout: 30000, // 30 second default timeout
      forceExit: true, // Force exit to prevent hanging
      detectOpenHandles: true, // Detect open handles that prevent Jest from exiting
    },
  },
  sampleCode: false,

  // Keywords
  keywords: [
    'aws',
    'cdk',
    'cost',
    'analysis',
    'cloudformation',
  ],

  // Node version
  minNodeVersion: '20.0.0',

  // GitHub configuration
  github: true,
  githubOptions: {
    mergify: false,
    pullRequestLint: false,
  },

  // Release configuration
  release: false,
  releaseWorkflow: false,
  workflowNodeVersion: '20.18.1',

  // Build workflow
  buildWorkflow: true,

  // Dependency upgrades
  depsUpgrade: true,

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
    'cdk.out/',
    'examples/*/cdk.out/',
    'examples/*/custom.out/',
    'examples/*/*.out/',
    'test-cdk-project/',
  ],

  // Projen configuration
  projenrcTs: true,

  // Linting
  eslint: true,
  prettier: false,
});

project.synth();
