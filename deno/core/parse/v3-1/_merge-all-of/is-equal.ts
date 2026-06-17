export const isEqual = (first: unknown, second: unknown): boolean => {
  if (Array.isArray(first) && Array.isArray(second)) {
    if (first.length !== second.length) return false
    return first.every((value, index) => isEqual(value, second[index]))
  }

  if (
    typeof first === 'object' &&
    typeof second === 'object' &&
    first !== null &&
    second !== null
  ) {
    const aKeys = Object.keys(first)
    const bKeys = Object.keys(second)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(
      key =>
        bKeys.includes(key) &&
        isEqual((first as Record<string, unknown>)[key], (second as Record<string, unknown>)[key])
    )
  }

  return first === second
}
