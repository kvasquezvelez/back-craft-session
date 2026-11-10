'use strict'

const { AppError } = require('../errors/app-error')
const { getReservationIdsFromOrder } = require('../utils/reservation-id')
const { findCraftService } = require('./craft-service.service')

const PAYMENT_APPROVED_STATUSES = new Set([
  'payment-approved',
  'window-to-cancel',
  'ready-for-handling',
  'authorize-fulfillment',
  'release-to-fulfillment',
  'handling',
  'invoice',
  'invoiced',
])

function isAcceptedOrderStatus(currentStatus, expectedStatus) {
  if (expectedStatus === 'payment-approved') {
    return PAYMENT_APPROVED_STATUSES.has(currentStatus)
  }
  return currentStatus === expectedStatus
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
        statusCode: 400,
        code: 'missing_order_id',
      })
    }

    const state = String(event?.State || event?.state || '').toLowerCase()
    if (!isAcceptedOrderStatus(
      state,
      this.config.webhookOrderStatus.toLowerCase(),
    )) {
      return { outcome: 'ignored-status', orderId, state }
    }

    return this.confirmReservationForOrder(orderId)
  }

  async confirmReservationForOrder(orderId) {
    const order = await this.vtexClient.getOrder(orderId)
    const orderStatus = String(order?.status || '').toLowerCase()
    const expectedStatus = this.config.webhookOrderStatus.toLowerCase()

    if (!isAcceptedOrderStatus(orderStatus, expectedStatus)) {
      return { outcome: 'ignored-status', orderId, state: orderStatus }
    }

    const service = findCraftService(order, this.config.service)
    if (!service.found) {
      return { outcome: 'ignored-without-service', orderId }
    }

    const reservationIds = getReservationIdsFromOrder(order, this.config.service)
    if (!reservationIds.length) {
      throw new AppError('La orden no contiene reservationGroupIds validos', {
        statusCode: 503,
        code: 'reservation_id_not_found_in_order',
      })
    }

    const masterData = this.config.masterData
    const reservationsById = await Promise.all(
      reservationIds.map(async (reservationId) => {
        const documents = await this.vtexClient.findMasterDataDocuments({
          entity: masterData.entity,
          field: masterData.reservationIdField,
          value: reservationId,
          fields: [
            'id',
            masterData.reservationIdField,
            masterData.statusField,
            masterData.orderIdField,
            masterData.confirmedAtField,
            masterData.quantityField,
            masterData.emailPrimaryField,
            masterData.emailSentField,
            masterData.emailSentAtField,
          ],
          size: 100,
        })

        if (!documents.length) {
          throw new AppError(
            `No se encontraron cupos para el reservationId ${reservationId}`,
            {
              statusCode: 503,
              code: 'reservation_not_found',
            },
          )
        }

        return { reservationId, documents }
      }),
    )

    const documents = [
      ...new Map(
        reservationsById
          .flatMap((reservation) => reservation.documents)
          .map((document) => [document.id, document]),
      ).values(),
    ]
    const pendingDocuments = documents.filter(
      (document) => document[masterData.statusField] !== masterData.confirmedValue,
    )

    if (pendingDocuments.length) {
      const confirmedAt = this.now().toISOString()
      const updates = reservationsById.flatMap(({ documents: groupDocuments }) => {
        const pendingGroupDocuments = groupDocuments.filter(
          (document) => document[masterData.statusField] !== masterData.confirmedValue,
        )
        if (!pendingGroupDocuments.length) return []

        const existingPrimary = groupDocuments.find(
          (document) => document[masterData.emailPrimaryField] === true,
        )
        const emailPrimary = existingPrimary || [...pendingGroupDocuments]
          .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0]

        return pendingGroupDocuments.map((document) => {
          const isEmailPrimary = document.id === emailPrimary.id
          const fields = {
            [masterData.statusField]: masterData.confirmedValue,
            [masterData.orderIdField]: orderId,
            [masterData.confirmedAtField]: confirmedAt,
            [masterData.quantityField]: groupDocuments.length,
            [masterData.emailPrimaryField]: isEmailPrimary,
          }

          if (isEmailPrimary && document[masterData.emailSentField] !== true) {
            fields[masterData.emailSentField] = true
            fields[masterData.emailSentAtField] = confirmedAt
          }

          return this.vtexClient.updateMasterDataDocument(
            masterData.entity,
            document.id,
            fields,
          )
        })
      })

      await Promise.all(updates)
    }

    return {
      outcome: pendingDocuments.length ? 'confirmed' : 'already-confirmed',
      orderId,
      reservationIds,
      serviceMatch: service.reason,
      confirmedQuantity: pendingDocuments.length,
      totalQuantity: documents.length,
    }
  }
}

module.exports = { OrderConfirmationService, isAcceptedOrderStatus }
