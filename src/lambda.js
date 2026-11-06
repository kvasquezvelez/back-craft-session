'use strict'

const serverless = require('serverless-http')
const { createApp } = require('./app')
const { VtexClient } = require('./clients/vtex.client')
const { loadConfig, validateRuntimeConfig } = require('./config/index')
const logger = require('./logger')

const config = loadConfig()
validateRuntimeConfig(config)

const vtexClient = new VtexClient(config.vtex)
const app = createApp({ config, vtexClient, logger })

module.exports.handler = serverless(app)
