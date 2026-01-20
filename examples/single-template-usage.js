/**
 * Example: Single Template Cost Analysis
 * 
 * This example demonstrates how to use the analyzeSingleTemplate API
 * to analyze a CloudFormation template for estimated monthly costs.
 */

const { analyzeSingleTemplate } = require('cdk-cost-analyzer');
const fs = require('fs');

async function main() {
  // Example 1: Analyze a simple S3 and Lambda template
  const simpleTemplate = {
    Resources: {
      MyBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {}
      },
      MyFunction: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          Runtime: 'nodejs20.x',
          Handler: 'index.handler',
          Code: {
            ZipFile: 'exports.handler = async () => ({ statusCode: 200 });'
          },
          MemorySize: 128
        }
      },
      MyTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' }
          ],
          KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' }
          ]
        }
      }
    }
  };

  console.log('='.repeat(80));
  console.log('Example 1: Simple Template Analysis');
  console.log('='.repeat(80));
  console.log();

  try {
    const result = await analyzeSingleTemplate({
      template: JSON.stringify(simpleTemplate),
      region: 'us-east-1',
      format: 'text'
    });

    console.log(result.summary);
    console.log();
    console.log('Programmatic Access:');
    console.log(`  Total Monthly Cost: $${result.totalMonthlyCost.toFixed(2)}`);
    console.log(`  Currency: ${result.currency}`);
    console.log(`  Total Resources: ${result.metadata.resourceCount}`);
    console.log(`  Supported: ${result.metadata.supportedResourceCount}`);
    console.log(`  Unsupported: ${result.metadata.unsupportedResourceCount}`);
    console.log();
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Example 2: Analyze with custom usage assumptions
  console.log('='.repeat(80));
  console.log('Example 2: Analysis with Custom Usage Assumptions');
  console.log('='.repeat(80));
  console.log();

  try {
    const result = await analyzeSingleTemplate({
      template: JSON.stringify(simpleTemplate),
      region: 'us-east-1',
      format: 'text',
      config: {
        usageAssumptions: {
          lambda: {
            invocationsPerMonth: 10000000,  // 10 million invocations
            averageDurationMs: 500           // 500ms average duration
          },
          s3: {
            storageGB: 1000,                 // 1TB storage
            requestsPerMonth: 1000000        // 1M requests
          }
        }
      }
    });

    console.log(result.summary);
    console.log();
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Example 3: JSON format for programmatic processing
  console.log('='.repeat(80));
  console.log('Example 3: JSON Format Output');
  console.log('='.repeat(80));
  console.log();

  try {
    const result = await analyzeSingleTemplate({
      template: JSON.stringify(simpleTemplate),
      region: 'us-east-1',
      format: 'json'
    });

    const parsed = JSON.parse(result.summary);
    console.log('JSON Result (excerpt):');
    console.log(JSON.stringify({
      totalMonthlyCost: parsed.totalMonthlyCost,
      currency: parsed.currency,
      resourceCount: parsed.metadata.resourceCount,
      costBreakdownSummary: parsed.costBreakdown.byResourceType.map(rt => ({
        type: rt.resourceType,
        count: rt.count,
        totalCost: rt.totalCost
      }))
    }, null, 2));
    console.log();
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Example 4: Markdown format for documentation
  console.log('='.repeat(80));
  console.log('Example 4: Markdown Format Output');
  console.log('='.repeat(80));
  console.log();

  try {
    const result = await analyzeSingleTemplate({
      template: JSON.stringify(simpleTemplate),
      region: 'eu-west-1',
      format: 'markdown'
    });

    console.log(result.summary);
    console.log();
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Example 5: Analyze from file
  console.log('='.repeat(80));
  console.log('Example 5: Analyze Template from File');
  console.log('='.repeat(80));
  console.log();

  const templatePath = './demo/cdk.out.1/MyStack.template.json';
  if (fs.existsSync(templatePath)) {
    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const result = await analyzeSingleTemplate({
        template: templateContent,
        region: 'us-east-1',
        format: 'text'
      });

      console.log(result.summary);
      console.log();
    } catch (error) {
      console.error('Error:', error.message);
    }
  } else {
    console.log(`Template file not found: ${templatePath}`);
    console.log('Skipping file-based example.');
    console.log();
  }

  // Example 6: Exclude certain resource types
  console.log('='.repeat(80));
  console.log('Example 6: Exclude Specific Resource Types');
  console.log('='.repeat(80));
  console.log();

  try {
    const result = await analyzeSingleTemplate({
      template: JSON.stringify(simpleTemplate),
      region: 'us-east-1',
      format: 'text',
      config: {
        excludedResourceTypes: [
          'AWS::S3::Bucket'  // Exclude S3 buckets from cost analysis
        ]
      }
    });

    console.log(result.summary);
    console.log();
    console.log('Note: S3 bucket costs are excluded from the analysis.');
    console.log();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run examples
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
