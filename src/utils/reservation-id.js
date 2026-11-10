'use strict'

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

function getReservationIdFromOrder(order, config) {
  return getReservationIdsFromOrder(order, config)[0] || null
}

module.exports = {
  RESERVATION_ID_PATTERN,
  getReservationIdFromOrder,
  getReservationIdsFromOrder,
  normalizeReservationId,
}
