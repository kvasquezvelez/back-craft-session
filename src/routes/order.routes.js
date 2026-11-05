'use strict'

const express = require('express')

function createOrderRouter({ controller, auth }) {
  const router = express.Router()
  router.use(auth)
  router.get('/:orderId', controller.getById)
  router.post('/:orderId/confirm-reservation', controller.confirmReservation)
  return router
}

module.exports = { createOrderRouter }
