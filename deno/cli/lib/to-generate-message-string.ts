import type { GenerationStats } from '@/lib/generationStats.ts'

const formatNumber = (value: number, locales: Intl.LocalesArgument = 'en-US'): string => {
  return value.toLocaleString(locales, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

export const toGenerateMessageString = (stats: GenerationStats): string => {
  const { files, tokens, totalTime, errors } = stats

  const success = `Generated ${formatNumber(tokens)} tokens, ${formatNumber(files)} files in ${formatNumber(totalTime)}ms.`

  return errors.length
    ? `${success}\n - ${formatNumber(errors.length)} errors detected - view runtime logs for details`
    : success
}
