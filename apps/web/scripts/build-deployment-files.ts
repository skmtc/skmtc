import { toFileTree, toFlatFileTree } from '../lib/toFileTree.ts'
import { writeFileSync } from 'node:fs'

const runtimeFiles = toFileTree('./app/reapit-files')

writeFileSync('./app/reapit-files.json', JSON.stringify(runtimeFiles, null, 2))

const downloadFiles = toFlatFileTree('./app/reapit-download', {})

writeFileSync('./app/reapit-download.json', JSON.stringify(downloadFiles, null, 2))
