'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { findCraftService } = require('../src/services/craft-service.service')

const baseConfig = {
  skuIds: ['663375276'],
}

test('detecta el servicio por SKU dentro de bundleItems', () => {
  const order = {
    items: [{ id: 'PRODUCT', bundleItems: [{ id: '663375276', name: 'Servicio' }] }],
  }

  const result = findCraftService(order, baseConfig)
  assert.equal(result.found, true)
  assert.equal(result.reason, 'sku')
})

test('no detecta el servicio por nombre o attachment si el SKU no coincide', () => {
  const order = {
    items: [{
      id: 'OTHER',
      name: 'Craft Session',
      attachments: [{ name: 'Craft Session', content: {} }],
    }],
  }

  const result = findCraftService(order, baseConfig)
  assert.deepEqual(result, { found: false })
})

test('no confunde una orden sin el servicio', () => {
  const order = { items: [{ id: 'OTHER', name: 'Producto normal' }] }
  assert.deepEqual(findCraftService(order, baseConfig), { found: false })
})
