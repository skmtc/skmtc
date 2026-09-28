import type { ClientSettings } from '@skmtc/core/Settings'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'

/**
 * Resolves the schema and renders this run's fresh artifact set — the
 * same schema-resolution + worker invocation `generate` uses — for
 * callers that want live canonical content on demand instead of a
 * persisted cache. A local project's `bundle.js` is rebuilt first, as
 * `generate` does, so what renders is the generator code the project
 * has now.
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
   * Builds the project's `bundle.js` and returns its URL. Without it a
   * local project renders nothing.
   */
  buildBundle: (() => Promise<string>) | undefined
}): Promise<Record<string, string> | null> => {
  if (!schemaSourceString) {
    return null
  }

  try {
    // A stack server renders remotely; a local project needs its bundle.
    const bundlePath = stackUrl ? '' : await buildBundle?.()
    if (bundlePath === undefined) {
      return null
    }

    const schemaContents = await toSchemaContents(schemaSourceString)

    const { artifacts } = await GenerateArtifacts.generateWithWorker({
      bundlePath,
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
