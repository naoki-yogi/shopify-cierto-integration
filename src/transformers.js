/**
 * Data transformation module.
 * Converts Shopify product objects to CIERTO asset format.
 */

/**
 * Transform a Shopify product to CIERTO asset format.
 * @param {object} product - Shopify product
 * @returns {object} - CIERTO asset
 */
export function toCiertoAsset(product) {
  return {
    assetId: `cierto_${product.productId}`,
    name: product.name,
    category: product.category || 'Uncategorized',
    sku: product.sku,
    price: Number(product.price),
    currency: product.currency || 'JPY',
    mediaUrls: product.images || [],
    sourceStatus: product.status,
    syncStatus: 'SYNCED',
    lastSyncedAt: new Date().toISOString(),
    sourceUpdatedAt: product.updatedAt || null,
    metadata: {
      source: 'shopify',
      originalProductId: String(product.productId),
      importedAt: new Date().toISOString(),
    },
  };
}

/**
 * Transform a CIERTO asset back to Shopify product format.
 * @param {object} asset - CIERTO asset
 * @returns {object} - Shopify product update payload
 */
export function toShopifyProduct(asset) {
  return {
    id: asset.metadata?.originalProductId,
    title: asset.name,
    variants: [{
      sku: asset.sku,
      price: String(asset.price),
    }],
    images: asset.mediaUrls.map((url) => ({ src: url })),
    status: asset.sourceStatus?.toLowerCase() || 'draft',
  };
}
