'use strict'

const express = require('express')

function createHealthRouter() {
  const router = express.Router()
  router.get('/', (_request, response) => response.status(200).json({ status: 'ok' }))
  return router
}

module.exports = { createHealthRouter }
