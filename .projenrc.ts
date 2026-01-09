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

  // Publishing - disabled for now
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
    'husky@^9.0.0',
    'lint-staged@^15.0.0',
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

  // Custom build workflow steps - disabled for now
  buildWorkflow: false,

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

  // Disable default projen tasks we don't need
  projenrcTs: true,

  // Linting
  eslint: true,
  prettier: false,

  // Additional scripts
  scripts: {
    'test:watch': 'jest --watch',
    'test:silent': 'jest --silent',
    'ci:local': 'npm ci --prefix examples/single-stack && npm ci --prefix examples/multi-stack && npm run lint && npm run test:silent',
    'validate:workflows': 'node tools/workflows/validate-workflows.js',
  },
});

// Override test command to use Jest with silent flag
project.testTask.reset('jest --passWithNoTests --updateSnapshot --silent');

// Add lint task
project.addTask('lint', {
  description: 'Run TypeScript compiler checks',
  exec: 'tsc --noEmit',
});

// Ensure build task compiles TypeScript
project.compileTask.reset('tsc --build');

// Add a test-only workflow since we disabled the build workflow
if (project.github) {
  const testWorkflow = project.github.addWorkflow('test');
  
  testWorkflow.on({
    pullRequest: {},
    push: { branches: ['main'] },
    workflowDispatch: {},
  });

  testWorkflow.addJob('test', {
    runsOn: ['ubuntu-latest'],
    permissions: {},
    env: {
      CI: 'true',
    },
    steps: [
      {
        name: 'Checkout',
        uses: 'actions/checkout@v5',
      },
      {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v5',
        with: {
          'node-version': '20.18.1',
        },
      },
      {
        name: 'Install dependencies',
        run: 'npm install',
      },
      {
        name: 'Install specific npm version for consistency',
        run: 'npm install -g npm@10.8.2',
      },
      {
        name: 'Install example project dependencies, needed for testing',
        run: [
          'npm ci --prefix examples/single-stack',
          'npm ci --prefix examples/multi-stack'
        ].join('\n'),
      },
      {
        name: 'Run linting',
        run: 'npm run lint',
      },
      {
        name: 'Run tests',
        run: 'npm test',
      },
    ],
  });
}

// Add a task for installing act (optional)
project.addTask('install:act', {
  description: 'Install act for local GitHub Actions testing',
  exec: 'brew install act || echo "Please install act manually: https://github.com/nektos/act#installation"',
});

// Add husky setup task
project.addTask('prepare', {
  description: 'Setup git hooks',
  exec: 'husky install',
});

project.synth();
