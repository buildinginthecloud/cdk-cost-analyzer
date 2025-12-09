#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack } from '../lib/networking-stack';
import { ComputeStack } from '../lib/compute-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create networking stack (foundation)
const networkingStack = new NetworkingStack(app, 'NetworkingStack', {
  env,
  description: 'Multi-stack example - Networking layer (VPC, NAT Gateway, VPC Endpoints)',
});

// Create compute stack (depends on networking)
const computeStack = new ComputeStack(app, 'ComputeStack', {
  env,
  vpc: networkingStack.vpc,
  description: 'Multi-stack example - Compute layer (ECS, ALB)',
});

// Create storage stack (depends on networking and compute)
const storageStack = new StorageStack(app, 'StorageStack', {
  env,
  vpc: networkingStack.vpc,
  appSecurityGroup: computeStack.appSecurityGroup,
  description: 'Multi-stack example - Storage layer (RDS, ElastiCache, S3)',
});

app.synth();
