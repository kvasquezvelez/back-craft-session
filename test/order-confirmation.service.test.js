'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { OrderConfirmationService } = require('../src/services/order-confirmation.service')

const RESERVATION_ID = '8dd028ea-52f8-4ea7-b0db-741654e80842'

function createConfig() {
  return {
    webhookOrderStatus: 'payment-approved',
    service: {
      skuIds: ['663375276'],
      customAppId: 'craft-session',
      customField: 'reservationGroupIds',
    },
    masterData: {
      entity: 'SC',
      reservationIdField: 'reservationId',
      statusField: 'statusreserva',
      confirmedValue: 'confirmado',
      orderIdField: 'orderId',
      confirmedAtField: 'confirmedAt',
      quantityField: 'quantity',
      emailPrimaryField: 'emailPrimary',
      emailSentField: 'emailSent',
      emailSentAtField: 'emailSentAt',
    },
  }
}

function createOrder(overrides = {}) {
  return {
    orderId: 'ORDER-1',
    status: 'payment-approved',
    items: [{ id: '663375276', name: 'Servicio' }],
    customData: {
      customApps: [{
        id: 'craft-session',
        fields: { reservationGroupIds: RESERVATION_ID },
      }],
    },
    ...overrides,
  }
}

test('consulta los cupos por reservationId y los confirma en Master Data', async () => {
  const confirmedAt = '2026-11-09T11:30:00.000Z'
  const calls = []
  const vtexClient = {
    getOrder: async () => createOrder(),
    findMasterDataDocuments: async (query) => {
      calls.push(['find', query])
      return [
        { id: 'SC-1', reservationId: RESERVATION_ID, statusreserva: 'pendiente' },
        { id: 'SC-2', reservationId: RESERVATION_ID, statusreserva: 'pendiente' },
      ]
    },
    updateMasterDataDocument: async (...args) => calls.push(['update', ...args]),
  }
  const service = new OrderConfirmationService({
    config: createConfig(),
    vtexClient,
    now: () => new Date(confirmedAt),
  })

  const result = await service.processWebhook({
    OrderId: 'ORDER-1',
    State: 'payment-approved',
  })

  assert.equal(result.outcome, 'confirmed')
  assert.deepEqual(result.reservationIds, [RESERVATION_ID])
  assert.equal(result.confirmedQuantity, 2)
  assert.equal(result.totalQuantity, 2)
  assert.equal(calls[0][1].field, 'reservationId')
  assert.equal(calls[0][1].value, RESERVATION_ID)
  assert.deepEqual(calls.slice(1), [
    ['update', 'SC', 'SC-1', {
      statusreserva: 'confirmado',
      orderId: 'ORDER-1',
      confirmedAt,
      quantity: 2,
      emailPrimary: true,
      emailSent: true,
      emailSentAt: confirmedAt,
    }],
    ['update', 'SC', 'SC-2', {
      statusreserva: 'confirmado',
      orderId: 'ORDER-1',
      confirmedAt,
      quantity: 2,
      emailPrimary: false,
    }],
  ])
})

