'use strict'

function createReservationController({ reservationQueryService, logger }) {
  return {
    async getStatus(request, response) {
      const result = await reservationQueryService.getStatusByEmail(request.query.email)
      logger.info('Estado de reserva consultado', {
        requestId: request.requestId,
        confirmed: result.confirmed,
      })
      return response.status(200).json({ ok: true, data: result })
    },
  }
}

module.exports = { createReservationController }
