// test-api.js
const { analyzeCosts } = require('./dist/api');
const fs = require('fs');

async function test() {
  const baseTemplate = fs.readFileSync('base.json', 'utf-8');
  const targetTemplate = fs.readFileSync('target.json', 'utf-8');
  
  const result = await analyzeCosts({
    baseTemplate,
    targetTemplate,
    region: 'eu-central-1'
  });
  
  console.log('Total Delta:', result.totalDelta);
  console.log('Currency:', result.currency);
  console.log('Added Resources:', result.addedResources.length);
  console.log('Removed Resources:', result.removedResources.length);
  console.log('Modified Resources:', result.modifiedResources.length);
  console.log('\nAdded Resources Details:');
  result.addedResources.forEach(r => {
    console.log(`  - ${r.logicalId} (${r.type}): ${r.monthlyCost.currency} ${r.monthlyCost.amount.toFixed(2)} [${r.monthlyCost.confidence}]`);
  });
}

test().catch(console.error);
