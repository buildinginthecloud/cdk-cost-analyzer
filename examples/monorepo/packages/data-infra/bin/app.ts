#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';

const app = new cdk.App();

new DataStack(app, 'DataStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Monorepo example - Data infrastructure (RDS, ElastiCache, S3)',
});

app.synth();
