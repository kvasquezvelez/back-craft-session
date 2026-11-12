'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { VtexClient } = require('../src/clients/vtex.client')

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body === null ? '' : JSON.stringify(body),
  }
}

test('consulta una reserva SC directamente por su identificador unico', async () => {
  let requestedUrl
  const client = new VtexClient(
    {
      account: 'qa-account',
      environment: 'vtexcommercestable',
      appKey: 'key',
      appToken: 'token',
      timeoutMs: 1000,
    },
    async (url) => {
      requestedUrl = new URL(url)
      return response({ id: 'SC-DOC-1' })
    },
  )

  const result = await client.getMasterDataDocument({
    entity: 'SC',
    id: '8dd028ea-52f8-4ea7-b0db-741654e80842',
    fields: ['id', 'reservationId', 'statusreserva', 'quantity'],
  })

  assert.equal(requestedUrl.pathname, '/api/dataentities/SC/documents/8dd028ea-52f8-4ea7-b0db-741654e80842')
  assert.ok(requestedUrl.searchParams.get('_fields').includes('quantity'))
  assert.equal(requestedUrl.searchParams.has('_where'), false)
  assert.equal(result.id, 'SC-DOC-1')
})

test('actualiza statusreserva con PATCH', async () => {
  let requestOptions
  const client = new VtexClient(
    {
      account: 'qa-account',
      environment: 'vtexcommercestable',
      appKey: 'key',
      appToken: 'token',
      timeoutMs: 1000,
    },
    async (_url, options) => {
      requestOptions = options
      return response(null, 204)
    },
  )

  await client.updateMasterDataDocument('SC', 'SC-DOC-1', {
    statusreserva: 'confirmado',
  })

  assert.equal(requestOptions.method, 'PATCH')
  assert.deepEqual(JSON.parse(requestOptions.body), { statusreserva: 'confirmado' })
})

test('pagina las reservas con el cursor de scroll sin cambiar los filtros', async () => {
  const urls = []
  const client = new VtexClient({ account: 'qa', environment: 'vtexcommercestable', timeoutMs: 1000 },
    async (url) => {
      urls.push(new URL(url))
      return { ...response([{ id: 'SC-1' }]), headers: new Headers({ 'X-VTEX-MD-TOKEN': 'cursor-1' }) }
    })
  const first = await client.scrollMasterDataDocuments({
    entity: 'SC', field: 'statusreserva', value: 'pendiente', fields: ['id', 'createdIn'],
  })
  await client.scrollMasterDataDocuments({
    entity: 'SC', field: 'statusreserva', value: 'pendiente', fields: ['id', 'createdIn'], token: first.token,
  })
  assert.equal(first.token, 'cursor-1')
  assert.equal(urls[0].searchParams.get('statusreserva'), 'pendiente')
  assert.equal(urls[1].searchParams.get('_token'), 'cursor-1')
  assert.equal(urls[1].searchParams.has('_size'), false)
  assert.equal(urls[1].searchParams.has('statusreserva'), false)
})
