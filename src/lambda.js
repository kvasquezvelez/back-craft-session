'use strict'

const serverless = require('serverless-http')
const { createApp } = require('./app')
const { VtexClient } = require('./clients/vtex.client')
const { loadConfig, validateRuntimeConfig } = require('./config/index')
const logger = require('./logger')
const { ReservationExpirationService } = require('./services/reservation-expiration.service')

const config = loadConfig()
validateRuntimeConfig(config)

const vtexClient = new VtexClient(config.vtex)
const app = createApp({ config, vtexClient, logger })

const httpHandler = serverless(app)
const expirationService = new ReservationExpirationService({ config, vtexClient })

module.exports.handler = async (event, context) => {
  if (event?.source === 'craft-session.expiration' && event?.action === 'expire-pending') {
    const result = await expirationService.expirePendingReservations({
      shouldContinue: () => !context?.getRemainingTimeInMillis
        || context.getRemainingTimeInMillis() > 10000,
    })
    logger.info('Vencimiento de reservas pendientes procesado', result)
    return result
  }

  return httpHandler(event, context)
}
