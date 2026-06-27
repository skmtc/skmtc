import type { ClientSettings } from '@skmtc/core/Settings'
import type {
  EnrichmentDefaults,
  EnrichmentDescriptor,
  ParseIssue,
  SupportedSubjects
} from '@skmtc/core'
import { toDocumentInput } from '@/lib/document-input.ts'
import type { FileType } from '@/lib/types.ts'

/**
 * Host-side result of a `DESCRIBE` worker run — the read-only metadata
 * the preview rail needs, in the same shapes the hub runner returns
 * from `/subjects`, `/descriptors`, `/enrichment-defaults`.
 */
export type DescribeResponse = {
  subjects: SupportedSubjects
  descriptors: EnrichmentDescriptor[]
  enrichmentDefaults: EnrichmentDefaults
  parseIssues: ParseIssue[]
}

type DescribeWithWorkerArgs = {
  schemaContents: string
  /** File type of the schema source — drives OAS-vs-GQL document building. */
  fileType: FileType
  clientSettings: ClientSettings | undefined
  bundlePath: string
}

/**
 * Spawn the project's bundle worker and run a single `DESCRIBE` message.
 *
 * Mirrors {@link generateWithWorker} but for the read-only metadata
 * pass: no artifacts are produced and nothing is written to disk, so the
 * worker is spawned without `write` permission. On `READY` we post the
 * host-built `document` + `clientSettings`; the worker replies with one
 * `RESULT` carrying subjects + descriptors + defaults.
 */
export const describeWithWorker = ({
  schemaContents,
  fileType,
  clientSettings,
  bundlePath
}: DescribeWithWorkerArgs): Promise<DescribeResponse> => {
  const workerUrl = new URL(bundlePath, import.meta.url)

  const worker = new Worker(workerUrl.href, {
    type: 'module',
    deno: {
      permissions: {
        read: true,
        net: false,
        write: false,
        env: true,
        run: false
      }
    }
  })

  return new Promise((resolve, reject) => {
    worker.onmessage = async (e: MessageEvent) => {
      const { type } = e.data

      switch (type) {
        case 'READY': {
          const document = await toDocumentInput(schemaContents, fileType)
          worker.postMessage({
            type: 'DESCRIBE',
            payload: {
              document,
              clientSettings
            }
          })
          break
        }

        case 'RESULT': {
          worker.terminate()
          const { subjects, descriptors, enrichmentDefaults, parseIssues } = e.data
          resolve({ subjects, descriptors, enrichmentDefaults, parseIssues })
          break
        }

        case 'ERROR': {
          worker.terminate()
          reject(new Error(e.data.error ?? String(e.data)))
          break
        }
      }
    }

    worker.onerror = error => {
      reject(error)
    }
  })
}
