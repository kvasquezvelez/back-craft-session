'use strict'

const { createApp } = require('./app')
const { VtexClient } = require('./clients/vtex.client')
const { loadConfig, validateRuntimeConfig } = require('./config/index')
const logger = require('./logger')

function start() {
  const config = loadConfig()
  validateRuntimeConfig(config)

  const vtexClient = new VtexClient(config.vtex)
  const app = createApp({ config, vtexClient, logger })
  const server = app.listen(config.port, () => {
    logger.info('Servidor iniciado', {
      port: config.port,
      environment: config.nodeEnv,
      vtexAccount: config.vtex.account,
      masterDataEntity: config.masterData.entity,
    })
  })

  const shutdown = (signal) => {
    logger.info('Cerrando servidor', { signal })
    server.close(() => process.exit(0))
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return server
}

if (require.main === module) {
  try {
    start()
  } catch (error) {
    logger.error('No se pudo iniciar el servidor', { error: error.message })
    process.exit(1)
  }
}

module.exports = { start }
