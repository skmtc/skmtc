import { existsSync } from '@std/fs/exists'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { describeHeadless, type DescribeResult } from '@/lib/describe-headless.ts'
import { toBundleFsPath } from '@/lib/to-bundle-path.ts'

type RenderDescribeArgs = {
  projectName: string | undefined
  schemaSourceString?: string | undefined
  jsonFlag?: boolean
  // Optional dependency for testing.
  skmtcRoot?: SkmtcRoot
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
 * `<project>` arg is required up front (recipe error otherwise), and the
 * project must have been bundled (`skmtc bundle <project>`).
 */
export const renderDescribe = async ({
  projectName,
  schemaSourceString,
  jsonFlag,
  skmtcRoot: providedSkmtcRoot
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

  // describe runs the project bundle to read generator capabilities — a
  // missing bundle is a precondition failure, not a bad argument, so it
  // exits 1 with a build hint rather than a recipe error.
  if (!existsSync(toBundleFsPath(project.toPath()))) {
    console.error(
      `Error: no bundle for "${projectName}". Run \`skmtc bundle ${projectName}\` ` +
        `first — describe runs the project bundle to read generator capabilities.`
    )
    await skmtcRoot.manager.cleanup()
    Deno.exit(1)
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

  // The bundle runs the engine's read-only metadata pass. The dominant
  // failure is a core-version skew between the worker and the project's
  // generators (e.g. a generator built against an older `@skmtc/core`
  // lacks entry methods the trio calls) — surface it as a clean exit 1
  // instead of an uncaught worker rejection.
  const result = await describeHeadless({ project, schemaSourceString }).catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Error: describe failed for "${projectName}": ${message}\n` +
        `If this is a "not a function" error, the project's generators were built ` +
        `against a different @skmtc/core than the worker — rebundle the project ` +
        `(\`skmtc bundle ${projectName}\`) against version-aligned generators.`
    )
    return null
  })

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
          `  ${descriptor.generator} (${descriptor.subjectKind}${variants}) — ${descriptor.fields.length} field(s)`
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
