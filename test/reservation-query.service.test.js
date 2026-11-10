'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { ReservationQueryService } = require('../src/services/reservation-query.service')

const RESERVATION_ID = '8dd028ea-52f8-4ea7-b0db-741654e80842'
const config = {
  masterData: {
    entity: 'SC',
    reservationIdField: 'reservationId',
    statusField: 'statusreserva',
    confirmedValue: 'confirmado',
  },
}

test('consulta statusreserva usando reservationId como identificador', async () => {
  let query
  const service = new ReservationQueryService({
    config,
    vtexClient: {
      findMasterDataDocuments: async (receivedQuery) => {
        query = receivedQuery
        return [{ id: 'SC-1', reservationId: RESERVATION_ID, statusreserva: 'confirmado' }]
      },
    },
  })

  const result = await service.getStatusByReservationId(` ${RESERVATION_ID} `)

  assert.equal(query.entity, 'SC')
  assert.equal(query.field, 'reservationId')
  assert.equal(query.value, RESERVATION_ID)
  assert.deepEqual(result, {
    reservationId: RESERVATION_ID,
    status: 'confirmado',
    confirmed: true,
    quantity: 1,
  })
})

test('rechaza un reservationId invalido', async () => {
  const service = new ReservationQueryService({ config, vtexClient: {} })

  await assert.rejects(
    service.getStatusByReservationId('id con espacios'),
    (error) => error.statusCode === 400 && error.code === 'invalid_reservation_id',
  )
})

test('responde 404 cuando reservationId no tiene una reserva', async () => {
  const service = new ReservationQueryService({
    config,
    vtexClient: { findMasterDataDocuments: async () => [] },
  })

  await assert.rejects(
    service.getStatusByReservationId(RESERVATION_ID),
    (error) => error.statusCode === 404 && error.code === 'reservation_not_found',
  )
})

test('agrupa varios cupos con el mismo reservationId', async () => {
  const service = new ReservationQueryService({
    config,
    vtexClient: {
      findMasterDataDocuments: async () => [
        { id: 'SC-1', statusreserva: 'confirmado' },
        { id: 'SC-2', statusreserva: 'confirmado' },
      ],
    },
  })

  const result = await service.getStatusByReservationId(RESERVATION_ID)

  assert.deepEqual(result, {
    reservationId: RESERVATION_ID,
    status: 'confirmado',
    confirmed: true,
    quantity: 2,
  })
})

test('indica estado parcial cuando no todos los cupos estan confirmados', async () => {
  const service = new ReservationQueryService({
    config,
    vtexClient: {
      findMasterDataDocuments: async () => [
        { id: 'SC-1', statusreserva: 'confirmado' },
        { id: 'SC-2', statusreserva: 'pendiente' },
      ],
    },
  })

  const result = await service.getStatusByReservationId(RESERVATION_ID)

  assert.equal(result.status, 'parcial')
  assert.equal(result.confirmed, false)
  assert.equal(result.quantity, 2)
})
