/**
 * `skmtc doctor` — active diagnostics for the SKMTC root and every
 * project in it. Always runs in strict (non-Ink) mode: this command
 * is squarely for agents and operators debugging a stuck setup, so
 * there's no interactive variant.
 *
 * Output:
 *   - `--json` → a {@link DoctorResult} JSON object
 *   - default  → human-readable summary, one line per check
 *
 * Exit code:
 *   - `0` if `summary === 'ok' | 'warning'`
 *   - `1` if any `error` check fired
 *
 * Doctor never exits 2 — that code is reserved for missing-input
 * recipe errors. A failed doctor check means "something is wrong
 * with the state", not "you called the command wrong".
 */

import { runDoctor, type Check, type DoctorResult } from '@/lib/doctor-headless.ts'
import { resolveOutputFormat } from '@/lib/strict-mode.ts'
import denoJson from '../deno.json' with { type: 'json' }

type RenderDoctorArgs = {
  jsonFlag?: boolean
  /** Skip the one check that reaches the network (`cli-version-current`),
   *  for a run that already knows it is offline and does not want to
   *  spend the lookup's timeout to be told so. */
  offlineFlag?: boolean
}

export const renderDoctor = async ({
  jsonFlag,
  offlineFlag
}: RenderDoctorArgs): Promise<void> => {
  const result = await runDoctor({
    cliVersion: denoJson.version,
    ...(offlineFlag ? { getLatestCliMeta: () => Promise.resolve(undefined) } : {})
  })
  printDoctorResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.summary === 'error' ? 1 : 0)
}

type PrintDoctorResultOptions = {
  format: 'text' | 'json'
}

export const printDoctorResult = (
  result: DoctorResult,
  { format }: PrintDoctorResultOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      console.log(`SKMTC doctor — summary: ${result.summary}`)
      console.log(`  CLI version:       ${result.cliVersion}`)
      console.log(`  SKMTC root:        ${result.skmtcRootPath}`)
      console.log(`  Global state dir:  ${result.globalStateDir}`)
      console.log(
        `  Projects (${result.projects.length}): ${result.projects.join(', ') || '(none)'}`
      )
      console.log('')
      for (const check of result.checks) {
        printCheckLine(check)
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

const printCheckLine = (check: Check): void => {
  const tag = tagFor(check.status)
  console.log(`${tag} [${check.id}] ${check.message}`)
  if (check.hint) {
    console.log(`    hint: ${check.hint}`)
  }
}

const tagFor = (status: Check['status']): string => {
  switch (status) {
    case 'ok':
      return '[ok]    '
    case 'warning':
      return '[warn]  '
    case 'error':
      return '[error] '
    case 'skipped':
      return '[skip]  '
    default: {
      const _exhaustive: never = status
      throw new Error(`Unhandled check status: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
