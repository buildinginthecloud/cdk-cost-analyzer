#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class WorkflowValidator {
  constructor() {
    this.workspaceRoot = path.resolve(__dirname, '../..');
  }

  isActAvailable() {
    try {
      execSync('which act', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  validateWorkflowFiles() {
    const workflowDir = path.join(this.workspaceRoot, '.github/workflows');
    
    if (!fs.existsSync(workflowDir)) {
      console.log('❌ No .github/workflows directory found');
      return false;
    }

    const workflowFiles = fs.readdirSync(workflowDir)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

    if (workflowFiles.length === 0) {
      console.log('❌ No workflow files found');
      return false;
    }

    console.log(`📋 Found ${workflowFiles.length} workflow file(s): ${workflowFiles.join(', ')}`);

    // Validate YAML syntax
    for (const file of workflowFiles) {
      try {
        const content = fs.readFileSync(path.join(workflowDir, file), 'utf8');
        yaml.load(content);
        console.log(`✅ ${file}: Valid YAML syntax`);
      } catch (error) {
        console.log(`❌ ${file}: Invalid YAML syntax - ${error.message}`);
        return false;
      }
    }

    return true;
  }

  validateWithAct() {
    if (!this.isActAvailable()) {
      console.log('⚠️  act not available - skipping workflow execution validation');
      console.log('   Install with: brew install act');
      return true; // Don't fail if act is not available
    }

    try {
      console.log('🔍 Validating workflows with act...');
      
      // List workflows to validate they can be parsed
      const result = execSync('act --list', {
        cwd: this.workspaceRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 10000,
      });

      if (result.includes('test') || result.includes('upgrade')) {
        console.log('✅ Workflows can be parsed by act');
        return true;
      } else {
        console.log('❌ No expected workflows found by act');
        return false;
      }
    } catch (error) {
      console.log(`❌ act validation failed: ${error.message}`);
      return false;
    }
  }

  validate() {
    console.log('🚀 Validating GitHub Actions workflows...\n');

    const yamlValid = this.validateWorkflowFiles();
    if (!yamlValid) {
      process.exit(1);
    }

    const actValid = this.validateWithAct();
    if (!actValid) {
      process.exit(1);
    }

    console.log('\n✅ All workflow validations passed!');
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new WorkflowValidator();
  validator.validate();
}

module.exports = WorkflowValidator;