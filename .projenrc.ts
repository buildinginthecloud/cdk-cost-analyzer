import { typescript } from 'projen';
import * as projen from 'projen';
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
  repository: 'https://github.com/buildinginthecloud/cdk-cost-analyzer.git',
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
      testEnvironmentOptions: {
        // Enable experimental VM modules for AWS SDK v3 dynamic imports
        customExportConditions: ['node', 'node-addons'],
      },
      testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
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
    mergify: false, // Disable default mergify to avoid conflicts
    pullRequestLint: false,
  },

  // Release configuration
  release: true,
  releaseWorkflow: true,
  workflowNodeVersion: '20.18.1',

  // Custom build workflow steps
  buildWorkflow: true,
  mutableBuild: true, // Enable self-mutation for PR builds

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
    'CHANGELOG.md', // Generated locally, not tracked in git - see GitHub releases for changelog
  ],

  // Release configuration
  versionrcOptions: {
    types: [
      { type: 'feat', section: 'Features' },
      { type: 'fix', section: 'Bug Fixes' },
      { type: 'chore', hidden: true },
      { type: 'docs', section: 'Documentation' },
      { type: 'style', hidden: true },
      { type: 'refactor', section: 'Code Refactoring' },
      { type: 'perf', section: 'Performance Improvements' },
      { type: 'test', hidden: true },
    ],
  },

  // Disable default projen tasks we don't need
  projenrcTs: true,

  // Linting
  eslint: true,
  prettier: false,

  // Additional scripts
  scripts: {
    'test:watch': 'NODE_OPTIONS="--experimental-vm-modules" jest --watch',
    'test:silent': 'NODE_OPTIONS="--experimental-vm-modules" jest --silent',
    'test:integration': 'RUN_INTEGRATION_TESTS=true NODE_OPTIONS="--experimental-vm-modules" jest --testPathPattern="\\.integration\\.test\\.ts$"',
    'ci:local': 'npm ci --prefix examples/single-stack && npm ci --prefix examples/multi-stack && npm run lint && npm run test:silent',
    'validate:workflows': 'node tools/workflows/validate-workflows.js',
  },
});

// Add custom Mergify configuration
if (project.github) {
  new projen.github.Mergify(project.github, {
    rules: [
      {
        name: 'Automatic merge on approval and successful build',
        conditions: [
          '#approved-reviews-by>=1',
          '-label~=(do-not-merge)',
          'status-success=build',
          'status-success=test',
        ],
        actions: {
          merge: {
            method: 'squash',
          },
          delete_head_branch: {},
        },
      },
    ],
  });
}

// Override test command to use Jest with experimental VM modules for AWS SDK v3
project.testTask.reset('NODE_OPTIONS="--experimental-vm-modules" jest --passWithNoTests --updateSnapshot --silent');

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

// Add E2E smoke test workflow
if (project.github) {
  const e2eWorkflow = project.github.addWorkflow('e2e');

  e2eWorkflow.on({
    pullRequest: {},
    push: { branches: ['main'] },
    workflowDispatch: {},
  });

  e2eWorkflow.addJob('e2e', {
    runsOn: ['ubuntu-latest'],
    permissions: {},
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
        name: 'Build cdk-cost-analyzer',
        run: 'npm run build',
      },
      {
        name: 'Install single-stack dependencies',
        run: 'npm ci',
        workingDirectory: 'examples/single-stack',
      },
      {
        name: 'Synthesize single-stack',
        run: 'npm run synth',
        workingDirectory: 'examples/single-stack',
      },
      {
        name: 'Run cdk-cost-analyzer on single-stack (text output)',
        run: 'node ../../dist/cli/index.js cdk.out --output text',
        workingDirectory: 'examples/single-stack',
      },
      {
        name: 'Run cdk-cost-analyzer on single-stack (json output)',
        run: 'node ../../dist/cli/index.js cdk.out --output json > cost-report.json',
        workingDirectory: 'examples/single-stack',
      },
      {
        name: 'Validate single-stack JSON output',
        run: [
          'if [ ! -f cost-report.json ]; then',
          '  echo "Error: cost-report.json not found"',
          '  exit 1',
          'fi',
          'if [ ! -s cost-report.json ]; then',
          '  echo "Error: cost-report.json is empty"',
          '  exit 1',
          'fi',
          'echo "Single-stack JSON output validated"',
          'cat cost-report.json',
        ].join('\n'),
        workingDirectory: 'examples/single-stack',
      },
      {
        name: 'Install multi-stack dependencies',
        run: 'npm ci',
        workingDirectory: 'examples/multi-stack',
      },
      {
        name: 'Synthesize multi-stack',
        run: 'npm run synth',
        workingDirectory: 'examples/multi-stack',
      },
      {
        name: 'Run cdk-cost-analyzer on multi-stack (text output)',
        run: 'node ../../dist/cli/index.js cdk.out --output text',
        workingDirectory: 'examples/multi-stack',
      },
      {
        name: 'Run cdk-cost-analyzer on multi-stack (json output)',
        run: 'node ../../dist/cli/index.js cdk.out --output json > cost-report.json',
        workingDirectory: 'examples/multi-stack',
      },
      {
        name: 'Validate multi-stack JSON output',
        run: [
          'if [ ! -f cost-report.json ]; then',
          '  echo "Error: cost-report.json not found"',
          '  exit 1',
          'fi',
          'if [ ! -s cost-report.json ]; then',
          '  echo "Error: cost-report.json is empty"',
          '  exit 1',
          'fi',
          'echo "Multi-stack JSON output validated"',
          'cat cost-report.json',
        ].join('\n'),
        workingDirectory: 'examples/multi-stack',
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

// Note: CHANGELOG.md is generated during releases and published to GitHub Releases.
// The repository does not track CHANGELOG.md - refer to GitHub Releases for version history:
// https://github.com/buildinginthecloud/cdk-cost-analyzer/releases

project.synth();
