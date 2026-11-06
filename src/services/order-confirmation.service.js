'use strict'

const { AppError } = require('../errors/app-error')
const { getReservationIdFromOrder } = require('../utils/reservation-id')
const { findCraftService } = require('./craft-service.service')

class OrderConfirmationService {
  constructor({ config, vtexClient }) {
    this.config = config
    this.vtexClient = vtexClient
  }

  async processWebhook(event) {
    const orderId = event?.OrderId || event?.orderId
    if (!orderId) {
      throw new AppError('El evento no contiene OrderId', {
        statusCode: 400,
        code: 'missing_order_id',
      })
    }

    const state = String(event?.State || event?.state || '').toLowerCase()
    if (state !== this.config.webhookOrderStatus.toLowerCase()) {
      return { outcome: 'ignored-status', orderId, state }
    }

    return this.confirmReservationForOrder(orderId)
  }

  async confirmReservationForOrder(orderId) {
    const order = await this.vtexClient.getOrder(orderId)
    const orderStatus = String(order?.status || '').toLowerCase()
    const expectedStatus = this.config.webhookOrderStatus.toLowerCase()

    if (orderStatus !== expectedStatus) {
      return { outcome: 'ignored-status', orderId, state: orderStatus }
    }

    const service = findCraftService(order, this.config.service)
    if (!service.found) {
      return { outcome: 'ignored-without-service', orderId }
    }

    const reservationId = getReservationIdFromOrder(order, this.config.service)
    if (!reservationId) {
      throw new AppError('La orden no contiene un reservationId valido', {
        statusCode: 503,
        code: 'reservation_id_not_found_in_order',
      })
    }

    const masterData = this.config.masterData
    const documents = await this.vtexClient.findMasterDataDocuments({
      entity: masterData.entity,
      field: masterData.reservationIdField,
      value: reservationId,
      fields: ['id', masterData.reservationIdField, masterData.statusField],
      size: masterData.requireUniqueMatch ? 2 : 1,
    })

    if (!documents.length) {
      throw new AppError('No se encontro la reserva indicada por la orden', {
        statusCode: 503,
        code: 'reservation_not_found',
      })
    }
    if (masterData.requireUniqueMatch && documents.length > 1) {
      throw new AppError('Existe mas de una reserva con el mismo reservationId', {
        statusCode: 503,
        code: 'multiple_reservations_found',
      })
    }

    const reservation = documents[0]
    if (reservation[masterData.statusField] === masterData.confirmedValue) {
      return {
        outcome: 'already-confirmed',
        orderId,
        documentId: reservation.id,
        reservationId,
        serviceMatch: service.reason,
      }
    }

    await this.vtexClient.updateMasterDataDocument(masterData.entity, reservation.id, {
      [masterData.statusField]: masterData.confirmedValue,
    })

    return {
      outcome: 'confirmed',
      orderId,
      documentId: reservation.id,
      reservationId,
      serviceMatch: service.reason,
    }
  }
}

module.exports = { OrderConfirmationService }
