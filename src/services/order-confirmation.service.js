'use strict'

const { AppError } = require('../errors/app-error')
const { getReservationIdsFromOrder, getReservationDocumentId } = require('../utils/reservation-id')
const { findCraftService, flattenItems } = require('./craft-service.service')
const { isPendingReservationExpired } = require('../utils/reservation-expiration')
const { getReservationQuantity } = require('../utils/reservation-quantity')

const PAYMENT_APPROVED_STATUSES = new Set([
  'payment-approved', 'window-to-cancel', 'ready-for-handling',
  'authorize-fulfillment', 'release-to-fulfillment', 'handling', 'invoice', 'invoiced',
])

function isAcceptedOrderStatus(currentStatus, expectedStatus) {
  return expectedStatus === 'payment-approved'
    ? PAYMENT_APPROVED_STATUSES.has(currentStatus)
    : currentStatus === expectedStatus
}

class OrderConfirmationService {
  constructor({ config, vtexClient, now = () => new Date() }) {
    this.config = config
    this.vtexClient = vtexClient
    this.now = now
  }

  async processWebhook(event) {
    const orderId = event?.OrderId || event?.orderId
    if (!orderId) {
      throw new AppError('El evento no contiene OrderId', {
        statusCode: 400, code: 'missing_order_id',
      })
    }
    const state = String(event?.State || event?.state || '').toLowerCase()
    if (!isAcceptedOrderStatus(state, this.config.webhookOrderStatus.toLowerCase())) {
      return { outcome: 'ignored-status', orderId, state }
    }
    return this.confirmReservationForOrder(orderId)
  }

  async confirmReservationForOrder(orderId) {
    const order = await this.vtexClient.getOrder(orderId)
    const orderStatus = String(order?.status || '').toLowerCase()
    if (!isAcceptedOrderStatus(orderStatus, this.config.webhookOrderStatus.toLowerCase())) {
      return { outcome: 'ignored-status', orderId, state: orderStatus }
    }
    const service = findCraftService(order, this.config.service)
    if (!service.found) return { outcome: 'ignored-without-service', orderId }

    const reservationIds = getReservationIdsFromOrder(order, this.config.service)
    if (!reservationIds.length) {
      throw new AppError('La orden no contiene reservationGroupIds validos', {
        statusCode: 503, code: 'reservation_id_not_found_in_order',
      })
    }

    const md = this.config.masterData
    const reservations = await Promise.all(reservationIds.map(async (reservationId) => {
      try {
        // One deterministic SC document per reservation: no search-index delay
        // and no per-seat copies. quantity is the only seat count.
        const document = await this.vtexClient.getMasterDataDocument({
          entity: md.entity,
          id: getReservationDocumentId(reservationId),
          fields: ['id', 'createdIn', md.reservationIdField, md.statusField,
            md.orderIdField, md.confirmedAtField, md.quantityField,
            md.emailPrimaryField, md.emailSentField, md.emailSentAtField],
        })
        if (document[md.reservationIdField] !== reservationId) {
          throw new AppError('El identificador de SC no coincide con la reserva de la orden', {
            statusCode: 409, code: 'reservation_id_mismatch',
          })
        }
        return { reservationId, document }
      } catch (error) {
        if (error.status === 404) return { reservationId, document: null }
        throw error
      }
    }))

    const active = reservations.filter(({ document }) =>
      document && document[md.statusField] !== 'cancelado')
    const ignoredReservationIds = reservations
      .filter((reservation) => !active.includes(reservation))
      .map(({ reservationId }) => reservationId)
    if (!active.length) {
      throw new AppError('No se encontraron reservas vigentes para la orden', {
        statusCode: 503, code: 'reservation_not_found',
      })
    }

    const quantityOf = ({ document }) => getReservationQuantity(document, md.quantityField)
    const totalQuantity = active.reduce((total, reservation) => total + quantityOf(reservation), 0)
    const skuIds = new Set(this.config.service.skuIds.map(String))
    const serviceItems = flattenItems(order.items).filter((item) => skuIds.has(String(item.id)))
    const paidQuantity = serviceItems.reduce((total, item) => total + item.quantity, 0)
    if (serviceItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)
      || totalQuantity !== paidQuantity) {
      throw new AppError(
        `La orden tiene ${paidQuantity} cupos pagados y sus reservas suman ${totalQuantity}`,
        { statusCode: 409, code: 'reservation_quantity_mismatch' },
      )
    }

    for (const { document } of active) {
      if (!['pendiente', md.confirmedValue].includes(document[md.statusField])) {
        throw new AppError('La reserva tiene un estado no valido', {
          statusCode: 409, code: 'reservation_status_mismatch',
        })
      }
      if (isPendingReservationExpired(document, md.statusField, this.now())) {
        throw new AppError('Una reserva pendiente supero las cinco horas de espera', {
          statusCode: 409, code: 'reservation_expired',
        })
      }
      if (document[md.orderIdField] && document[md.orderIdField] !== orderId) {
        throw new AppError('Una reserva ya pertenece a otra orden', {
          statusCode: 409, code: 'reservation_order_mismatch',
        })
      }
    }

    const pending = active.filter(({ document }) => document[md.statusField] !== md.confirmedValue)
    const confirmedQuantity = pending.reduce((total, reservation) => total + quantityOf(reservation), 0)
    const confirmedAt = this.now().toISOString()
    await Promise.all(pending.map(({ document }) => {
      const fields = {
        [md.statusField]: md.confirmedValue,
        [md.orderIdField]: orderId,
        [md.confirmedAtField]: confirmedAt,
        [md.emailPrimaryField]: true,
      }
      if (document[md.emailSentField] !== true) {
        fields[md.emailSentField] = true
        fields[md.emailSentAtField] = confirmedAt
      }
      return this.vtexClient.updateMasterDataDocument(md.entity, document.id, fields)
    }))

    return {
      outcome: pending.length ? 'confirmed' : 'already-confirmed',
      orderId,
      reservationIds: active.map(({ reservationId }) => reservationId),
      ignoredReservationIds,
      serviceMatch: service.reason,
      confirmedQuantity,
      totalQuantity,
    }
  }
}

module.exports = { OrderConfirmationService, isAcceptedOrderStatus }
