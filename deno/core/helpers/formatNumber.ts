export const formatNumber = (value: number, locales: Intl.LocalesArgument = 'en-US'): string => {
  return value.toLocaleString(locales, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}
