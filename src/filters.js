/**
 * Filtering module for Shopify product data.
 *
 * Each filter is a function that takes a product and returns boolean.
 * To add new filters, add functions to the filters object.
 */

export const filters = {
  isActive(product) {
    return product.status === 'ACTIVE';
  },

  hasImages(product) {
    return Array.isArray(product.images) && product.images.length > 0;
  },

  hasPrice(product) {
    return product.price !== undefined && product.price !== null && Number(product.price) > 0;
  },

  inCategory(category) {
    return (product) => product.category === category;
  },

  priceRange(min, max) {
    return (product) => {
      const price = Number(product.price);
      return price >= min && price <= max;
    };
  },
};

/**
 * Apply multiple filters to a list of products.
 * @param {object[]} products
 * @param {Function[]} filterFns - Array of filter functions
 * @returns {object[]}
 */
export function applyFilters(products, filterFns) {
  return products.filter((product) =>
    filterFns.every((fn) => fn(product))
  );
}
