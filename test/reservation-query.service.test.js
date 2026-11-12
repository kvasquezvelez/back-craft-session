'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { ReservationQueryService } = require('../src/services/reservation-query.service')
const { getReservationDocumentId } = require('../src/utils/reservation-id')
const { loadConfig } = require('../src/config')
const ID = 'a'.repeat(32)

test('consulta un unico documento SC directamente y devuelve quantity', async () => {
  let query
  const service = new ReservationQueryService({
    config: loadConfig({}),
    vtexClient: { getMasterDataDocument: async (value) => {
      query = value
      return { id: value.id, reservationId: ID, quantity: 4, statusreserva: 'confirmado' }
    } },
  })
  const result = await service.getStatusByReservationId(ID)
  assert.equal(query.id, getReservationDocumentId(ID))
  assert.deepEqual(result, { reservationId: ID, quantity: 4, status: 'confirmado', confirmed: true })
})

test('rechaza un identificador invalido', async () => {
  const service = new ReservationQueryService({ config: loadConfig({}), vtexClient: {} })
  await assert.rejects(service.getStatusByReservationId('id con espacios'),
    (error) => error.code === 'invalid_reservation_id')
})

test('responde 404 si SC no contiene la reserva', async () => {
  const service = new ReservationQueryService({
    config: loadConfig({}),
    vtexClient: { getMasterDataDocument: async () => { throw Object.assign(new Error(), { status: 404 }) } },
  })
  await assert.rejects(service.getStatusByReservationId(ID),
    (error) => error.code === 'reservation_not_found')
})

test('devuelve cancelado cuando se cambia manualmente SC', async () => {
  const service = new ReservationQueryService({
    config: loadConfig({}),
    vtexClient: { getMasterDataDocument: async () => ({ reservationId: ID, quantity: 3, statusreserva: 'cancelado' }) },
  })
  const result = await service.getStatusByReservationId(ID)
  assert.equal(result.status, 'cancelado')
  assert.equal(result.quantity, 3)
  assert.equal(result.confirmed, false)
})

test('no oculta un fallo temporal de lectura como reserva inexistente', async () => {
  const failure = Object.assign(new Error('VTEX unavailable'), { status: 503 })
  const service = new ReservationQueryService({
    config: loadConfig({}), vtexClient: { getMasterDataDocument: async () => { throw failure } },
  })
  await assert.rejects(service.getStatusByReservationId(ID), failure)
})
