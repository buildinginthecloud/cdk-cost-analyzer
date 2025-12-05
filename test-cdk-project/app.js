#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { Stack } = require('aws-cdk-lib');
const ec2 = require('aws-cdk-lib/aws-ec2');
const s3 = require('aws-cdk-lib/aws-s3');
const lambda = require('aws-cdk-lib/aws-lambda');
const rds = require('aws-cdk-lib/aws-rds');

// Base Stack - Current infrastructure
class BaseStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Simple S3 bucket
    new s3.Bucket(this, 'MyBucket', {
      bucketName: 'my-test-bucket-base',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function with 128MB
    new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 128,
    });
  }
}

// Target Stack - Proposed changes
class TargetStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Keep the S3 bucket
    new s3.Bucket(this, 'MyBucket', {
      bucketName: 'my-test-bucket-base',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Upgrade Lambda to 512MB (MODIFIED)
    new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 1024,
    });

    // Add another Lambda function (NEW)
    new lambda.Function(this, 'MyNewFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 2560,
    });

    // Add another S3 bucket (NEW)
    new s3.Bucket(this, 'MyNewBucket', {
      bucketName: 'my-test-bucket-new',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}

const app = new cdk.App();

// Synthesize based on context
const stackType = app.node.tryGetContext('stack') || 'base';

const env = {
  account: '585008061383',
  region: 'eu-central-1'
};

if (stackType === 'base') {
  new BaseStack(app, 'TestStack', { env });
} else {
  new TargetStack(app, 'TestStack', { env });
}

app.synth();
