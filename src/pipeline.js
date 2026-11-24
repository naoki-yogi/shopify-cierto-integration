/**
 * Main processing pipeline for Shopify → CIERTO data transformation.
 */

import { validateBatch } from './validators.js';
import { applyFilters, filters } from './filters.js';
import { toCiertoAsset } from './transformers.js';
import { groupAndSort, comparators } from './sorters.js';

/**
 * @typedef {object} PipelineResult
 * @property {Map<string, object[]>} data - Assets grouped by category
 * @property {object[]} errors - Validation errors
 * @property {object} stats - Processing statistics
 */

/**
 * Process Shopify products into CIERTO assets.
 *
 * Pipeline steps:
 * 1. Validate - Check required fields and formats
 * 2. Filter - Keep only ACTIVE products (configurable)
 * 3. Transform - Convert to CIERTO asset format
 * 4. Group & Sort - Organize by category, sort by price
 *
 * @param {object[]} products - Raw Shopify product data
 * @param {object} [options] - Pipeline options
 * @param {string[]} [options.validationRules] - Validation rules to apply
 * @param {Function[]} [options.filters] - Filter functions to apply
 * @param {Function} [options.transform] - Custom transform function
 * @param {string} [options.groupBy] - Field to group by (default: 'category')
 * @param {Function} [options.sortBy] - Sort comparator (default: byPriceDesc)
 * @returns {PipelineResult}
 */
export function process(products, options = {}) {
  const {
    validationRules,
    filters: filterFns = [filters.isActive],
    transform = toCiertoAsset,
    groupBy = 'category',
    sortBy = comparators.byPriceDesc,
  } = options;

  const errors = [];

  // Step 1: Validate
  const { valid: validProducts, invalid } = validateBatch(products, validationRules);

  for (const { product, errors: errs } of invalid) {
    const id = product.productId || product.sku || 'unknown';
    errors.push({
      productId: id,
      errors: errs,
      skipped: true,
    });
    console.error(`[SKIP] ${id}: ${errs.join(', ')}`);
  }

  // Step 2: Filter
  const filtered = applyFilters(validProducts, filterFns);

  // Step 3: Transform
  const assets = filtered.map(transform);

  // Step 4: Group & Sort
  const grouped = groupAndSort(assets, groupBy, sortBy);

  // Build stats
  const stats = {
    input: products.length,
    invalid: invalid.length,
    filtered: validProducts.length - filtered.length,
    output: assets.length,
    categories: Object.fromEntries(
      [...grouped.entries()].map(([k, v]) => [k, v.length])
    ),
  };

  return { data: grouped, errors, stats };
}
