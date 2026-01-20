#!/usr/bin/env node

/**
 * Example: NAT Gateway Pricing with Debug Logging
 * 
 * This example demonstrates how to use the NAT Gateway calculator
 * with debug logging enabled to see detailed pricing queries.
 * 
 * Usage:
 *   node examples/nat-gateway-debug-example.js
 * 
 * Requirements:
 *   - AWS credentials configured
 *   - Internet access to AWS Pricing API
 */

const { NatGatewayCalculator } = require('../dist/pricing/calculators/NatGatewayCalculator');
const { PricingClient } = require('../dist/pricing/PricingClient');
const { Logger } = require('../dist/utils/Logger');

async function demonstrateNatGatewayPricing() {
  console.log('='.repeat(60));
  console.log('NAT Gateway Pricing Calculator - Debug Logging Example');
  console.log('='.repeat(60));
  console.log();

  // Enable debug logging to see detailed pricing queries
  Logger.setDebugEnabled(true);
  console.log('✓ Debug logging enabled\n');

  // Create pricing client (connects to AWS Pricing API in us-east-1)
  const pricingClient = new PricingClient('us-east-1');
  console.log('✓ Pricing client initialized\n');

  // Example 1: eu-central-1 with default data processing (100 GB)
  console.log('Example 1: NAT Gateway in eu-central-1 (default 100 GB data)');
  console.log('-'.repeat(60));
  
  const calculator1 = new NatGatewayCalculator();
  const testResource = {
    logicalId: 'MyNatGateway',
    type: 'AWS::EC2::NatGateway',
    properties: {},
  };

  try {
    const cost1 = await calculator1.calculateCost(testResource, 'eu-central-1', pricingClient);
    
    console.log('\nResult:');
    console.log(`  Amount: $${cost1.amount.toFixed(2)}/month`);
    console.log(`  Currency: ${cost1.currency}`);
    console.log(`  Confidence: ${cost1.confidence}`);
    console.log('\nAssumptions:');
    cost1.assumptions.forEach(assumption => {
      console.log(`  - ${assumption}`);
    });
  } catch (error) {
    console.error('Error calculating cost:', error.message);
  }

  console.log('\n');

  // Example 2: us-east-1 with custom data processing (500 GB)
  console.log('Example 2: NAT Gateway in us-east-1 (custom 500 GB data)');
  console.log('-'.repeat(60));

  const calculator2 = new NatGatewayCalculator(500); // 500 GB data processing

  try {
    const cost2 = await calculator2.calculateCost(testResource, 'us-east-1', pricingClient);
    
    console.log('\nResult:');
    console.log(`  Amount: $${cost2.amount.toFixed(2)}/month`);
    console.log(`  Currency: ${cost2.currency}`);
    console.log(`  Confidence: ${cost2.confidence}`);
    console.log('\nAssumptions:');
    cost2.assumptions.forEach(assumption => {
      console.log(`  - ${assumption}`);
    });
  } catch (error) {
    console.error('Error calculating cost:', error.message);
  }

  console.log('\n');

  // Example 3: Comparing multiple regions
  console.log('Example 3: Comparing NAT Gateway costs across regions');
  console.log('-'.repeat(60));

  const regions = ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1'];
  const calculator3 = new NatGatewayCalculator(100);

  console.log('\nRegion Comparison (100 GB data processing):');
  console.log();

  for (const region of regions) {
    try {
      const cost = await calculator3.calculateCost(testResource, region, pricingClient);
      
      if (cost.amount > 0) {
        console.log(`  ${region.padEnd(20)} $${cost.amount.toFixed(2)}/month`);
      } else {
        console.log(`  ${region.padEnd(20)} Pricing not available`);
      }
    } catch (error) {
      console.log(`  ${region.padEnd(20)} Error: ${error.message}`);
    }
  }

  // Clean up
  pricingClient.destroy();
  Logger.setDebugEnabled(false);

  console.log('\n');
  console.log('='.repeat(60));
  console.log('Example complete!');
  console.log('='.repeat(60));
  console.log();
  console.log('Note: Debug logs are written to stderr (above) and results to stdout.');
  console.log('This allows you to separate debug information from actual data.');
}

// Run the example
demonstrateNatGatewayPricing()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });
