'use strict'

class VtexHttpError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'VtexHttpError'
    this.status = status
    this.body = body
  }
}

class VtexClient {
  constructor(config, fetchImpl = fetch) {
    this.config = config
    this.fetch = fetchImpl
    this.baseUrl = `https://${config.account}.${config.environment}.com.br`
  }

  async request(path, options = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await this.fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-VTEX-API-AppKey': this.config.appKey,
          'X-VTEX-API-AppToken': this.config.appToken,
          ...options.headers,
        },
      })

      const text = await response.text()
      let body = null
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
      }

      if (!response.ok) {
        throw new VtexHttpError(
          `VTEX respondio ${response.status} para ${options.method || 'GET'} ${path}`,
          response.status,
          body,
        )
      }

      return body
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new VtexHttpError(`Timeout consultando VTEX: ${path}`, 504)
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  getOrder(orderId) {
    return this.request(`/api/oms/pvt/orders/${encodeURIComponent(orderId)}`)
  }

  async findMasterDataDocuments({ entity, field, value, fields, size = 2 }) {
    const params = new URLSearchParams({
      _fields: fields.join(','),
      _size: String(size),
    })
    params.set(field, value)
    const documents = await this.request(
      `/api/dataentities/${encodeURIComponent(entity)}/search?${params}`,
    )
    return Array.isArray(documents) ? documents : []
  }

  updateMasterDataDocument(entity, documentId, fields) {
    return this.request(
      `/api/dataentities/${encodeURIComponent(entity)}/documents/${encodeURIComponent(documentId)}`,
      { method: 'PATCH', body: JSON.stringify(fields) },
    )
  }
}

module.exports = { VtexClient, VtexHttpError }
