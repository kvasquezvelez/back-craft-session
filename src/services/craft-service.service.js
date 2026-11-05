'use strict'

function flattenItems(items) {
  const result = []
  const visit = (item) => {
    if (!item || typeof item !== 'object') return
    result.push(item)
    for (const child of item.bundleItems || []) visit(child)
    for (const child of item.assemblies || []) visit(child)
  }
  for (const item of items || []) visit(item)
  return result
}

function findCraftService(order, config) {
  const skuIds = new Set(config.skuIds.map(String))

  for (const item of flattenItems(order?.items)) {
    if (skuIds.has(String(item.id))) {
      return { found: true, reason: 'sku', item }
    }
  }

  return { found: false }
}

module.exports = { findCraftService, flattenItems }
