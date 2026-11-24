/**
 * Shopify → CIERTO Integration Demo
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { process } from './pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load sample data
const products = JSON.parse(
  readFileSync(join(__dirname, '../data/sample-products.json'), 'utf8')
);

console.log('════════════════════════════════════════════════════════════════');
console.log('  Shopify → CIERTO Data Integration Pipeline');
console.log('════════════════════════════════════════════════════════════════\n');

// Process the data
const { data, errors, stats } = process(products);

// Display results
console.log('\n┌─────────────────────────────────────────────────────────────────');
console.log('│ Processing Statistics');
console.log('├─────────────────────────────────────────────────────────────────');
console.log(`│  Input products:    ${stats.input}`);
console.log(`│  Invalid (skipped): ${stats.invalid}`);
console.log(`│  Filtered out:      ${stats.filtered}`);
console.log(`│  Output assets:     ${stats.output}`);
console.log('└─────────────────────────────────────────────────────────────────\n');

if (errors.length > 0) {
  console.log('┌─────────────────────────────────────────────────────────────────');
  console.log('│ Validation Errors');
  console.log('├─────────────────────────────────────────────────────────────────');
  for (const err of errors) {
    console.log(`│  [${err.productId}]`);
    for (const e of err.errors) {
      console.log(`│    - ${e}`);
    }
  }
  console.log('└─────────────────────────────────────────────────────────────────\n');
}

console.log('┌─────────────────────────────────────────────────────────────────');
console.log('│ Converted Assets (grouped by category, sorted by price desc)');
console.log('├─────────────────────────────────────────────────────────────────');

for (const [category, assets] of data) {
  console.log(`│`);
  console.log(`│ ▸ ${category} (${assets.length} items)`);
  console.log(`│   ${'─'.repeat(55)}`);

  for (const asset of assets) {
    const price = `¥${asset.price.toLocaleString()}`.padStart(10);
    console.log(`│   ${asset.sku.padEnd(14)} ${price}  ${asset.name}`);
  }
}

console.log('└─────────────────────────────────────────────────────────────────');
