'use strict'

const { AppError } = require('../errors/app-error')
const { normalizeReservationId, getReservationDocumentId } = require('../utils/reservation-id')
const { getReservationQuantity } = require('../utils/reservation-quantity')

class ReservationQueryService {
  constructor({ config, vtexClient }) {
    this.config = config
    this.vtexClient = vtexClient
  }

  async getStatusByReservationId(rawReservationId) {
    const reservationId = normalizeReservationId(rawReservationId)
    if (!reservationId) {
      throw new AppError('Debes enviar un reservationId valido', {
        statusCode: 400, code: 'invalid_reservation_id',
      })
    }
    const md = this.config.masterData
    let document
    try {
      document = await this.vtexClient.getMasterDataDocument({
        entity: md.entity,
        id: getReservationDocumentId(reservationId),
        fields: ['id', md.reservationIdField, md.statusField, md.quantityField || 'quantity'],
      })
    } catch (error) {
      if (error.status !== 404) throw error
      throw new AppError('No se encontro una reserva para el reservationId enviado', {
        statusCode: 404, code: 'reservation_not_found',
      })
    }
    if (document[md.reservationIdField] !== reservationId) {
      throw new AppError('El documento SC no corresponde al reservationId enviado', {
        statusCode: 409, code: 'reservation_id_mismatch',
      })
    }
    const status = document[md.statusField] ?? null
    return {
      reservationId,
      status,
      confirmed: status === md.confirmedValue,
      quantity: getReservationQuantity(document, md.quantityField),
    }
  }
}

module.exports = { ReservationQueryService }
