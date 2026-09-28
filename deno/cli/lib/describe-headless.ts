import type { Project } from '@/lib/project.ts'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { describeWithWorker, type DescribeResponse } from '@/lib/describe-worker.ts'

/** Describe result plus the project it was computed for. */
export type DescribeResult = DescribeResponse & {
  projectName: string
}

type DescribeHeadlessArgs = {
  project: Project
  /** Explicit schema override; falls back to `client.json#source`. */
  schemaSourceString: string | undefined
  /** URL of the `bundle.js` the caller has just built (see `createBundle`). */
  bundlePath: string
}

/**
 * Run the read-only `DESCRIBE` pass for a project: load the schema, then
 * spawn the project bundle to compute supported subjects, enrichment
 * descriptors, and enrichment defaults — the metadata a preview rail
 * needs, in the same shapes the hub runner produces.
 *
 * The caller builds the bundle and validates that a schema source is
 * present (see `commands/describe.ts`).
 */
export const describeHeadless = async ({
  project,
  schemaSourceString,
  bundlePath
}: DescribeHeadlessArgs): Promise<DescribeResult> => {
  const source = schemaSourceString ?? project.clientJson.contents?.source ?? ''
  const schemaContents = await toSchemaContents(source)

  const result = await describeWithWorker({
    schemaContents: schemaContents.contents,
    fileType: schemaContents.fileType,
    clientSettings: project.clientJson.contents?.settings,
    bundlePath
  })

  return { projectName: project.name, ...result }
}
