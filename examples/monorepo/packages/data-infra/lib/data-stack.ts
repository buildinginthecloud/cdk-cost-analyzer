import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Data infrastructure stack
 * 
 * Creates RDS database, ElastiCache cluster, and S3 bucket for data storage
 */
export class DataStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for data resources
    const vpc = new ec2.Vpc(this, 'DataVpc', {
      vpcName: 'data-vpc',
      maxAzs: 2,
      natGateways: 1,
    });

    // Security group for database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for RDS database',
      allowAllOutbound: false,
    });

    // RDS PostgreSQL Database
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_3,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [dbSecurityGroup],
      allocatedStorage: 100,
      storageType: rds.StorageType.GP3,
      multiAz: false,
      databaseName: 'datadb',
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    // Security group for cache
    const cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      vpc,
      description: 'Security group for ElastiCache',
      allowAllOutbound: false,
    });

    // ElastiCache subnet group
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
      description: 'Subnet group for ElastiCache',
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
    });

    // ElastiCache Redis Cluster
    const cacheCluster = new elasticache.CfnCacheCluster(this, 'CacheCluster', {
      cacheNodeType: 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 2,
      vpcSecurityGroupIds: [cacheSecurityGroup.securityGroupId],
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      engineVersion: '7.0',
    });

    // S3 bucket for data storage
    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `${cdk.Stack.of(this).account}-data-storage-${cdk.Stack.of(this).region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
        {
          id: 'TransitionToGlacier',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    // Stack outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.dbInstanceEndpointAddress,
      description: 'RDS database endpoint',
    });

    new cdk.CfnOutput(this, 'CacheEndpoint', {
      value: cacheCluster.attrRedisEndpointAddress,
      description: 'ElastiCache Redis endpoint',
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: dataBucket.bucketName,
      description: 'S3 data bucket name',
    });
  }
}
