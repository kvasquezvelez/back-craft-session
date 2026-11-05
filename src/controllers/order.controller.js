'use strict'

function createOrderController({ orderConfirmationService, vtexClient, logger }) {
  return {
    async getById(request, response) {
      const order = await vtexClient.getOrder(request.params.orderId)
      logger.info('Orden consultada', {
        requestId: request.requestId,
        orderId: request.params.orderId,
      })
      return response.status(200).json({ data: order })
    },

    async confirmReservation(request, response) {
      const result = await orderConfirmationService.confirmReservationForOrder(
        request.params.orderId,
      )
      logger.info('Confirmacion manual procesada', {
        requestId: request.requestId,
        ...result,
      })
      return response.status(200).json({ ok: true, ...result })
    },
  }
}

module.exports = { createOrderController }
