'use strict'

const RESERVATION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,100}$/

function normalizeReservationId(value) {
  const reservationId = String(value || '').trim()
  return RESERVATION_ID_PATTERN.test(reservationId) ? reservationId : null
}

function getReservationIdFromOrder(order, { customAppId, customField }) {
  const customApps = Array.isArray(order?.customData?.customApps)
    ? order.customData.customApps
    : []
  const customApp = customApps.find((app) => app?.id === customAppId)
  return normalizeReservationId(customApp?.fields?.[customField])
}

module.exports = {
  RESERVATION_ID_PATTERN,
  getReservationIdFromOrder,
  normalizeReservationId,
}
