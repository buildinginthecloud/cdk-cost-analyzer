import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

/**
 * Backend infrastructure stack
 * 
 * Creates Lambda functions, API Gateway, and DynamoDB table
 */
export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table
    const table = new dynamodb.Table(this, 'DataTable', {
      tableName: 'backend-data',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 10,
      writeCapacity: 10,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for API handler
    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      functionName: 'backend-api-handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
        const client = new DynamoDBClient({});
        
        exports.handler = async (event) => {
          const tableName = process.env.TABLE_NAME;
          
          try {
            if (event.httpMethod === 'POST') {
              const body = JSON.parse(event.body);
              await client.send(new PutItemCommand({
                TableName: tableName,
                Item: {
                  id: { S: body.id },
                  timestamp: { N: Date.now().toString() },
                  data: { S: JSON.stringify(body.data) }
                }
              }));
              return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Item created' })
              };
            } else {
              const result = await client.send(new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'id = :id',
                ExpressionAttributeValues: { ':id': { S: event.pathParameters.id } }
              }));
              return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.Items)
              };
            }
          } catch (error) {
            return {
              statusCode: 500,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: error.message })
            };
          }
        };
      `),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Grant Lambda permissions to access DynamoDB
    table.grantReadWriteData(apiHandler);

    // API Gateway
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'Backend API',
      description: 'Backend REST API',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    // API Gateway integration
    const integration = new apigateway.LambdaIntegration(apiHandler);
    
    const items = api.root.addResource('items');
    items.addMethod('POST', integration);
    
    const item = items.addResource('{id}');
    item.addMethod('GET', integration);

    // Stack outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: apiHandler.functionName,
      description: 'Lambda function name',
    });
  }
}
