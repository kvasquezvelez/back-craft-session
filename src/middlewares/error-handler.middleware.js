'use strict'

const { AppError } = require('../errors/app-error')

function notFound(request, response) {
  response.status(404).json({ error: 'not_found' })
}

function createErrorHandler({ logger, nodeEnv }) {
  return function errorHandler(error, request, response, _next) {
    if (response.headersSent) return _next(error)

    const invalidJson = error instanceof SyntaxError && error.status === 400 && 'body' in error
    const payloadTooLarge = error.type === 'entity.too.large'
    const statusCode = invalidJson
      ? 400
      : payloadTooLarge
        ? 413
        : error instanceof AppError
          ? error.statusCode
          : 503
    const code = invalidJson
      ? 'invalid_json'
      : payloadTooLarge
        ? 'payload_too_large'
        : error instanceof AppError
          ? error.code
          : 'vtex_processing_failed'

    logger.error('Fallo procesando la solicitud', {
      requestId: request.requestId,
      error: error.message,
      status: error.status,
      code,
    })

    const body = {
      ok: false,
      error: code,
      message: statusCode < 500 || error instanceof AppError
        ? error.message
        : 'No fue posible procesar la solicitud',
    }
    if (nodeEnv !== 'production' && error.details) body.details = error.details

    return response.status(statusCode).json(body)
  }
}

module.exports = { createErrorHandler, notFound }
