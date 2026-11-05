'use strict'

const express = require('express')

function createReservationRouter({ controller }) {
  const router = express.Router()
  router.get('/status', controller.getStatus)
  return router
}

module.exports = { createReservationRouter }
