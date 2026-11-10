'use strict'

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function loadConfig(env = process.env) {
  const timeoutMs = Number(env.VTEX_REQUEST_TIMEOUT_MS || 10000)
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
    webhookOrderStatus: env.VTEX_WEBHOOK_STATUS || 'payment-approved',
    vtex: {
      account: env.VTEX_ACCOUNT || '',
      environment: env.VTEX_ENVIRONMENT || 'vtexcommercestable',
      appKey: env.VTEX_APP_KEY || '',
      appToken: env.VTEX_APP_TOKEN || '',
      timeoutMs,
    },
    service: {
      skuIds: splitCsv(env.CRAFT_SERVICE_SKU_IDS || '663375276'),
      customAppId: env.CRAFT_SESSION_CUSTOM_APP_ID || 'craft-session',
      customField: env.CRAFT_SESSION_CUSTOM_FIELD || 'reservationGroupIds',
    },
    masterData: {
      entity: env.MASTER_DATA_ENTITY || 'SC',
      reservationIdField: env.SC_RESERVATION_ID_FIELD || 'reservationId',
      statusField: env.SC_STATUS_FIELD || 'statusreserva',
      confirmedValue: env.SC_CONFIRMED_VALUE || 'confirmado',
      orderIdField: env.SC_ORDER_ID_FIELD || 'orderId',
      confirmedAtField: env.SC_CONFIRMED_AT_FIELD || 'confirmedAt',
      quantityField: env.SC_QUANTITY_FIELD || 'quantity',
      emailPrimaryField: env.SC_EMAIL_PRIMARY_FIELD || 'emailPrimary',
      emailSentField: env.SC_EMAIL_SENT_FIELD || 'emailSent',
      emailSentAtField: env.SC_EMAIL_SENT_AT_FIELD || 'emailSentAt',
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
