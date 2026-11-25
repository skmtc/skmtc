import { assert } from '@std/assert'
import { fromFileUrl } from '@std/path'
import * as v from 'valibot'
import type { SystemSettings } from '@/types/Settings.ts'

type ParseBoundedArgs = {
  openapi: string
  schemas: Record<string, unknown>
  paths?: Record<string, unknown>
  system?: SystemSettings
  /** The pointers of ref targets to give beside the schema components. */
  targets?: string[]
}

const parsedSchema = v.object({
  milliseconds: v.number(),
  schemas: v.record(v.string(), v.unknown()),
  issues: v.array(v.object({ level: v.string(), type: v.string(), message: v.string() }))
})

/**
 * Parses a document in its own process under a time and heap bound, and checks
 * that the parse takes less than a second: running out of memory cannot be
 * caught, and it would take the test run with it. Each schema is given as
 * `toJsonSchema` writes it, where only an intersection has an `allOf`, with the
 * keywords of refs and intersections that it leaves out.
 */
export const parseBounded = async ({ openapi, schemas, paths = {}, system, targets = [] }: ParseBoundedArgs) => {
  const document = { openapi, info: { title: 't', version: '1' }, paths, components: { schemas } }
  const { success, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '--no-check',
      '--allow-read',
      '--allow-env',
      '--v8-flags=--max-old-space-size=256',
      fromFileUrl(import.meta.resolve('./parseBoundedMain.ts')),
      JSON.stringify({ document, system, targets })
    ],
    signal: AbortSignal.timeout(20_000)
  }).output()

  assert(success, `The parse did not return: ${new TextDecoder().decode(stderr).slice(0, 500)}`)

  const result = v.parse(parsedSchema, JSON.parse(new TextDecoder().decode(stdout)))

  assert(result.milliseconds < 1000, `The parse took ${result.milliseconds} ms`)

  return result
}
