import type { ManifestContent } from '../types/Manifest.ts'
import type { ResultsItem, ResultType } from '../types/Results.ts'
import { match, P } from 'ts-pattern'
import { countTokens } from 'gpt-tokenizer'

type GenerationStatsArgs = {
  manifest: ManifestContent
  artifacts: Record<string, string>
}
export const toGenerationStats = ({ manifest, artifacts }: GenerationStatsArgs): { tokens: number; lines: number; totalTime: number; errors: string[][]; files: number } => {
  const tokens = toManifestTokens(artifacts)
  const lines = toManifestLines(manifest)
  const totalTime = toTotalTime(manifest)
  const errors = toManifestErrors(manifest.results)
  const files = Object.keys(artifacts).length

  return {
    tokens,
    lines,
    totalTime,
    errors,
    files
  }
}

export const toManifestTokens = (artifacts: Record<string, string>): number => {
  const { tokens } = Object.values(artifacts).reduce(
    (acc, artifact) => ({ tokens: acc.tokens + countTokens(artifact) }),
    { tokens: 0 }
  )

  return tokens
}

export const toManifestLines = (manifest: ManifestContent): number => {
  const { lines } = Object.values(manifest.files).reduce(
    (acc, file) => ({ lines: acc.lines + file.lines }),
    { lines: 0 }
  )

  return lines
}

export const toTotalTime = (manifest: ManifestContent): number => {
  const totalTime = manifest.endAt - manifest.startAt

  return totalTime
}

export const toManifestErrors = (results: ManifestContent['results']): string[][] => {
  const errors: string[][] = []

  Object.entries(results).map(([path, result]) => {
    return checkResult({ path: [path], result, errors })
  })

  return errors
}

type CheckResultArgs = {
  path: string[]
  result: ResultsItem | (ResultsItem | null)[] | ResultType
  errors: string[][]
}

export const checkResult = ({ path, result, errors }: CheckResultArgs): void => {
  match(result)
    .with(P.array(), matchedResult => {
      return matchedResult.map(item => {
        if (item !== null) {
          checkResult({ path, result: item, errors })
        }
      })
    })
    .with(P.string, matchedResult => {
      if (matchedResult === 'error') {
        errors.push(path)
      }
    })
    .with(P.nullish, matchedResult => {
      return checkResult({ path, result: matchedResult, errors })
    })
    .otherwise(matched => {
      if (typeof matched === 'object') {
        return Object.entries(matched).map(([key, value]) => {
          return checkResult({ path: [...path, key], result: value, errors })
        })
      } else {
        throw new Error('Invalid result type')
      }
    })
}