test('acepta reintentos cuando OMS ya avanzo a handling', async () => {
  let updated = false
  const vtexClient = {
    getOrder: async () => createOrder({ status: 'handling' }),
    findMasterDataDocuments: async () => [
      { id: 'SC-1', reservationId: RESERVATION_ID, statusreserva: 'confirmado' },
    ],
    updateMasterDataDocument: async () => { updated = true },
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  const result = await service.confirmReservationForOrder('ORDER-1')

  assert.equal(result.outcome, 'already-confirmed')
  assert.equal(result.confirmedQuantity, 0)
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

test('procesa varias reservas asociadas a una misma orden', async () => {
  const secondReservationId = '7dd028ea-52f8-4ea7-b0db-741654e80841'
  const queries = []
  const vtexClient = {
    getOrder: async () => createOrder({
      customData: {
        customApps: [{
          id: 'craft-session',
          fields: {
            reservationGroupIds: `${RESERVATION_ID},${secondReservationId}`,
          },
        }],
      },
    }),
    findMasterDataDocuments: async (query) => {
      queries.push(query.value)
      return [{
        id: `SC-${queries.length}`,
        reservationId: query.value,
        statusreserva: 'pendiente',
      }]
    },
    updateMasterDataDocument: async () => {},
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  const result = await service.confirmReservationForOrder('ORDER-1')

  assert.deepEqual(result.reservationIds, [RESERVATION_ID, secondReservationId])
  assert.deepEqual(queries, [RESERVATION_ID, secondReservationId])
  assert.equal(result.confirmedQuantity, 2)
})

test('ignora eventos anteriores al pago aprobado sin leer la orden', async () => {
  let requested = false
  const service = new OrderConfirmationService({
    config: createConfig(),
    vtexClient: { getOrder: async () => { requested = true } },
  })

  const result = await service.processWebhook({
    OrderId: 'ORDER-2',
    State: 'payment-pending',
  })

  assert.equal(result.outcome, 'ignored-status')
  assert.equal(requested, false)
})

test('procesa el evento si VTEX ya avanzo a window-to-cancel', async () => {
  const confirmedAt = '2026-11-09T11:30:00.000Z'
  const calls = []
  const vtexClient = {
    getOrder: async () => createOrder({ status: 'window-to-cancel' }),
    findMasterDataDocuments: async () => [
      { id: 'SC-1', reservationId: RESERVATION_ID, statusreserva: 'pendiente' },
    ],
    updateMasterDataDocument: async (...args) => calls.push(args),
  }
  const service = new OrderConfirmationService({
    config: createConfig(),
    vtexClient,
    now: () => new Date(confirmedAt),
  })

  const result = await service.processWebhook({
    OrderId: 'ORDER-1',
    State: 'window-to-cancel',
  })

  assert.equal(result.outcome, 'confirmed')
  assert.equal(result.confirmedQuantity, 1)
  assert.deepEqual(calls, [
    ['SC', 'SC-1', {
      statusreserva: 'confirmado',
      orderId: 'ORDER-1',
      confirmedAt,
      quantity: 1,
      emailPrimary: true,
      emailSent: true,
      emailSentAt: confirmedAt,
    }],
  ])
})

test('marca un solo documento principal por cada reservationId', async () => {
  const secondReservationId = '7dd028ea-52f8-4ea7-b0db-741654e80841'
  const updates = []
  const vtexClient = {
    getOrder: async () => createOrder({
      customData: {
        customApps: [{
          id: 'craft-session',
          fields: {
            reservationGroupIds: `${RESERVATION_ID},${secondReservationId}`,
          },
        }],
      },
    }),
    findMasterDataDocuments: async ({ value }) => value === RESERVATION_ID
      ? [
        { id: 'SC-2', reservationId: value, statusreserva: 'pendiente' },
        { id: 'SC-1', reservationId: value, statusreserva: 'pendiente' },
      ]
      : [{ id: 'SC-3', reservationId: value, statusreserva: 'pendiente' }],
    updateMasterDataDocument: async (_entity, id, fields) => updates.push({ id, fields }),
  }
  const service = new OrderConfirmationService({
    config: createConfig(),
    vtexClient,
    now: () => new Date('2026-11-09T11:30:00.000Z'),
  })

  await service.confirmReservationForOrder('ORDER-1')

  assert.equal(updates.filter(({ fields }) => fields.emailPrimary).length, 2)
  assert.equal(updates.filter(({ fields }) => fields.emailSent).length, 2)
  assert.deepEqual(
    updates.filter(({ fields }) => fields.emailPrimary).map(({ id }) => id).sort(),
    ['SC-1', 'SC-3'],
  )
})

test('rechaza una orden sin reservationGroupIds en customData', async () => {
  const service = new OrderConfirmationService({
    config: createConfig(),
    vtexClient: { getOrder: async () => createOrder({ customData: null }) },
  })

  await assert.rejects(
    service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_id_not_found_in_order',
  )
})

test('no confirma si OMS todavia no reporta el pago aprobado', async () => {
  let searched = false
  const vtexClient = {
    getOrder: async () => createOrder({ status: 'payment-pending' }),
    findMasterDataDocuments: async () => { searched = true },
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  const result = await service.confirmReservationForOrder('ORDER-1')

  assert.equal(result.outcome, 'ignored-status')
  assert.equal(searched, false)
})

test('falla sin actualizar si uno de los grupos no tiene cupos', async () => {
  const secondReservationId = '7dd028ea-52f8-4ea7-b0db-741654e80841'
  let updated = false
  const vtexClient = {
    getOrder: async () => createOrder({
      customData: {
        customApps: [{
          id: 'craft-session',
          fields: {
            reservationGroupIds: `${RESERVATION_ID},${secondReservationId}`,
          },
        }],
      },
    }),
    findMasterDataDocuments: async ({ value }) => value === RESERVATION_ID
      ? [{ id: 'SC-1', statusreserva: 'pendiente' }]
      : [],
    updateMasterDataDocument: async () => { updated = true },
  }
  const service = new OrderConfirmationService({ config: createConfig(), vtexClient })

  await assert.rejects(
    service.confirmReservationForOrder('ORDER-1'),
    (error) => error.code === 'reservation_not_found',
  )
  assert.equal(updated, false)
})
