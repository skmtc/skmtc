export const isEmpty = (value: Record<string, any>): boolean => {
  return Object.keys(value).length === 0
}
