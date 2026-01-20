#!/usr/bin/env ts-node

/**
 * Discovery script for NAT Gateway pricing in AWS Pricing API
 * 
 * This script helps discover the correct usageType format for NAT Gateway
 * in different regions by querying the AWS Pricing API with various filter combinations.
 * 
 * Usage:
 *   ts-node tools/discover-nat-gateway-pricing.ts [region]
 * 
 * Example:
 *   ts-node tools/discover-nat-gateway-pricing.ts eu-central-1
 */

import { PricingClient as AWSPricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';

interface PricingFilter {
  field: string;
  value: string;
}

async function discoverNatGatewayPricing(region: string): Promise<void> {
  console.log(`\n🔍 Discovering NAT Gateway pricing for region: ${region}\n`);

  const client = new AWSPricingClient({ region: 'us-east-1' });

  // Try different region prefix formats
  const regionPrefixes = [
    'EUC1',       // Current format in code
    'EUC1-',      // With hyphen
    'EU-Central-1', // Full region name
    'eu-central-1', // Lowercase
    '',           // No prefix
  ];

  // Try different usage type formats
  const usageTypeFormats = [
    (prefix: string) => `${prefix}NatGateway-Hours`,
    (prefix: string) => `${prefix}NatGateway-Bytes`,
    (prefix: string) => `${prefix}NGW-Hours`,
    (prefix: string) => `${prefix}NGW-Bytes`,
  ];

  console.log('Testing different filter combinations...\n');

  for (const prefix of regionPrefixes) {
    for (const formatFn of usageTypeFormats) {
      const usageType = formatFn(prefix);
      
      try {
        const filters = [
          { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'NAT Gateway' },
          { Type: 'TERM_MATCH', Field: 'usagetype', Value: usageType },
        ];

        console.log(`Trying prefix "${prefix}" with usageType: ${usageType}`);
        console.log(`  Filters:`, JSON.stringify(filters, null, 2));

        const command = new GetProductsCommand({
          ServiceCode: 'AmazonEC2',
          Filters: filters,
          MaxResults: 1,
        });

        const response = await client.send(command);

        if (response.PriceList && response.PriceList.length > 0) {
          const priceItem = JSON.parse(response.PriceList[0]);
          const product = priceItem?.product;
          const onDemand = priceItem?.terms?.OnDemand;

          console.log(`  ✅ SUCCESS! Found pricing data`);
          console.log(`  Region: ${product?.attributes?.location || 'N/A'}`);
          console.log(`  UsageType: ${product?.attributes?.usagetype || 'N/A'}`);
          console.log(`  Operation: ${product?.attributes?.operation || 'N/A'}`);
          console.log(`  Description: ${product?.attributes?.description || 'N/A'}`);

          if (onDemand) {
            const termKey = Object.keys(onDemand)[0];
            const priceDimensions = onDemand[termKey]?.priceDimensions;
            if (priceDimensions) {
              const dimensionKey = Object.keys(priceDimensions)[0];
              const dimension = priceDimensions[dimensionKey];
              const price = dimension?.pricePerUnit?.USD;
              console.log(`  Price: $${price}/${dimension?.unit || 'unit'}`);
              console.log(`  Description: ${dimension?.description || 'N/A'}`);
            }
          }
          console.log('\n');
        } else {
          console.log(`  ❌ No results\n`);
        }
      } catch (error) {
        console.log(`  ⚠️  Error: ${error instanceof Error ? error.message : String(error)}\n`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Also try to discover what products are available without usagetype filter
  console.log('\n📋 Listing all NAT Gateway products (no usageType filter)...\n');
  
  try {
    const command = new GetProductsCommand({
      ServiceCode: 'AmazonEC2',
      Filters: [
        { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'NAT Gateway' },
      ],
      MaxResults: 100,
    });

    const response = await client.send(command);

    if (response.PriceList && response.PriceList.length > 0) {
      console.log(`Found ${response.PriceList.length} NAT Gateway products\n`);

      // Group by location
      const productsByLocation = new Map<string, any[]>();

      for (const priceListItem of response.PriceList) {
        const priceItem = JSON.parse(priceListItem);
        const product = priceItem?.product;
        const location = product?.attributes?.location || 'Unknown';
        const usageType = product?.attributes?.usagetype || 'Unknown';

        if (!productsByLocation.has(location)) {
          productsByLocation.set(location, []);
        }
        productsByLocation.get(location)!.push({
          usageType,
          description: product?.attributes?.description || 'N/A',
        });
      }

      // Find eu-central-1 products
      const euCentralLocation = Array.from(productsByLocation.keys()).find(
        loc => loc.toLowerCase().includes('frankfurt') || loc.toLowerCase().includes('eu-central')
      );

      if (euCentralLocation) {
        console.log(`📍 Found NAT Gateway products for ${euCentralLocation}:`);
        const products = productsByLocation.get(euCentralLocation)!;
        products.forEach(p => {
          console.log(`  - UsageType: ${p.usageType}`);
          console.log(`    Description: ${p.description}`);
        });
      } else {
        console.log('⚠️  No NAT Gateway products found for eu-central-1/Frankfurt');
      }

      console.log('\n📊 All locations with NAT Gateway products:');
      for (const [location, products] of productsByLocation) {
        console.log(`  - ${location} (${products.length} products)`);
      }
    } else {
      console.log('❌ No NAT Gateway products found');
    }
  } catch (error) {
    console.log(`⚠️  Error listing products: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main execution
const region = process.argv[2] || 'eu-central-1';
discoverNatGatewayPricing(region)
  .then(() => {
    console.log('\n✨ Discovery complete!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Discovery failed:', error);
    process.exit(1);
  });
