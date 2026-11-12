'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadConfig } = require('../src/config')
const { OrderConfirmationService } = require('../src/services/order-confirmation.service')
const { getReservationDocumentId } = require('../src/utils/reservation-id')

const FIRST = 'a'.repeat(32)
const SECOND = 'b'.repeat(32)
const STALE = 'c'.repeat(32)

function fixture({ ids = [FIRST], quantities = [4], paid = 4, status = 'payment-approved' } = {}) {
  const records = new Map(quantities.map((quantity, index) => {
    const reservationId = index === 0 ? FIRST : SECOND
    const id = getReservationDocumentId(reservationId)
    return [id, { id, reservationId, quantity, statusreserva: 'pendiente', createdIn: '2026-11-11T16:00:00Z' }]
  }))
  const updates = []
  const order = {
    status,
    items: [{ id: '663375276', quantity: paid }],
    customData: { customApps: [{ id: 'craft-session', fields: { reservationGroupIds: ids.join(',') } }] },
  }
  const client = {
    getOrder: async () => order,
    getMasterDataDocument: async ({ id }) => {
      const record = records.get(id)
      if (!record) throw Object.assign(new Error('Not found'), { status: 404 })
      return { ...record }
    },
    updateMasterDataDocument: async (entity, id, fields) => {
      updates.push({ entity, id, fields })
      Object.assign(records.get(id), fields)
    },
  }
  const service = new OrderConfirmationService({
    config: loadConfig({}), vtexClient: client,
    now: () => new Date('2026-11-11T17:00:00Z'),
  })
  return { records, updates, order, client, service }
}

test('cuatro cupos se confirman en un unico documento y un solo correo', async () => {
  const f = fixture()
  const result = await f.service.processWebhook({ OrderId: 'ORDER-1', State: 'payment-approved' })
  assert.equal(result.confirmedQuantity, 4)
  assert.equal(result.totalQuantity, 4)
  assert.equal(f.updates.length, 1)
  assert.equal(f.updates[0].fields.emailPrimary, true)
  assert.equal(f.updates[0].fields.emailSent, true)
  assert.equal(f.records.get(getReservationDocumentId(FIRST)).quantity, 4)
})

test('un reintento del webhook no confirma ni activa el correo otra vez', async () => {
  const f = fixture()
  await f.service.confirmReservationForOrder('ORDER-1')
  const result = await f.service.confirmReservationForOrder('ORDER-1')
  assert.equal(result.outcome, 'already-confirmed')
  assert.equal(result.confirmedQuantity, 0)
  assert.equal(f.updates.length, 1)
})

test('varias reservas por orden suman quantity y conservan un registro por reserva', async () => {
  const f = fixture({ ids: [FIRST, SECOND], quantities: [2, 3], paid: 5 })
  const result = await f.service.confirmReservationForOrder('ORDER-1')
  assert.equal(result.totalQuantity, 5)
  assert.equal(result.confirmedQuantity, 5)
  assert.equal(f.updates.length, 2)
})

test('los identificadores repetidos en customData no duplican cupos ni actualizaciones', async () => {
  const f = fixture({ ids: [FIRST, FIRST] })
  const result = await f.service.confirmReservationForOrder('ORDER-1')
  assert.equal(result.totalQuantity, 4)
  assert.equal(f.updates.length, 1)
})

test('omite una referencia eliminada solo cuando los cupos vigentes coinciden con los pagados', async () => {
  const f = fixture({ ids: [STALE, FIRST], status: 'ready-for-handling' })
  const result = await f.service.confirmReservationForOrder('ORDER-1')
  assert.deepEqual(result.ignoredReservationIds, [STALE])
  assert.deepEqual(result.reservationIds, [FIRST])
  assert.equal(result.confirmedQuantity, 4)
  assert.equal(f.updates.length, 1)
})

test('no confirma si faltan cupos respecto a lo pagado', async () => {
  const f = fixture({ ids: [FIRST, STALE], paid: 5 })
  await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_quantity_mismatch')
  assert.equal(f.updates.length, 0)
})

test('no confirma mas cupos que los pagados', async () => {
  const f = fixture({ quantities: [5], paid: 4 })
  await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_quantity_mismatch')
  assert.equal(f.updates.length, 0)
})

test('no revive una reserva cancelada manualmente', async () => {
  const f = fixture()
  f.records.get(getReservationDocumentId(FIRST)).statusreserva = 'cancelado'
  await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_not_found')
  assert.equal(f.updates.length, 0)
})

test('no confirma reservas pendientes con cinco horas cumplidas', async () => {
  const f = fixture()
  f.records.get(getReservationDocumentId(FIRST)).createdIn = '2026-11-11T12:00:00Z'
  await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_expired')
  assert.equal(f.updates.length, 0)
})

test('no transfiere una reserva de una orden a otra', async () => {
  const f = fixture()
  f.records.get(getReservationDocumentId(FIRST)).orderId = 'OTHER-ORDER'
  await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_order_mismatch')
  assert.equal(f.updates.length, 0)
})

test('un fallo de VTEX no se interpreta como una reserva inexistente', async () => {
  const f = fixture()
  const error = Object.assign(new Error('Unavailable'), { status: 503 })
  f.client.getMasterDataDocument = async () => { throw error }
  await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'), error)
  assert.equal(f.updates.length, 0)
})

test('ignora ordenes que aun no tienen pago aprobado', async () => {
  const f = fixture({ status: 'payment-pending' })
  const result = await f.service.confirmReservationForOrder('ORDER-1')
  assert.equal(result.outcome, 'ignored-status')
  assert.equal(f.updates.length, 0)
})

test('acepta estados posteriores al pago aprobado', async () => {
  const f = fixture({ status: 'handling' })
  assert.equal((await f.service.confirmReservationForOrder('ORDER-1')).confirmedQuantity, 4)
})

test('rechaza cantidades corruptas, fraccionarias o superiores a quince', async () => {
  for (const quantity of [0, 1.5, 16, '4', null]) {
    const f = fixture({ quantities: [quantity] })
    await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'),
      (error) => error.code === 'invalid_reservation_quantity')
    assert.equal(f.updates.length, 0)
  }
})

test('rechaza ordenes sin referencia y omite ordenes sin servicio', async () => {
  const f = fixture({ ids: [] })
  await assert.rejects(f.service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_id_not_found_in_order')
  f.order.items = [{ id: 'OTHER', quantity: 1 }]
  assert.equal((await f.service.confirmReservationForOrder('ORDER-1')).outcome, 'ignored-without-service')
})
