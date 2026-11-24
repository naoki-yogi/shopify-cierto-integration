/**
 * Validation module for Shopify product data.
 *
 * Each validator is a function that takes a product and returns
 * { valid: true } or { valid: false, error: string }.
 *
 * To add new validation rules, simply add functions to the validators object.
 */

export const validators = {
  productId(product) {
    if (!product.productId || String(product.productId).trim() === '') {
      return { valid: false, error: 'productId is required' };
    }
    return { valid: true };
  },

  name(product) {
    if (!product.name || String(product.name).trim() === '') {
      return { valid: false, error: 'name is required' };
    }
    return { valid: true };
  },

  sku(product) {
    if (!product.sku || String(product.sku).trim() === '') {
      return { valid: false, error: 'sku is required' };
    }
    return { valid: true };
  },

  price(product) {
    if (product.price === undefined || product.price === null) {
      return { valid: false, error: 'price is required' };
    }
    const num = Number(product.price);
    if (Number.isNaN(num)) {
      return { valid: false, error: `price must be a number, got "${product.price}"` };
    }
    if (num < 0) {
      return { valid: false, error: 'price cannot be negative' };
    }
    return { valid: true };
  },

  status(product) {
    const allowed = ['ACTIVE', 'DRAFT', 'ARCHIVED'];
    if (product.status && !allowed.includes(product.status)) {
      return { valid: false, error: `status must be one of: ${allowed.join(', ')}` };
    }
    return { valid: true };
  },

  updatedAt(product) {
    if (product.updatedAt && Number.isNaN(Date.parse(product.updatedAt))) {
      return { valid: false, error: 'updatedAt must be a valid ISO 8601 date' };
    }
    return { valid: true };
  },

  images(product) {
    if (product.images && !Array.isArray(product.images)) {
      return { valid: false, error: 'images must be an array' };
    }
    return { valid: true };
  },
};

/**
 * Validate a single product against all or specified validators.
 * @param {object} product - The product to validate
 * @param {string[]} [rules] - Specific rules to run (default: all)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(product, rules = Object.keys(validators)) {
  const errors = [];

  for (const rule of rules) {
    if (validators[rule]) {
      const result = validators[rule](product);
      if (!result.valid) {
        errors.push(result.error);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate multiple products, separating valid from invalid.
 * @param {object[]} products
 * @param {string[]} [rules]
 * @returns {{ valid: object[], invalid: { product: object, errors: string[] }[] }}
 */
export function validateBatch(products, rules) {
  const valid = [];
  const invalid = [];

  for (const product of products) {
    const result = validate(product, rules);
    if (result.valid) {
      valid.push(product);
    } else {
      invalid.push({ product, errors: result.errors });
    }
  }

  return { valid, invalid };
}
