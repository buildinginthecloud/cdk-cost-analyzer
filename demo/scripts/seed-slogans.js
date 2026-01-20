#!/usr/bin/env node

/**
 * Script to seed the DynamoDB table with sample slogans
 * Usage: node scripts/seed-slogans.js <table-name>
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const slogans = [
  { id: '1', text: 'Just Do It', brand: 'Nike' },
  { id: '2', text: "I'm Lovin' It", brand: 'McDonald\'s' },
  { id: '3', text: 'Think Different', brand: 'Apple' },
  { id: '4', text: 'Because You\'re Worth It', brand: 'L\'Oréal' },
  { id: '5', text: 'The Ultimate Driving Machine', brand: 'BMW' },
  { id: '6', text: 'Finger Lickin\' Good', brand: 'KFC' },
  { id: '7', text: 'Have a Break, Have a KitKat', brand: 'KitKat' },
  { id: '8', text: 'The Happiest Place on Earth', brand: 'Disneyland' },
  { id: '9', text: 'Melts in Your Mouth, Not in Your Hands', brand: 'M&M\'s' },
  { id: '10', text: 'Red Bull Gives You Wings', brand: 'Red Bull' },
];

async function seedTable(tableName) {
  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);

  console.log(`Seeding table: ${tableName}`);

  for (const slogan of slogans) {
    try {
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: slogan,
      }));
      console.log(`✓ Added: ${slogan.text}`);
    } catch (error) {
      console.error(`✗ Failed to add ${slogan.text}:`, error.message);
    }
  }

  console.log('\nSeeding complete!');
}

const tableName = process.argv[2];

if (!tableName) {
  console.error('Usage: node scripts/seed-slogans.js <table-name>');
  process.exit(1);
}

seedTable(tableName).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
