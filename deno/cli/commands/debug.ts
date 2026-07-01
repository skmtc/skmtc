import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe } from '@/lib/strict-mode.ts'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { toDocumentInput } from '@/lib/document-input.ts'
import { runDebugSession } from '@/lib/debug-session.ts'

type RenderDebugArgs = {
  projectName: string | undefined
  schemaSourceString?: string | undefined
  autoFlag?: boolean
  // Optional dependency for testing.
  skmtcRoot?: SkmtcRoot
}

/**
 * `generate --debug` runs the generators **in a plain `deno --inspect-wait`
 * subprocess** so a debugger can set breakpoints in generator code and inspect the
 * live files map at each pause — the standard `node --inspect-brk` flow, no bespoke
 * handshake.
 *
 * Unlike normal `generate` (which runs the compiled `bundle.js` in a sandboxed
 * Worker), `--debug` spawns `deno run --config <project>/deno.json --inspect-wait`:
 * the project import map resolves core + the local `gen-*` clones, the harness
 * reconstructs the generator set and runs `toArtifacts` **in that isolate**, so
 * each generator `.ts` loads as its own module and breakpoints bind 1:1 with no
 * bundle and no source maps. Deno waits for the debugger to attach, then runs
 * (immediately with `--auto`).
 */
export const renderDebug = async ({
  projectName,
  schemaSourceString,
  autoFlag,
  skmtcRoot: providedSkmtcRoot
}: RenderDebugArgs) => {
  if (projectName === undefined) {
    return failWithRecipe({
      command: 'generate',
      arg: '<project>',
      usage: 'skmtc generate --debug <project>',
      example: 'skmtc generate --debug my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'generate',
      arg: '<project>',
      usage: 'skmtc generate --debug <project>',
      example: 'skmtc generate --debug my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const source = schemaSourceString ?? project.clientJson.contents?.source

  if (typeof source !== 'string' || source.length === 0) {
    return failWithRecipe({
      command: 'generate',
      arg: '[schema]',
      usage: 'skmtc generate --debug <project> [schema]',
      example: 'skmtc generate --debug my-api ./openapi.json',
      discover: 'set client.json#source, or pass the schema path/URL as the second arg'
    })
  }

  // Build the schema document host-side exactly as `generate` does — load the
  // schema and normalize Swagger 2 / OAS 3.1 → 3.0 to a clone-safe document.
  const schemaContents = await toSchemaContents(source)
  const document = await toDocumentInput(schemaContents.contents, schemaContents.fileType)
  const clientSettings = project.clientJson.contents?.settings

  const exitCode = await runDebugSession({
    projectPath: project.toPath(),
    document,
    clientSettings,
    auto: autoFlag ?? false
  })

  await skmtcRoot.manager.cleanup()
  Deno.exit(exitCode)
}
