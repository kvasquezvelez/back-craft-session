'use strict'

const PENDING_RESERVATION_TTL_MS = 5 * 60 * 60 * 1000

function isPendingReservationExpired(document, statusField, now = new Date()) {
  const createdAt = Date.parse(document.createdIn)
  return document[statusField] === 'pendiente'
    && Number.isFinite(createdAt)
    && now.getTime() - createdAt >= PENDING_RESERVATION_TTL_MS
}

module.exports = { PENDING_RESERVATION_TTL_MS, isPendingReservationExpired }
