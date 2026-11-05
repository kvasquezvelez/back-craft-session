'use strict'

const crypto = require('node:crypto')

function secureEqual(received, expected) {
  if (!received || !expected) return false
  const receivedBuffer = Buffer.from(String(received))
  const expectedBuffer = Buffer.from(String(expected))
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

function createWebhookAuth({ secret, logger }) {
  return function webhookAuth(request, response, next) {
    if (!secureEqual(request.get('x-webhook-secret'), secret)) {
      logger.warn('Solicitud no autorizada', { requestId: request.requestId })
      return response.status(401).json({ error: 'unauthorized' })
    }
    return next()
  }
}

module.exports = { createWebhookAuth, secureEqual }
