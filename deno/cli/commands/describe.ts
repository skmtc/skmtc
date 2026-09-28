import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { describeHeadless, type DescribeResult } from '@/lib/describe-headless.ts'
import { createReadOnlyBundle, type ReadOnlyBundle } from '@/lib/create-bundle.ts'
import type { Project } from '@/lib/project.ts'

type RenderDescribeArgs = {
  projectName: string | undefined
  schemaSourceString?: string | undefined
  jsonFlag?: boolean
  // Optional dependencies for testing.
  skmtcRoot?: SkmtcRoot
  buildBundleFn?: (project: Project) => Promise<ReadOnlyBundle>
}

/**
 * `describe` runs a project's bundle in read-only mode to report the
 * preview-rail metadata: which subjects (operations / models) each
 * generator supports, the form-renderable enrichment descriptors, and
 * the schema-derived enrichment defaults. It is the local twin of the
 * hub runner's `supportedSubjects` / `enrichmentDescriptors` /
 * `enrichmentDefaults` RPCs — same `@skmtc/core` calls, same shapes.
 *
 * Like `doctor` / `agent-context` / `clean` it has no Ink variant — it
 * always runs headless and emits a text or `--json` result. The
 * `<project>` arg is required up front (recipe error otherwise). It
 * builds the project's bundle outside the project before running it
 * (see `createReadOnlyBundle`), so it writes nothing to the project.
 */
export const renderDescribe = async ({
  projectName,
  schemaSourceString,
  jsonFlag,
  skmtcRoot: providedSkmtcRoot,
  buildBundleFn = project =>
    createReadOnlyBundle({ projectName: project.name, projectPath: project.toPath() })
}: RenderDescribeArgs) => {
  if (projectName === undefined) {
    return failWithRecipe({
      command: 'describe',
      arg: '<project>',
      usage: 'skmtc describe <project>',
      example: 'skmtc describe my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'describe',
      arg: '<project>',
      usage: 'skmtc describe <project>',
      example: 'skmtc describe my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const source = schemaSourceString ?? project.clientJson.contents?.source

  if (typeof source !== 'string' || source.length === 0) {
    return failWithRecipe({
      command: 'describe',
      arg: '[schema]',
      usage: 'skmtc describe <project> [schema]',
      example: 'skmtc describe my-api ./openapi.json',
      discover: 'set client.json#source, or pass the schema path/URL as the second arg'
    })
  }

  // describe runs the bundle to read generator capabilities, so it builds
  // one from the current pins and generator source first. A failed build
  // is a precondition failure, not a bad argument: exit 1, not a recipe.
  const bundle = await buildBundleFn(project).catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error: could not build the bundle for "${projectName}": ${message}`)
    return null
  })

  if (bundle === null) {
    await skmtcRoot.manager.cleanup()
    Deno.exit(1)
  }

  // The bundle runs the engine's read-only metadata pass. The dominant
  // failure is a core-version skew between the worker and the project's
  // generators (e.g. a generator built against an older `@skmtc/core`
  // lacks entry methods the trio calls) — surface it as a clean exit 1
  // instead of an uncaught worker rejection.
  //
  // The temporary bundle is deleted before any exit below, which would
  // skip a `using` disposal.
  const result = await describeHeadless({
    project,
    schemaSourceString,
    bundlePath: bundle.bundlePath
  })
    .catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `Error: describe failed for "${projectName}": ${message}\n` +
          `If this is a "not a function" error, the project's generators were built ` +
          `against a different @skmtc/core than the worker — align the @skmtc/core ` +
          `pins in the project's deno.json and run describe again.`
      )
      return null
    })
    .finally(() => bundle[Symbol.asyncDispose]())

  if (result === null) {
    await skmtcRoot.manager.cleanup()
    Deno.exit(1)
  }

  printDescribeResult(result, { format: resolveOutputFormat({ jsonFlag }) })

  await skmtcRoot.manager.cleanup()

  Deno.exit(0)
}

type PrintDescribeResultOptions = {
  format: 'text' | 'json'
}

export const printDescribeResult = (
  result: DescribeResult,
  { format }: PrintDescribeResultOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      const subjectGenerators = Object.keys(result.subjects).length
      console.log(
        `describe "${result.projectName}": ${result.descriptors.length} generator descriptor(s), ` +
          `${subjectGenerators} generator(s) with supported subjects.`
      )

      for (const descriptor of result.descriptors) {
        const variants = descriptor.supportsVariant ? ', variants' : ''
        console.log(
          `  ${descriptor.generator} (${descriptor.subjectType}${variants}) — ${descriptor.fields.length} field(s)`
        )
      }

      if (result.parseIssues.length > 0) {
        console.log(`  (${result.parseIssues.length} parse issue(s))`)
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
