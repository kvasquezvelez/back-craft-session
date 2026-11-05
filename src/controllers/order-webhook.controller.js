'use strict'

function createOrderWebhookController({ orderConfirmationService, logger }) {
  return {
    async handle(request, response) {
      if (request.body?.hookConfig === 'ping') {
        logger.info('Ping de configuracion de VTEX recibido', {
          requestId: request.requestId,
        })
        return response.status(200).json({ ok: true, type: 'ping' })
      }

      const result = await orderConfirmationService.processWebhook(request.body)
      logger.info('Webhook de orden procesado', {
        requestId: request.requestId,
        ...result,
      })
      return response.status(200).json({ ok: true, ...result })
    },
  }
}

module.exports = { createOrderWebhookController }
