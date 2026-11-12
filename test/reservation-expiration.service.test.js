'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { ReservationExpirationService } = require('../src/services/reservation-expiration.service')

const now = () => new Date('2026-11-11T17:00:00Z')
const config = { masterData: { entity: 'SC', statusField: 'statusreserva' } }

test('cancela al cumplir cinco horas y conserva cupos recientes o confirmados', async () => {
  const documents = [
    { id: 'old', createdIn: '2026-11-11T12:00:00Z', statusreserva: 'pendiente' },
    { id: 'recent', createdIn: '2026-11-11T12:00:01Z', statusreserva: 'pendiente' },
    { id: 'paid', createdIn: '2026-11-11T11:00:00Z', statusreserva: 'confirmado' },
    { id: 'unknown-date', statusreserva: 'pendiente' },
  ]
  const updates = []
  const service = new ReservationExpirationService({
    config, now,
    vtexClient: {
      scrollMasterDataDocuments: async () => ({ documents }),
      getMasterDataDocument: async ({ id }) => documents.find((document) => document.id === id),
      updateMasterDataDocument: async (...args) => updates.push(args),
    },
  })
  const result = await service.expirePendingReservations()
  assert.equal(result.cancelled, 1)
  assert.deepEqual(updates, [['SC', 'old', { statusreserva: 'cancelado' }]])
})

test('relee SC y no cancela una reserva confirmada despues de indexar la busqueda', async () => {
  let writes = 0
  const service = new ReservationExpirationService({
    config, now,
    vtexClient: {
      scrollMasterDataDocuments: async () => ({
        documents: [{ id: 'paid', createdIn: '2026-11-11T11:00:00Z', statusreserva: 'pendiente' }],
      }),
      getMasterDataDocument: async () => ({
        id: 'paid', createdIn: '2026-11-11T11:00:00Z', statusreserva: 'confirmado',
      }),
      updateMasterDataDocument: async () => { writes++ },
    },
  })
  const result = await service.expirePendingReservations()
  assert.equal(result.cancelled, 0)
  assert.equal(writes, 0)
})

test('procesa todas las paginas y no se salta documentos al cambiar su estado', async () => {
  const tokens = []
  const service = new ReservationExpirationService({
    config, now,
    vtexClient: {
      scrollMasterDataDocuments: async ({ token }) => {
        tokens.push(token)
        return token
          ? { documents: [], token }
          : { documents: [{ id: 'old', createdIn: '2026-11-11T11:00:00Z', statusreserva: 'pendiente' }], token: 'cursor' }
      },
      getMasterDataDocument: async () => ({ createdIn: '2026-11-11T11:00:00Z', statusreserva: 'pendiente' }),
      updateMasterDataDocument: async () => {},
    },
  })
  const result = await service.expirePendingReservations()
  assert.equal(result.cancelled, 1)
  assert.deepEqual(tokens, [undefined, 'cursor'])
})

test('si falla la lectura no cambia el estado y permite reintentar', async () => {
  let writes = 0
  const failure = new Error('VTEX no disponible')
  const service = new ReservationExpirationService({
    config, now,
    vtexClient: {
      scrollMasterDataDocuments: async () => ({
        documents: [{ id: 'old', createdIn: '2026-11-11T11:00:00Z', statusreserva: 'pendiente' }],
      }),
      getMasterDataDocument: async () => { throw failure },
      updateMasterDataDocument: async () => { writes++ },
    },
  })
  await assert.rejects(service.expirePendingReservations(), failure)
  assert.equal(writes, 0)
})
