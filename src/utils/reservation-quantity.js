'use strict'

const { AppError } = require('../errors/app-error')

function getReservationQuantity(document, quantityField = 'quantity') {
  const quantity = document[quantityField]
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 15) {
    throw new AppError('La cantidad de cupos de la reserva no es valida', {
      statusCode: 409,
      code: 'invalid_reservation_quantity',
    })
  }
  return quantity
}

module.exports = { getReservationQuantity }
