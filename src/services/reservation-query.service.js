'use strict'

const { AppError } = require('../errors/app-error')
const { normalizeReservationId } = require('../utils/reservation-id')

class ReservationQueryService {
  constructor({ config, vtexClient }) {
    this.config = config
    this.vtexClient = vtexClient
  }

  async getStatusByReservationId(rawReservationId) {
    const reservationId = normalizeReservationId(rawReservationId)
    if (!reservationId) {
      throw new AppError('Debes enviar un reservationId valido', {
        statusCode: 400,
        code: 'invalid_reservation_id',
      })
    }

    const masterData = this.config.masterData
    const documents = await this.vtexClient.findMasterDataDocuments({
      entity: masterData.entity,
      field: masterData.reservationIdField,
      value: reservationId,
      fields: ['id', masterData.reservationIdField, masterData.statusField],
      size: 2,
    })

    if (!documents.length) {
      throw new AppError('No se encontro una reserva para el reservationId enviado', {
        statusCode: 404,
        code: 'reservation_not_found',
      })
    }
    if (documents.length > 1) {
      throw new AppError('Existe mas de una reserva para el reservationId enviado', {
        statusCode: 409,
        code: 'multiple_reservations_found',
      })
    }

    const reservation = documents[0]
    const status = reservation[masterData.statusField] ?? null

    return {
      reservationId,
      status,
      confirmed: status === masterData.confirmedValue,
    }
  }
}

module.exports = { ReservationQueryService }
