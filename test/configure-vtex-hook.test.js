'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { configureHook } = require('../scripts/configure-vtex-hook')

test('registra un hook FromWorkflow para el cambio de estado configurado', async () => {
  let path
  let options
  const env = {
    VTEX_ACCOUNT: 'qa-account',
    VTEX_APP_KEY: 'key',
    VTEX_APP_TOKEN: 'token',
    WEBHOOK_SECRET: 'secret',
    VTEX_WEBHOOK_STATUS: 'payment-approved',
    PUBLIC_BASE_URL: 'https://backend.example.com/',
  }
  const client = {
    request: async (receivedPath, receivedOptions) => {
      path = receivedPath
      options = receivedOptions
    },
  }

  const body = await configureHook(env, client)

  assert.equal(path, '/api/orders/hook/config')
  assert.equal(options.method, 'POST')
  assert.deepEqual(body.filter, {
    type: 'FromWorkflow',
    status: ['payment-approved'],
  })
  assert.equal(
    body.hook.url,
    'https://backend.example.com/webhooks/vtex/orders',
  )
  assert.equal(body.hook.headers['x-webhook-secret'], 'secret')
  assert.deepEqual(JSON.parse(options.body), body)
})
