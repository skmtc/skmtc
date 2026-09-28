import type { ClientSettings } from '@skmtc/core/Settings'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import type { ReadOnlyBundle } from '@/lib/create-bundle.ts'

/**
 * Resolves the schema and renders this run's fresh artifact set — the
 * same schema-resolution + worker invocation `generate` uses — for
 * callers that want live canonical content on demand instead of a
 * persisted cache. A local project's bundle is built first, outside the
 * project (see `createReadOnlyBundle`), so what renders is the generator
 * code the project has now and nothing in the project is written.
 *
 * Returns `null` on any failure (no configured source, unreachable
 * source, no way to build, failed build, worker error) rather than
 * throwing. This is the choke point that keeps `status`/`clean` safe
 * to run any time — including before a project has ever been
 * generated, or offline — at the cost of degrading to lock-hash-only
 * comparison in that case.
 */
export const resolveFreshArtifacts = async ({
  schemaSourceString,
  clientSettings,
  stackUrl,
  buildBundle
}: {
  schemaSourceString: string | undefined
  clientSettings: ClientSettings | undefined
  stackUrl: string | undefined
  /**
   * Builds the project's bundle without writing to the project. Without
   * it a local project renders nothing.
   */
  buildBundle: (() => Promise<ReadOnlyBundle>) | undefined
}): Promise<Record<string, string> | null> => {
  if (!schemaSourceString) {
    return null
  }

  try {
    // Resolve the schema before building, so an unreachable source costs
    // no build.
    const schemaContents = await toSchemaContents(schemaSourceString)

    // A stack server renders remotely; a local project needs its bundle.
    await using bundle = stackUrl ? undefined : await buildBundle?.()
    if (!stackUrl && bundle === undefined) {
      return null
    }

    const { artifacts } = await GenerateArtifacts.generateWithWorker({
      bundlePath: bundle?.bundlePath,
      schemaContents: schemaContents.contents,
      fileType: schemaContents.fileType,
      clientSettings,
      stackUrl
    })

    return artifacts
  } catch (_error) {
    return null
  }
}
