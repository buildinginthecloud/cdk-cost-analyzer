import { App, CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { Construct } from 'constructs';
import { BastionHosts } from './constructs/BastionHosts';
import { SloganApi } from './constructs/SloganApi';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // Create VPC for ECS cluster
    const vpc = new ec2.Vpc(this, 'EcsVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Create ECS cluster
    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENHANCED,
    });

    // Create Fargate service with ALB
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'HelloWorldService', {
      cluster,
      memoryLimitMiB: 512,
      cpu: 256,
      desiredCount: 2,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        containerPort: 80,
      },
      publicLoadBalancer: true,
    });

    // Configure health check
    fargateService.targetGroup.configureHealthCheck({
      path: '/',
      interval: Duration.seconds(30),
    });

    // Create Slogan API with DynamoDB, Lambda, and API Gateway
    const sloganApi = new SloganApi(this, 'SloganApi');

    // Create bastion hosts in Auto Scaling Group
    const bastionHosts = new BastionHosts(this, 'BastionHosts', {
      vpc,
      // Restrict SSH access - replace with your IP range for production
      allowedCidr: '0.0.0.0/0',
    });

    // Output API endpoint
    new CfnOutput(this, 'SloganApiEndpoint', {
      value: sloganApi.api.url,
      description: 'Slogan API endpoint',
      exportName: 'SloganApiUrl',
    });

    new CfnOutput(this, 'SloganTableName', {
      value: sloganApi.table.tableName,
      description: 'DynamoDB table name for slogans',
    });

    new CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'Load balancer DNS name',
    });

    new CfnOutput(this, 'BastionSecurityGroupId', {
      value: bastionHosts.securityGroup.securityGroupId,
      description: 'Security group ID for bastion hosts',
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'demo-dev', { env: devEnv });
// new MyStack(app, 'demo-prod', { env: prodEnv });

app.synth();