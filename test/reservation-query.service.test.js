'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { ReservationQueryService } = require('../src/services/reservation-query.service')

const config = {
  masterData: {
    entity: 'SC',
    personField: 'email',
    statusField: 'statusreserva',
    confirmedValue: 'confirmado',
  },
}

test('consulta statusreserva usando el correo como identificador', async () => {
  let query
  const service = new ReservationQueryService({
    config,
    vtexClient: {
      findMasterDataDocuments: async (receivedQuery) => {
        query = receivedQuery
        return [{ id: 'SC-1', email: 'persona@example.com', statusreserva: 'confirmado' }]
      },
    },
  })

  const result = await service.getStatusByEmail(' Persona@Example.COM ')

  assert.equal(query.entity, 'SC')
  assert.equal(query.field, 'email')
  assert.equal(query.value, 'persona@example.com')
  assert.deepEqual(result, {
    email: 'persona@example.com',
    status: 'confirmado',
    confirmed: true,
  })
})

test('rechaza un correo invalido', async () => {
  const service = new ReservationQueryService({ config, vtexClient: {} })

  await assert.rejects(
    service.getStatusByEmail('correo-invalido'),
    (error) => error.statusCode === 400 && error.code === 'invalid_email',
  )
})

test('responde 404 cuando el correo no tiene una reserva', async () => {
  const service = new ReservationQueryService({
    config,
    vtexClient: { findMasterDataDocuments: async () => [] },
  })

  await assert.rejects(
    service.getStatusByEmail('persona@example.com'),
    (error) => error.statusCode === 404 && error.code === 'reservation_not_found',
  )
})

test('rechaza resultados ambiguos para el mismo correo', async () => {
  const service = new ReservationQueryService({
    config,
    vtexClient: {
      findMasterDataDocuments: async () => [{ id: 'SC-1' }, { id: 'SC-2' }],
    },
  })

  await assert.rejects(
    service.getStatusByEmail('persona@example.com'),
    (error) => error.statusCode === 409 && error.code === 'multiple_reservations_found',
  )
})
