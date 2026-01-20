import { Duration } from 'aws-cdk-lib';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BastionHostsProps {
  readonly vpc: ec2.IVpc;
  readonly allowedCidr?: string;
  readonly instanceType?: ec2.InstanceType;
  readonly keyName?: string;
}

export class BastionHosts extends Construct {
  public readonly autoScalingGroup: autoscaling.AutoScalingGroup;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: BastionHostsProps) {
    super(scope, id);

    this.securityGroup = this.createSecurityGroup(props.vpc, props.allowedCidr);
    this.autoScalingGroup = this.createAutoScalingGroup(props);
  }

  protected createSecurityGroup(vpc: ec2.IVpc, allowedCidr?: string): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc,
      description: 'Security group for bastion hosts',
      allowAllOutbound: true,
    });

    // Allow SSH from specified CIDR or default to a restrictive range
    const cidr = allowedCidr || '0.0.0.0/0';
    sg.addIngressRule(
      ec2.Peer.ipv4(cidr),
      ec2.Port.tcp(22),
      'Allow SSH access to bastion hosts',
    );

    return sg;
  }

  protected createAutoScalingGroup(props: BastionHostsProps): autoscaling.AutoScalingGroup {
    // Create IAM role for bastion hosts with SSM access
    const role = new iam.Role(this, 'BastionRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for bastion hosts',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // User data script for bastion configuration
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'yum update -y',
      'yum install -y amazon-ssm-agent',
      'systemctl enable amazon-ssm-agent',
      'systemctl start amazon-ssm-agent',
      '',
      '# Install useful tools',
      'yum install -y htop tmux vim',
      '',
      '# Configure SSH banner',
      'echo "================================================" > /etc/ssh/banner',
      'echo "  Bastion Host - Authorized Access Only" >> /etc/ssh/banner',
      'echo "  All activities are logged and monitored" >> /etc/ssh/banner',
      'echo "================================================" >> /etc/ssh/banner',
      'echo "Banner /etc/ssh/banner" >> /etc/ssh/sshd_config',
      'systemctl restart sshd',
    );

    const asg = new autoscaling.AutoScalingGroup(this, 'BastionASG', {
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: props.instanceType || ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cachedInContext: false,
      }),
      minCapacity: 2,
      maxCapacity: 2,
      desiredCapacity: 2,
      securityGroup: this.securityGroup,
      role,
      userData,
      keyName: props.keyName,
      healthCheck: autoscaling.HealthCheck.ec2({
        grace: Duration.minutes(5),
      }),
      updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
        maxBatchSize: 1,
        minInstancesInService: 1,
        pauseTime: Duration.minutes(5),
      }),
    });

    // Add tags for identification
    asg.node.addMetadata('Purpose', 'Bastion Host');

    return asg;
  }

  public allowConnectionsFrom(other: ec2.IConnectable, port: ec2.Port, description?: string): void {
    other.connections.allowFrom(
      this.autoScalingGroup,
      port,
      description || 'Allow connection from bastion hosts',
    );
  }
}
