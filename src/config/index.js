'use strict'

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue
  return String(value).toLowerCase() === 'true'
}

function loadConfig(env = process.env) {
  const timeoutMs = Number(env.VTEX_REQUEST_TIMEOUT_MS || 1400)
  const port = Number(env.PORT || 3000)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un puerto valido')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100) {
    throw new Error('VTEX_REQUEST_TIMEOUT_MS debe ser mayor o igual a 100')
  }

  return {
    nodeEnv: env.NODE_ENV || 'development',
    port,
    webhookSecret: env.WEBHOOK_SECRET || '',
    webhookOrderStatus: env.VTEX_WEBHOOK_STATUS || 'invoiced',
    vtex: {
      account: env.VTEX_ACCOUNT || '',
      environment: env.VTEX_ENVIRONMENT || 'vtexcommercestable',
      appKey: env.VTEX_APP_KEY || '',
      appToken: env.VTEX_APP_TOKEN || '',
      timeoutMs,
    },
    service: {
      skuIds: splitCsv(env.CRAFT_SERVICE_SKU_IDS || '663375276'),
    },
    masterData: {
      entity: env.MASTER_DATA_ENTITY || 'SC',
      personField: env.SC_PERSON_FIELD || env.SC_LOOKUP_FIELD || 'email',
      personOrderPath:
        env.SC_PERSON_ORDER_PATH || env.SC_LOOKUP_ORDER_PATH || 'clientProfileData.email',
      statusField: env.SC_STATUS_FIELD || 'statusreserva',
      confirmedValue: env.SC_CONFIRMED_VALUE || 'confirmado',
      requireUniqueMatch: parseBoolean(env.SC_REQUIRE_UNIQUE_MATCH, true),
    },
  }
}

function validateRuntimeConfig(config) {
  const missing = []
  if (!config.vtex.account) missing.push('VTEX_ACCOUNT')
  if (!config.vtex.appKey) missing.push('VTEX_APP_KEY')
  if (!config.vtex.appToken) missing.push('VTEX_APP_TOKEN')
  if (!config.webhookSecret) missing.push('WEBHOOK_SECRET')

  if (missing.length) {
    throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`)
  }
}

module.exports = { loadConfig, validateRuntimeConfig }
