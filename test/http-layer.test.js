'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createOrderWebhookController } = require('../src/controllers/order-webhook.controller')
const { createWebhookAuth } = require('../src/middlewares/webhook-auth.middleware')

const silentLogger = { info() {}, warn() {}, error() {} }

function createResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('el controlador responde al ping requerido por VTEX', async () => {
  const controller = createOrderWebhookController({
    orderConfirmationService: {},
    logger: silentLogger,
  })
  const response = createResponse()

  await controller.handle({ body: { hookConfig: 'ping' }, requestId: 'request-1' }, response)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { ok: true, type: 'ping' })
})

test('el middleware rechaza solicitudes sin el secreto', () => {
  const auth = createWebhookAuth({ secret: 'secret', logger: silentLogger })
  const response = createResponse()
  let continued = false
  const request = { requestId: 'request-1', get: () => undefined }

  auth(request, response, () => { continued = true })

  assert.equal(response.statusCode, 401)
  assert.equal(response.body.error, 'unauthorized')
  assert.equal(continued, false)
})

test('el middleware permite solicitudes con el secreto correcto', () => {
  const auth = createWebhookAuth({ secret: 'secret', logger: silentLogger })
  const response = createResponse()
  let continued = false
  const request = { requestId: 'request-1', get: () => 'secret' }

  auth(request, response, () => { continued = true })

  assert.equal(continued, true)
})
