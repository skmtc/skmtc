import { assertEquals } from '@std/assert'
import { existsSync } from '@std/fs/exists'
import { join } from '@std/path/join'
import type { LogLine } from '@skmtc/core/LogLine'
import { toLogLinesPath, writeLogLines } from '@/lib/write-log-lines.ts'

const errorLine: LogLine = {
  seq: 0,
  level: 'ERROR',
  trail: 'trace:span:generate:ops:/pets:get:variant:main',
  message: 'pets transform failed',
  error: { name: 'Error', message: 'pets transform failed', stack: 'Error: pets transform failed' },
  time: 1
}

const withSettingsDir = (fn: (manifestPath: string) => void) => {
  const root = Deno.makeTempDirSync()
  try {
    fn(join(root, 'manifest.json'))
  } finally {
    Deno.removeSync(root, { recursive: true })
  }
}

Deno.test('writeLogLines - writes one JSON line per log line beside the manifest', () => {
  withSettingsDir(manifestPath => {
    writeLogLines({ manifestPath, logs: [errorLine, { ...errorLine, seq: 1 }] })

    const logLinesPath = toLogLinesPath(manifestPath)
    const lines = Deno.readTextFileSync(logLinesPath).split('\n')

    assertEquals(logLinesPath, join(manifestPath, '..', 'logs.ndjson'))
    assertEquals(lines.length, 3)
    assertEquals(JSON.parse(lines[0]), errorLine)
    assertEquals(JSON.parse(lines[1]).seq, 1)
    assertEquals(lines[2], '')
  })
})

Deno.test('writeLogLines - an empty run replaces the previous file with an empty one', () => {
  withSettingsDir(manifestPath => {
    writeLogLines({ manifestPath, logs: [errorLine] })
    writeLogLines({ manifestPath, logs: [] })

    assertEquals(Deno.readTextFileSync(toLogLinesPath(manifestPath)), '')
  })
})

Deno.test('writeLogLines - a result without logs removes the old file', () => {
  withSettingsDir(manifestPath => {
    writeLogLines({ manifestPath, logs: [errorLine] })
    writeLogLines({ manifestPath, logs: undefined })

    assertEquals(existsSync(toLogLinesPath(manifestPath)), false)

    // No file to remove is not an error.
    writeLogLines({ manifestPath, logs: undefined })
  })
})
