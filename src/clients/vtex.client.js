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
    const { includeHeaders = false, ...fetchOptions } = options
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await this.fetch(`${this.baseUrl}${path}`, {
        ...fetchOptions,
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

      return includeHeaders ? { body, headers: response.headers } : body
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

  getMasterDataDocument({ entity, id, fields }) {
    const params = new URLSearchParams({ _fields: fields.join(',') })
    return this.request(
      `/api/dataentities/${encodeURIComponent(entity)}/documents/${encodeURIComponent(id)}?${params}`,
    )
  }

  async scrollMasterDataDocuments({ entity, field, value, fields, token }) {
    const params = token
      ? new URLSearchParams({ _token: token })
      : new URLSearchParams({ _fields: fields.join(','), _size: '100', [field]: value })
    const result = await this.request(
      `/api/dataentities/${encodeURIComponent(entity)}/scroll?${params}`,
      { includeHeaders: true },
    )
    return {
      documents: Array.isArray(result.body) ? result.body : [],
      token: result.headers?.get('X-VTEX-MD-TOKEN') || token,
    }
  }

  updateMasterDataDocument(entity, documentId, fields) {
    return this.request(
      `/api/dataentities/${encodeURIComponent(entity)}/documents/${encodeURIComponent(documentId)}`,
      { method: 'PATCH', body: JSON.stringify(fields) },
    )
  }
}

module.exports = { VtexClient, VtexHttpError }
