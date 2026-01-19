import { RemovalPolicy } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface SloganApiProps {
  readonly tableName?: string;
}

export class SloganApi extends Construct {
  public readonly table: dynamodb.Table;
  public readonly api: apigateway.RestApi;
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: SloganApiProps = {}) {
    super(scope, id);

    this.table = this.createTable(props.tableName);
    this.handler = this.createLambda();
    this.api = this.createApi();
  }

  protected createTable(tableName?: string): dynamodb.Table {
    return new dynamodb.Table(this, 'SloganTable', {
      tableName,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  protected createLambda(): lambda.Function {
    const fn = new lambda.Function(this, 'SloganHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const client = new DynamoDBClient({});

exports.handler = async (event) => {
  try {
    const command = new ScanCommand({
      TableName: process.env.TABLE_NAME,
    });
    
    const response = await client.send(command);
    
    if (!response.Items || response.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'No slogans found' }),
      };
    }
    
    const items = response.Items.map(item => unmarshall(item));
    const randomSlogan = items[Math.floor(Math.random() * items.length)];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(randomSlogan),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
      `),
      environment: {
        TABLE_NAME: this.table.tableName,
      },
    });

    this.table.grantReadData(fn);

    return fn;
  }

  protected createApi(): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'SloganApi', {
      restApiName: 'Slogan Service',
      description: 'API for retrieving random slogans',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const slogans = api.root.addResource('slogans');
    const random = slogans.addResource('random');

    random.addMethod('GET', new apigateway.LambdaIntegration(this.handler));

    return api;
  }
}
