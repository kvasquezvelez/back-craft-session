'use strict'

const crypto = require('node:crypto')

function requestContext(request, response, next) {
  request.requestId = request.get('x-request-id') || crypto.randomUUID()
  response.set('x-request-id', request.requestId)
  next()
}

module.exports = { requestContext }
