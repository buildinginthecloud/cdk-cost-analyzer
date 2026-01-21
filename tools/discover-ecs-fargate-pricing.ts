#!/usr/bin/env ts-node
/**
 * Discovery script for ECS Fargate pricing filters
 * 
 * This script helps identify the correct filters for querying
 * AWS Pricing API for ECS Fargate vCPU and memory pricing.
 * 
 * Usage:
 *   npx ts-node tools/discover-ecs-fargate-pricing.ts
 */

import { PricingClient as AWSPricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';

async function discoverECSFargatePricing(): Promise<void> {
  const client = new AWSPricingClient({ 
    region: 'us-east-1',
    credentials: undefined, // Will use AWS_PROFILE from environment
  });

  console.log('='.repeat(80));
  console.log('ECS Fargate Pricing Discovery');
  console.log('='.repeat(80));
  console.log();

  // Test 1: Find all ECS products
  console.log('Test 1: Searching for ECS products...');
  try {
    const command1 = new GetProductsCommand({
      ServiceCode: 'AmazonECS',
      MaxResults: 10,
    });
    const response1 = await client.send(command1);
    
    if (response1.PriceList && response1.PriceList.length > 0) {
      console.log(`Found ${response1.PriceList.length} ECS products`);
      console.log('\nSample product attributes:');
      const sample = JSON.parse(response1.PriceList[0]);
      console.log(JSON.stringify(sample.product?.attributes, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
  console.log();

  // Test 2: Search for Fargate-specific products
  console.log('Test 2: Searching for Fargate products...');
  try {
    const command2 = new GetProductsCommand({
      ServiceCode: 'AmazonECS',
      Filters: [
        { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute' },
      ],
      MaxResults: 10,
    });
    const response2 = await client.send(command2);
    
    if (response2.PriceList && response2.PriceList.length > 0) {
      console.log(`Found ${response2.PriceList.length} Compute products`);
      response2.PriceList.forEach((item: string, idx: number) => {
        const product = JSON.parse(item);
        const attrs = product.product?.attributes;
        console.log(`\nProduct ${idx + 1}:`);
        console.log(`  usagetype: ${attrs?.usagetype}`);
        console.log(`  operation: ${attrs?.operation}`);
        console.log(`  productFamily: ${attrs?.productFamily}`);
        console.log(`  group: ${attrs?.group}`);
        console.log(`  groupDescription: ${attrs?.groupDescription}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
  console.log();

  // Test 3: Search for vCPU pricing
  console.log('Test 3: Searching for Fargate vCPU pricing...');
  const vCpuFilters = [
    [
      { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute' },
      { Type: 'TERM_MATCH', Field: 'usagetype', Value: `EUC1-Fargate-vCPU-Hours:perCPU` },
    ],
    [
      { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute' },
      { Type: 'TERM_MATCH', Field: 'usagetype', Value: `Fargate-vCPU-Hours:perCPU` },
    ],
    [
      { Type: 'TERM_MATCH', Field: 'group', Value: 'Fargate-vCPU-Hours:perCPU' },
    ],
  ];

  for (let i = 0; i < vCpuFilters.length; i++) {
    console.log(`\nAttempt ${i + 1}:`, JSON.stringify(vCpuFilters[i]));
    try {
      const command = new GetProductsCommand({
        ServiceCode: 'AmazonECS',
        Filters: vCpuFilters[i] as any,
        MaxResults: 1,
      });
      const response = await client.send(command);
      
      if (response.PriceList && response.PriceList.length > 0) {
        const product = JSON.parse(response.PriceList[0]);
        console.log('✓ SUCCESS! Found vCPU pricing');
        console.log('  Attributes:', JSON.stringify(product.product?.attributes, null, 2));
        
        const onDemand = product.terms?.OnDemand;
        if (onDemand) {
          const termKey = Object.keys(onDemand)[0];
          const priceDimensions = onDemand[termKey]?.priceDimensions;
          const dimensionKey = Object.keys(priceDimensions)[0];
          const price = priceDimensions[dimensionKey]?.pricePerUnit?.USD;
          console.log(`  Price: $${price} per vCPU-hour`);
        }
      } else {
        console.log('✗ No results');
      }
    } catch (error) {
      console.error('✗ Error:', error instanceof Error ? error.message : error);
    }
  }
  console.log();

  // Test 4: Search for memory pricing
  console.log('Test 4: Searching for Fargate memory pricing...');
  const memoryFilters = [
    [
      { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute' },
      { Type: 'TERM_MATCH', Field: 'usagetype', Value: `EUC1-Fargate-GB-Hours:perGB` },
    ],
    [
      { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute' },
      { Type: 'TERM_MATCH', Field: 'usagetype', Value: `EUC1-Fargate-Memory-Hours:perGB` },
    ],
    [
      { Type: 'TERM_MATCH', Field: 'usagetype', Value: `EUC1-Fargate-GB-Hours` },
    ],
    [
      { Type: 'TERM_MATCH', Field: 'cputype', Value: 'perGB' },
    ],
  ];

  for (let i = 0; i < memoryFilters.length; i++) {
    console.log(`\nAttempt ${i + 1}:`, JSON.stringify(memoryFilters[i]));
    try {
      const command = new GetProductsCommand({
        ServiceCode: 'AmazonECS',
        Filters: memoryFilters[i] as any,
        MaxResults: 1,
      });
      const response = await client.send(command);
      
      if (response.PriceList && response.PriceList.length > 0) {
        const product = JSON.parse(response.PriceList[0]);
        console.log('✓ SUCCESS! Found memory pricing');
        console.log('  Attributes:', JSON.stringify(product.product?.attributes, null, 2));
        
        const onDemand = product.terms?.OnDemand;
        if (onDemand) {
          const termKey = Object.keys(onDemand)[0];
          const priceDimensions = onDemand[termKey]?.priceDimensions;
          const dimensionKey = Object.keys(priceDimensions)[0];
          const price = priceDimensions[dimensionKey]?.pricePerUnit?.USD;
          console.log(`  Price: $${price} per GB-hour`);
        }
      } else {
        console.log('✗ No results');
      }
    } catch (error) {
      console.error('✗ Error:', error instanceof Error ? error.message : error);
    }
  }
  console.log();

  console.log('='.repeat(80));
  console.log('Discovery complete');
  console.log('='.repeat(80));
}

discoverECSFargatePricing().catch(console.error);
