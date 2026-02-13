import * as fs from 'fs';
import * as path from 'path';
// Jest imports are global

describe('Repository Structure - Property Tests', () => {
  const projectRoot = path.resolve(__dirname, '..');

  /**
   * Property 1: No temporary or backup file suffixes
   * Validates: Requirements 1.4, 5.3
   *
   * Ensures no files with temporary suffixes exist in the repository.
   * This maintains a clean repository structure by preventing temporary
   * files from being committed to version control.
   */
  it('should not contain files with temporary or backup suffixes', () => {
    const temporarySuffixes = ['.bak', '.tmp', '.old', '.backup', '_backup', '_old', '_tmp', '~'];
    const problematicFiles: string[] = [];

    const scanDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectRoot, fullPath);

        // Skip node_modules, .git, and dist directories
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
            scanDirectory(fullPath);
          }
          continue;
        }

        // Check if file has a temporary suffix
        for (const suffix of temporarySuffixes) {
          if (entry.name.endsWith(suffix)) {
            problematicFiles.push(relativePath);
            break;
          }
        }
      }
    };

    scanDirectory(projectRoot);

    expect(problematicFiles).toEqual([]);
  });

  /**
   * Property 2: All documentation links are valid
   * Validates: Requirements 2.3, 3.4
   *
   * Verifies that all markdown file references in documentation are valid.
   * This ensures documentation remains consistent after file reorganization.
   */
  it('should have valid documentation links in markdown files', () => {
    const markdownFiles: string[] = [];
    const brokenLinks: Array<{ file: string; link: string; reason: string }> = [];

    const findMarkdownFiles = (dir: string) => {
      // Skip if directory doesn't exist (e.g., temporary test directories)
      if (!fs.existsSync(dir)) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
            findMarkdownFiles(fullPath);
          }
          continue;
        }

        if (entry.name.endsWith('.md')) {
          markdownFiles.push(fullPath);
        }
      }
    };

    findMarkdownFiles(projectRoot);

    // Regex patterns for different link types
    const relativeLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    for (const markdownFile of markdownFiles) {
      const content = fs.readFileSync(markdownFile, 'utf-8');
      const relativePath = path.relative(projectRoot, markdownFile);
      const fileDir = path.dirname(markdownFile);

      let match;
      while ((match = relativeLinkRegex.exec(content)) !== null) {
        const linkPath = match[2];

        // Skip external URLs
        if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
          continue;
        }

        // Skip anchors and mailto links
        if (linkPath.startsWith('#') || linkPath.startsWith('mailto:')) {
          continue;
        }

        // Remove anchor from path if present
        const pathWithoutAnchor = linkPath.split('#')[0];
        if (!pathWithoutAnchor) continue; // Pure anchor link

        // Resolve relative path
        const targetPath = path.resolve(fileDir, pathWithoutAnchor);

        // Check if file exists
        if (!fs.existsSync(targetPath)) {
          brokenLinks.push({
            file: relativePath,
            link: linkPath,
            reason: `Target does not exist: ${path.relative(projectRoot, targetPath)}`,
          });
        }
      }
    }

    if (brokenLinks.length > 0) {
      const errorMessage = brokenLinks
        .map(({ file, link, reason }) => `  ${file}: [${link}] - ${reason}`)
        .join('\n');
      throw new Error(`Found broken links:\n${errorMessage}`);
    }

    expect(brokenLinks).toEqual([]);
  });

  /**
   * Property 3: Functional files are preserved
   * Validates: Requirements 3.3, 4.5
   *
   * Ensures all critical functional files remain in the repository after cleanup.
   * This prevents accidental deletion of important source code, tests, or configuration.
   */
  it('should preserve all functional files (src, test, config)', () => {
    const requiredDirectories = ['src', 'test'];
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
    ];

    const missingItems: string[] = [];

    // Check required directories
    for (const dir of requiredDirectories) {
      const dirPath = path.join(projectRoot, dir);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        missingItems.push(`Directory: ${dir}`);
      }
    }

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(projectRoot, file);
      if (!fs.existsSync(filePath)) {
        missingItems.push(`File: ${file}`);
      }
    }

    expect(missingItems).toEqual([]);
  });

  /**
   * Property 4: Documentation files are in docs directory
   * Validates: Requirements 2.1, 2.2
   *
   * Verifies that supplementary documentation has been moved to the docs/ folder.
   */
  it('should have documentation files in docs directory', () => {
    const expectedDocs = [
      'docs/DEVELOPMENT.md',
      'docs/CI_CD.md',
      'docs/CONFIGURATION.md',
      'docs/CALCULATORS.md',
      'docs/TROUBLESHOOTING.md',
      'docs/RELEASE.md',
    ];

    const missingDocs: string[] = [];

    for (const doc of expectedDocs) {
      const docPath = path.join(projectRoot, doc);
      if (!fs.existsSync(docPath)) {
        missingDocs.push(doc);
      }
    }

    expect(missingDocs).toEqual([]);
  });

  /**
   * Property 5: Example files are organized in examples directory
   * Validates: Requirements 3.1, 3.2, 3.5
   *
   * Verifies that example templates and usage scripts are in the examples/ folder.
   */
  it('should have example files organized in examples directory', () => {
    const expectedExamples = [
      'examples/simple/base.json',
      'examples/simple/target.json',
      'examples/complex/base.json',
      'examples/complex/target.json',
      'examples/api-usage.js',
    ];

    const missingExamples: string[] = [];

    for (const example of expectedExamples) {
      const examplePath = path.join(projectRoot, example);
      if (!fs.existsSync(examplePath)) {
        missingExamples.push(example);
      }
    }

    expect(missingExamples).toEqual([]);
  });

  /**
   * Property 6: Root directory contains only essential files
   * Validates: Requirements 1.1, 1.4
   *
   * Ensures the root directory is clean and contains only essential files,
   * with documentation and examples moved to their respective subdirectories.
   */
  it('should have clean root directory with only essential files', () => {
    const allowedRootItems = new Set([
      // Directories
      'src',
      'test',
      'dist',
      'node_modules',
      'docs',
      'examples',
      'demo', // Demo CDK project showcasing cdk-cost-analyzer usage
      'test-cdk-project', // Legacy test project, kept for backwards compatibility
      'coverage', // Jest coverage reports
      'test-reports', // Test output reports
      '.git',
      '.kiro',

      // Configuration files
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'tsconfig.dev.json', // Projen dev config
      'tsconfig.tsbuildinfo', // TypeScript build info cache
      '.gitignore',
      '.npmignore',
      '.gitattributes', // Projen generated
      '.eslintrc.json', // Projen generated
      '.projenrc.ts', // Projen configuration
      '.projen', // Projen metadata
      'yarn.lock', // Projen uses yarn

      // Documentation
      'README.md',
      'LICENSE',
      'LICENSE.md',
      'CHANGELOG.md', // Project changelog
      'CONTRIBUTING.md', // Contribution guidelines
      'SECURITY.md', // Security policy

      // CI/CD
      '.gitlab-ci.yml', // GitLab CI configuration
      '.github', // GitHub Actions workflows
      '.husky', // Git hooks
      '.mergify.yml', // Mergify configuration
      'action.yml', // GitHub Action metadata
      'tools', // Development tools and utilities
    ]);

    const rootEntries = fs.readdirSync(projectRoot);
    const unexpectedItems = rootEntries.filter(item => !allowedRootItems.has(item));

    // Filter out common acceptable hidden files and temporary debug logs
    const problematicItems = unexpectedItems.filter(item => {
      // Allow common hidden files
      if (item.startsWith('.') && !['.git', '.kiro'].includes(item)) {
        // Allow .DS_Store, .vscode, etc., but flag others
        const acceptableHidden = ['.DS_Store', '.vscode', '.idea', '.npmrc', '.nvmrc', '.cdk-cost-analyzer-cache', '.test-cache', '.test-cache-integration', '.claude'];
        return !acceptableHidden.includes(item);
      }
      // Allow debug log files (temporary development artifacts)
      if (item.endsWith('.log') && item.startsWith('debug')) {
        return false;
      }
      return true;
    });

    if (problematicItems.length > 0) {
      const errorMessage = `Unexpected items in root directory:\n  ${problematicItems.join('\n  ')}`;
      throw new Error(errorMessage);
    }

    expect(problematicItems).toEqual([]);
  });
});
