'use strict'

const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const sourceDirectory = path.join(projectRoot, 'src')
const outputDirectory = path.join(projectRoot, 'dist')

if (!fs.existsSync(sourceDirectory)) {
  throw new Error(`No se encontro el directorio de fuentes: ${sourceDirectory}`)
}

fs.rmSync(outputDirectory, { recursive: true, force: true })
fs.cpSync(sourceDirectory, outputDirectory, { recursive: true })

console.log(`Build generado en ${outputDirectory}`)
