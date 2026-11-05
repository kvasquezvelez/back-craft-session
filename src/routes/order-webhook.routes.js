'use strict'

const express = require('express')

function createOrderWebhookRouter({ controller, auth }) {
  const router = express.Router()
  router.post('/', auth, controller.handle)
  return router
}

module.exports = { createOrderWebhookRouter }
