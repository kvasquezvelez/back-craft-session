'use strict'

const { AppError } = require('../errors/app-error')

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class ReservationQueryService {
  constructor({ config, vtexClient }) {
    this.config = config
    this.vtexClient = vtexClient
  }

  async getStatusByEmail(rawEmail) {
    const email = String(rawEmail || '').trim().toLowerCase()
    if (!email || !EMAIL_PATTERN.test(email)) {
      throw new AppError('Debes enviar un correo valido', {
        statusCode: 400,
        code: 'invalid_email',
      })
    }

    const masterData = this.config.masterData
    const documents = await this.vtexClient.findMasterDataDocuments({
      entity: masterData.entity,
      field: masterData.personField,
      value: email,
      fields: ['id', masterData.personField, masterData.statusField],
      size: 2,
    })

    if (!documents.length) {
      throw new AppError('No se encontro una reserva para el correo enviado', {
        statusCode: 404,
        code: 'reservation_not_found',
      })
    }
    if (documents.length > 1) {
      throw new AppError('Existe mas de una reserva para el correo enviado', {
        statusCode: 409,
        code: 'multiple_reservations_found',
      })
    }

    const reservation = documents[0]
    const status = reservation[masterData.statusField] ?? null

    return {
      email,
      status,
      confirmed: status === masterData.confirmedValue,
    }
  }
}

module.exports = { ReservationQueryService }
