'use strict'

const { isPendingReservationExpired } = require('../utils/reservation-expiration')

class ReservationExpirationService {
  constructor({ config, vtexClient, now = () => new Date() }) {
    this.config = config
    this.vtexClient = vtexClient
    this.now = now
  }

  async expirePendingReservations({ shouldContinue = () => true } = {}) {
    const { entity, statusField } = this.config.masterData
    const result = { checked: 0, cancelled: 0, hasMore: false }
    let token

    do {
      const page = await this.vtexClient.scrollMasterDataDocuments({
        entity,
        field: statusField,
        value: 'pendiente',
        fields: ['id', 'createdIn', statusField],
        token,
      })
      token = page.token

      for (let offset = 0; offset < page.documents.length; offset += 5) {
        if (!shouldContinue()) return { ...result, hasMore: true }

        await Promise.all(page.documents.slice(offset, offset + 5).map(async (candidate) => {
          result.checked++
          if (!isPendingReservationExpired(candidate, statusField, this.now())) return

          // Search/scroll can lag behind a payment or a manual cancellation.
          // Always reread the document itself before changing its state.
          let document
          try {
            document = await this.vtexClient.getMasterDataDocument({
              entity,
              id: candidate.id,
              fields: ['id', 'createdIn', statusField],
            })
          } catch (error) {
            if (error.status === 404) return
            throw error
          }
          if (!isPendingReservationExpired(document, statusField, this.now())) return

          await this.vtexClient.updateMasterDataDocument(entity, candidate.id, {
            [statusField]: 'cancelado',
          })
          result.cancelled++
        }))
      }

      if (page.documents.length === 0 || !token) break
    } while (shouldContinue())

    return { ...result, hasMore: Boolean(token && !shouldContinue()) }
  }
}

module.exports = { ReservationExpirationService }
