import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe } from '@/lib/strict-mode.ts'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { toDocumentInput } from '@/lib/document-input.ts'
import { toWorkerPath } from '@/lib/to-worker-path.ts'
import { runDebugSession } from '@/lib/debug-session.ts'

type RenderDebugArgs = {
  projectName: string | undefined
  schemaSourceString?: string | undefined
  autoFlag?: boolean
  port?: number
  // Optional dependency for testing.
  skmtcRoot?: SkmtcRoot
}

/**
 * `debug` runs a project's `worker.ts` **source** under the V8 inspector so a
 * debugger can set breakpoints in generator code and step through a real run.
 *
 * Unlike `describe` / `generate` (which run the compiled `bundle.js` in-process),
 * `debug` spawns a `deno run --config <project>/deno.json` subprocess that runs
 * `worker.ts` source: the project import map resolves core + the local `gen-*`
 * clones, and each generator `.ts` loads as its own module so breakpoints bind
 * 1:1 with no bundle and no source maps. The worker self-registers with the
 * inspector (`@skmtc/worker`'s `SKMTC_DEBUG_INSPECTOR` hook) and relays its URL;
 * we post `GENERATE` only after the debugger attaches (or immediately with
 * `--auto`).
 */
export const renderDebug = async ({
  projectName,
  schemaSourceString,
  autoFlag,
  port,
  skmtcRoot: providedSkmtcRoot
}: RenderDebugArgs) => {
  if (projectName === undefined) {
    return failWithRecipe({
      command: 'debug',
      arg: '<project>',
      usage: 'skmtc debug <project>',
      example: 'skmtc debug my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'debug',
      arg: '<project>',
      usage: 'skmtc debug <project>',
      example: 'skmtc debug my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const source = schemaSourceString ?? project.clientJson.contents?.source

  if (typeof source !== 'string' || source.length === 0) {
    return failWithRecipe({
      command: 'debug',
      arg: '[schema]',
      usage: 'skmtc debug <project> [schema]',
      example: 'skmtc debug my-api ./openapi.json',
      discover: 'set client.json#source, or pass the schema path/URL as the second arg'
    })
  }

  // Build the GENERATE payload host-side exactly as `generate` does — load the
  // schema and normalize Swagger 2 / OAS 3.1 → 3.0 so the worker receives a
  // clone-safe document.
  const schemaContents = await toSchemaContents(source)
  const document = await toDocumentInput(schemaContents.contents, schemaContents.fileType)
  const clientSettings = project.clientJson.contents?.settings

  const exitCode = await runDebugSession({
    projectPath: project.toPath(),
    workerHref: toWorkerPath(project.toPath()),
    generateMessage: {
      type: 'GENERATE',
      payload: {
        document,
        clientSettings,
        inspect: true,
        // Emit per-file gen-maps sidecars so the extension can show per-byte schema
        // provenance. Worker-side post-pass (no oxc): landmarks come from Definition
        // identifiers; byte ranges + schema pointers are exact.
        attribution: { postPass: { schemaSrc: source } }
      }
    },
    auto: autoFlag ?? false,
    port: port ?? 9345
  })

  await skmtcRoot.manager.cleanup()
  Deno.exit(exitCode)
}
