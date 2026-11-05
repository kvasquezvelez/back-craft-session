'use strict'

const express = require('express')
const { createOrderController } = require('./controllers/order.controller')
const { createOrderWebhookController } = require('./controllers/order-webhook.controller')
const { createReservationController } = require('./controllers/reservation.controller')
const { createErrorHandler, notFound } = require('./middlewares/error-handler.middleware')
const { requestContext } = require('./middlewares/request-context.middleware')
const { createWebhookAuth } = require('./middlewares/webhook-auth.middleware')
const { createHealthRouter } = require('./routes/health.routes')
const { createOrderRouter } = require('./routes/order.routes')
const { createOrderWebhookRouter } = require('./routes/order-webhook.routes')
const { createReservationRouter } = require('./routes/reservation.routes')
const { OrderConfirmationService } = require('./services/order-confirmation.service')
const { ReservationQueryService } = require('./services/reservation-query.service')

function createApp({ config, vtexClient, logger }) {
  const app = express()
  const orderConfirmationService = new OrderConfirmationService({ config, vtexClient })
  const reservationQueryService = new ReservationQueryService({ config, vtexClient })
  const auth = createWebhookAuth({ secret: config.webhookSecret, logger })

  app.disable('x-powered-by')
  app.use(requestContext)
  app.use(express.json({ limit: '1mb' }))

  app.use('/health', createHealthRouter())
  app.use('/webhooks/vtex/orders', createOrderWebhookRouter({
    auth,
    controller: createOrderWebhookController({ orderConfirmationService, logger }),
  }))
  app.use('/api/orders', createOrderRouter({
    auth,
    controller: createOrderController({ orderConfirmationService, vtexClient, logger }),
  }))
  app.use('/api/reservations', createReservationRouter({
    controller: createReservationController({ reservationQueryService, logger }),
  }))

  app.use(notFound)
  app.use(createErrorHandler({ logger, nodeEnv: config.nodeEnv }))

  return app
}

module.exports = { createApp }
