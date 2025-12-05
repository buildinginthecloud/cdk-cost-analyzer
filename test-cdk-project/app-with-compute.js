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

// Target Stack - Proposed changes with EC2 and RDS
class TargetStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Keep the S3 bucket
    new s3.Bucket(this, 'MyBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Upgrade Lambda to 512MB (MODIFIED)
    new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 512,
    });

    // Create VPC for EC2 and RDS
    const vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Add EC2 instance (NEW)
    new ec2.Instance(this, 'MyInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
    });

    // Add RDS database (NEW)
    new rds.DatabaseInstance(this, 'MyDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      allocatedStorage: 20,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });
  }
}

const app = new cdk.App();

// Synthesize based on context
const stackType = app.node.tryGetContext('stack') || 'base';

const env = {
  account: '585008061383',
  region: 'eu-central-1',
};

if (stackType === 'base') {
  new BaseStack(app, 'ComputeStack', { env });
} else {
  new TargetStack(app, 'ComputeStack', { env });
}

app.synth();
