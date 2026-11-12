'use strict'

const { AppError } = require('../errors/app-error')

const RESERVATION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,100}$/

function normalizeReservationId(value) {
  const reservationId = String(value || '').trim()
  return RESERVATION_ID_PATTERN.test(reservationId) ? reservationId : null
}

function getReservationIdsFromOrder(order, { customAppId, customField }) {
  const customApps = Array.isArray(order?.customData?.customApps)
    ? order.customData.customApps
    : []
  const customApp = customApps.find((app) => app?.id === customAppId)
  const values = String(customApp?.fields?.[customField] || '').split(',')
  return [...new Set(values.map(normalizeReservationId).filter(Boolean))]
}

function getReservationDocumentId(reservationId) {
  const value = String(reservationId).replace(/-/g, '').toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(value)) {
    throw new AppError('Debes enviar un reservationId valido', {
      statusCode: 400, code: 'invalid_reservation_id',
    })
  }
  return value.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}

module.exports = {
  RESERVATION_ID_PATTERN,
  getReservationDocumentId,
  getReservationIdsFromOrder,
  normalizeReservationId,
}
