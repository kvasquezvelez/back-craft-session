'use strict'

class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'internal_error', details } = {}) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true
  }
}

module.exports = { AppError }
