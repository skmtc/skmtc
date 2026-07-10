/**
 * `skmtc compact <project>` — rewrite a project's `client.json` in the
 * compact (minified + string-interned) on-disk form. `--expand` restores
 * the human-readable form.
 *
 * The compact form is a machine-focused representation gated by a
 * top-level `compact: true` flag; the CLI reads either form transparently
 * (it expands compact files before validating). The conversion is a pure,
 * lossless format toggle — nothing but whitespace and string encoding
 * changes. See `@skmtc/core/ClientJsonCompact`.
 */

import { compactHeadless, type CompactHeadlessResult } from '@/lib/compact-headless.ts'
import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'

type RenderCompactArgs = {
  projectName: string | undefined
  expandFlag?: boolean
  jsonFlag?: boolean
}

export const renderCompact = async ({
  projectName,
  expandFlag,
  jsonFlag
}: RenderCompactArgs): Promise<void> => {
  if (projectName === undefined) {
    return failWithRecipe({
      command: 'compact',
      arg: '<project>',
      usage: 'skmtc compact <project> [--expand]',
      example: 'skmtc compact my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const result = await compactHeadless({ projectName, expand: expandFlag ?? false })

  printCompactResult(result, { format: resolveOutputFormat({ jsonFlag }) })
}

type PrintOptions = {
  format: 'text' | 'json'
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

const printCompactResult = (
  result: CompactHeadlessResult,
  { format }: PrintOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      const form = result.toCompact ? 'compact' : 'expanded'

      if (result.missing) {
        console.log(
          `Nothing to convert — ${result.clientJsonPath} does not exist.`
        )
        return
      }

      if (!result.changed) {
        console.log(`No change — client.json is already ${form}.`)
        return
      }

      const delta = result.beforeBytes - result.afterBytes
      const pct = result.beforeBytes === 0
        ? 0
        : Math.round((100 * delta) / result.beforeBytes)

      console.log(`Rewrote ${result.clientJsonPath} in ${form} form.`)
      console.log(
        `  ${formatBytes(result.beforeBytes)} → ${formatBytes(result.afterBytes)} ` +
          `(${delta >= 0 ? '−' : '+'}${Math.abs(pct)}%)`
      )
      if (result.toCompact && delta <= 0) {
        console.log(
          '  Note: this file is small enough that compaction does not save space; ' +
            'the pool overhead exceeds the dedup gain.'
        )
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
