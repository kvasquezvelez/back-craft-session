'use strict'

function getByPath(value, path) {
  if (!path) return undefined
  return path.split('.').reduce((current, segment) => {
    if (current === null || current === undefined) return undefined
    return current[segment]
  }, value)
}

module.exports = { getByPath }
