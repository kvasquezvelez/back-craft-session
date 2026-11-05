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

test('consulta una persona en SC usando el campo configurado', async () => {
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
      return response([{ id: 'SC-DOC-1' }])
    },
  )

  const result = await client.findMasterDataDocuments({
    entity: 'SC',
    field: 'email',
    value: 'persona@example.com',
    fields: ['id', 'email', 'statusreserva'],
  })

  assert.equal(requestedUrl.pathname, '/api/dataentities/SC/search')
  assert.equal(requestedUrl.searchParams.get('email'), 'persona@example.com')
  assert.equal(requestedUrl.searchParams.has('_where'), false)
  assert.equal(result[0].id, 'SC-DOC-1')
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
