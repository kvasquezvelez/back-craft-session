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
      size: 100,
    })

    if (!documents.length) {
      throw new AppError('No se encontro una reserva para el reservationId enviado', {
        statusCode: 404,
        code: 'reservation_not_found',
      })
    }
    const statuses = documents.map(
      (reservation) => reservation[masterData.statusField] ?? null,
    )
    const confirmed = statuses.every(
      (status) => status === masterData.confirmedValue,
    )
    const uniqueStatuses = [...new Set(statuses)]
    const status = uniqueStatuses.length === 1 ? uniqueStatuses[0] : 'parcial'

    return {
      reservationId,
      status,
      confirmed,
      quantity: documents.length,
    }
  }
}

module.exports = { ReservationQueryService }
