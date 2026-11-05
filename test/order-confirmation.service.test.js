'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { OrderConfirmationService } = require('../src/services/order-confirmation.service')

function createConfig() {
  return {
    webhookOrderStatus: 'invoiced',
    service: {
      skuIds: ['663375276'],
    },
    masterData: {
      entity: 'SC',
      personField: 'email',
      personOrderPath: 'clientProfileData.email',
      statusField: 'statusreserva',
      confirmedValue: 'confirmado',
      requireUniqueMatch: true,
    },
  }
}

function createOrder(overrides = {}) {
  return {
    orderId: 'ORDER-1',
    status: 'invoiced',
    items: [{ id: '663375276', name: 'Servicio' }],
    clientProfileData: { email: 'persona@example.com' },
    ...overrides,
  }
}

test('lee la orden y confirma la reserva de la persona en SC', async () => {
  const calls = []
  const vtexClient = {
    getOrder: async () => createOrder(),
    findMasterDataDocuments: async (query) => {
      calls.push(['find', query])
      return [{ id: 'SC-DOC-1', email: 'persona@example.com', statusreserva: 'pendiente' }]
    },
    updateMasterDataDocument: async (...args) => calls.push(['update', ...args]),
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  const result = await service.processWebhook({
    OrderId: 'ORDER-1',
    State: 'invoiced',
  })

  assert.equal(result.outcome, 'confirmed')
  assert.equal(calls[0][1].field, 'email')
  assert.equal(calls[0][1].value, 'persona@example.com')
  assert.deepEqual(calls[1], [
    'update',
    'SC',
    'SC-DOC-1',
    { statusreserva: 'confirmado' },
  ])
})

test('es idempotente cuando la reserva ya esta confirmada', async () => {
  let updated = false
  const vtexClient = {
    getOrder: async () => createOrder(),
    findMasterDataDocuments: async () => [{
      id: 'SC-DOC-1',
      email: 'persona@example.com',
      statusreserva: 'confirmado',
    }],
    updateMasterDataDocument: async () => { updated = true },
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  const result = await service.confirmReservationForOrder('ORDER-1')

  assert.equal(result.outcome, 'already-confirmed')
  assert.equal(updated, false)
})

test('no actualiza SC si la orden no contiene Craft Session', async () => {
  let searched = false
  const vtexClient = {
    getOrder: async () => createOrder({ items: [{ id: 'OTHER', name: 'Otro producto' }] }),
    findMasterDataDocuments: async () => { searched = true },
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  const result = await service.confirmReservationForOrder('ORDER-1')

  assert.equal(result.outcome, 'ignored-without-service')
  assert.equal(searched, false)
})

test('rechaza multiples reservas para no confirmar a la persona equivocada', async () => {
  const vtexClient = {
    getOrder: async () => createOrder(),
    findMasterDataDocuments: async () => [
      { id: 'SC-DOC-1' },
      { id: 'SC-DOC-2' },
    ],
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  await assert.rejects(
    service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'multiple_reservations_found',
  )
})

test('ignora eventos diferentes a invoiced sin leer la orden', async () => {
  let requested = false
  const service = new OrderConfirmationService({
    config: createConfig(),
    vtexClient: { getOrder: async () => { requested = true } },
  })

  const result = await service.processWebhook({ OrderId: 'ORDER-2', State: 'payment-approved' })

  assert.equal(result.outcome, 'ignored-status')
  assert.equal(requested, false)
})

test('normaliza el correo de la orden antes de buscarlo en SC', async () => {
  let searchedEmail
  const vtexClient = {
    getOrder: async () => createOrder({
      clientProfileData: { email: '  Persona@Example.COM  ' },
    }),
    findMasterDataDocuments: async ({ value }) => {
      searchedEmail = value
      return [{ id: 'SC-DOC-1', statusreserva: 'pendiente' }]
    },
    updateMasterDataDocument: async () => {},
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  await service.confirmReservationForOrder('ORDER-1')

  assert.equal(searchedEmail, 'persona@example.com')
})

test('no confirma si OMS todavia no reporta la orden como invoiced', async () => {
  let searched = false
  const vtexClient = {
    getOrder: async () => createOrder({ status: 'payment-approved' }),
    findMasterDataDocuments: async () => { searched = true },
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  const result = await service.confirmReservationForOrder('ORDER-1')

  assert.equal(result.outcome, 'ignored-status')
  assert.equal(searched, false)
})
