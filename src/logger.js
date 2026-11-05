'use strict'

function write(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }
  const output = JSON.stringify(entry)
  if (level === 'error') console.error(output)
  else console.log(output)
}

module.exports = {
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
}
