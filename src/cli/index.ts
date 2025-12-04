#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import { analyzeCosts } from '../api';

const program = new Command();

program
  .name('cdk-cost-analyzer')
  .description('Analyze AWS CDK infrastructure changes and provide cost impact summaries')
  .version('1.0.0')
  .argument('<base>', 'Path to base CloudFormation template')
  .argument('<target>', 'Path to target CloudFormation template')
  .option('--region <region>', 'AWS region', 'eu-central-1')
  .option('--format <format>', 'Output format: text|json|markdown', 'text')
  .action(async (basePath: string, targetPath: string, options: { region: string; format: string }) => {
    try {
      if (!fs.existsSync(basePath)) {
        console.error(`Error: Base template file not found: ${basePath}`);
        process.exit(1);
      }

      if (!fs.existsSync(targetPath)) {
        console.error(`Error: Target template file not found: ${targetPath}`);
        process.exit(1);
      }

      const baseTemplate = fs.readFileSync(basePath, 'utf-8');
      const targetTemplate = fs.readFileSync(targetPath, 'utf-8');

      const result = await analyzeCosts({
        baseTemplate,
        targetTemplate,
        region: options.region,
        format: options.format as 'text' | 'json' | 'markdown',
      });

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.summary);
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error(`Error: ${String(error)}`);
      }
      process.exit(1);
    }
  });

program.parse();
