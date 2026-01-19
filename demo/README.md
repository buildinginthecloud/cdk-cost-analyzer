# Demo CDK Project - ECS Fargate Hello World

This is a demo CDK project showcasing an ECS Fargate pattern with Application Load Balancer, plus a serverless API for retrieving random slogans.

## Architecture

The stack creates:

### ECS Infrastructure

- **VPC**: A new VPC with 2 availability zones and 1 NAT Gateway
- **ECS Cluster**: An ECS cluster with Container Insights enabled
- **Fargate Service**: A load-balanced Fargate service running the Amazon ECS sample application
  - 2 tasks for high availability
  - 512 MiB memory, 256 CPU units per task
  - Health checks configured on the target group
- **Application Load Balancer**: Public-facing ALB distributing traffic to the Fargate tasks

### Bastion Hosts

- **Auto Scaling Group**: 2 EC2 instances (t3.micro) in public subnets
- **Amazon Linux 2023**: Latest AMI with automatic updates
- **AWS Systems Manager**: SSM agent enabled for secure access without SSH keys
- **Security Group**: Configurable SSH access (port 22)
- **High Availability**: Instances distributed across availability zones
- **Monitoring**: CloudWatch metrics and health checks enabled

### Serverless API

- **DynamoDB Table**: Table storing slogans with partition key `id`
- **Lambda Function**: Node.js 20.x function that retrieves a random slogan from DynamoDB
- **API Gateway**: REST API exposing the Lambda function at `/slogans/random`

## Deployment

```bash
# Install dependencies
npm install

# Synthesize CloudFormation template
npm run synth

# Deploy to AWS
npm run deploy

# Note the outputs:
# - LoadBalancerDNS: ECS service endpoint
# - SloganApiEndpoint: API Gateway endpoint
# - SloganTableName: DynamoDB table name
```

## Seeding the Database

After deployment, populate the DynamoDB table with sample slogans:

```bash
# Get the table name from the deployment output
TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name demo-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`SloganTableName`].OutputValue' \
  --output text)

# Seed the table
node scripts/seed-slogans.js $TABLE_NAME
```

## Testing the API

```bash
# Get the API endpoint
API_URL=$(aws cloudformation describe-stacks \
  --stack-name demo-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`SloganApiEndpoint`].OutputValue' \
  --output text)

# Get a random slogan
curl ${API_URL}slogans/random
```

Expected response:
```json
{
  "id": "1",
  "text": "Just Do It",
  "brand": "Nike"
}
```

## Accessing the Application

After deployment, access your resources at:

- **ECS Application**: `http://<LoadBalancerDNS>`
- **Slogan API**: `<SloganApiEndpoint>slogans/random`
- **Bastion Hosts**: Connect via AWS Systems Manager Session Manager or SSH

### Connecting to Bastion Hosts

**Option 1: AWS Systems Manager Session Manager (Recommended)**

```bash
# List bastion instances
aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=*BastionASG*" \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress]' \
  --output table --no-cli-pager

# Connect via Session Manager (no SSH key required)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=*BastionASG*" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text --no-cli-pager)

aws ssm start-session --target $INSTANCE_ID
```

**Option 2: SSH (Requires EC2 Key Pair)**

If you specified a key pair during deployment:

```bash
# Get bastion public IP
BASTION_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=*BastionASG*" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text --no-cli-pager)

# Connect via SSH
ssh -i /path/to/your-key.pem ec2-user@$BASTION_IP
```

## Cost Considerations

This demo creates resources that incur costs:
- NAT Gateway (~$0.045/hour)
- Application Load Balancer (~$0.0225/hour)
- ECS Fargate tasks (2 tasks with 0.25 vCPU, 0.5 GB memory)
- EC2 bastion hosts (2 x t3.micro instances ~$0.012/hour each = $17.52/month)
- DynamoDB (pay-per-request pricing)
- Lambda (pay-per-invocation)
- API Gateway (pay-per-request)

**Estimated monthly cost**: ~$65-85 USD (excluding data transfer and API usage)

**Note**: cdk-cost-analyzer does not currently detect EC2 instances in AutoScaling Groups. The bastion host costs ($17.52/month) are calculated manually based on AWS Pricing API data for t3.micro instances in eu-central-1.

Remember to destroy the stack when done testing to avoid unnecessary charges.

## Cleanup

```bash
npm run destroy
```

## Customization

### ECS Service

1. **Change container image**: Modify `taskImageOptions.image` in `src/main.ts`
2. **Adjust capacity**: Change `memoryLimitMiB`, `cpu`, or `desiredCount`
3. **Configure auto-scaling**: Add auto-scaling policies to the service
4. **Use custom VPC**: Replace the VPC creation with `Vpc.fromLookup()`

### Bastion Hosts

1. **Change instance type**: Modify `instanceType` in `BastionHosts` props
2. **Restrict SSH access**: Update `allowedCidr` to your IP range (e.g., `"1.2.3.4/32"`)
3. **Add SSH key**: Specify `keyName` in `BastionHosts` props
4. **Adjust capacity**: Change `minCapacity`, `maxCapacity`, or `desiredCapacity` in `BastionHosts.ts`
5. **Install additional tools**: Modify the user data script in `BastionHosts.ts`

### Slogan API

1. **Modify Lambda runtime**: Edit `runtime` in `src/constructs/SloganApi.ts`
2. **Add more API endpoints**: Extend the API Gateway configuration
3. **Change DynamoDB schema**: Update the table definition and Lambda code
4. **Add authentication**: Integrate API Gateway with Amazon Cognito

## Security Best Practices

### Bastion Hosts

- **Restrict SSH access**: Update `allowedCidr` to specific IP ranges instead of `0.0.0.0/0`
- **Use Session Manager**: Prefer AWS Systems Manager Session Manager over SSH
- **Enable MFA**: Configure MFA for IAM users accessing bastion hosts
- **Audit access**: Enable CloudTrail logging for Session Manager sessions
- **Regular updates**: Bastion hosts automatically update on launch

### Network Security

- **Security groups**: Review and restrict security group rules
- **VPC Flow Logs**: Enable VPC Flow Logs for network monitoring
- **Private subnets**: Keep application resources in private subnets
- **NAT Gateway**: Use NAT Gateway for outbound internet access from private subnets