'use strict'

const { loadConfig, validateRuntimeConfig } = require('../src/config/index')
const { VtexClient } = require('../src/clients/vtex.client')

async function configureHook(env = process.env, clientOverride) {
  const config = loadConfig(env)
  validateRuntimeConfig(config)

  const publicBaseUrl = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '')
  if (!publicBaseUrl.startsWith('https://')) {
    throw new Error('PUBLIC_BASE_URL es requerida y debe comenzar con https://')
  }

  const client = clientOverride || new VtexClient(config.vtex)
  const body = {
    filter: {
      type: 'FromWorkflow',
      status: [config.webhookOrderStatus],
    },
    hook: {
      url: `${publicBaseUrl}/webhooks/vtex/orders`,
      headers: {
        'x-webhook-secret': config.webhookSecret,
      },
    },
  }

  await client.request('/api/orders/hook/config', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return body
}

if (require.main === module) {
  configureHook()
    .then((body) => {
      console.log(`Hook configurado: ${body.hook.url}`)
      console.log(`Estado: ${body.filter.status.join(', ')}`)
    })
    .catch((error) => {
      console.error(`No se pudo configurar el hook: ${error.message}`)
      if (error.body) {
        console.error(`Detalle de VTEX: ${JSON.stringify(error.body)}`)
      }
      process.exit(1)
    })
}

module.exports = { configureHook }
