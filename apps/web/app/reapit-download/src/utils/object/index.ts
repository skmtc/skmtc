export const nonNullableObject = <Input extends Object | undefined, Output>(object: Input) => {
  if (!object) return {} as Output
  return Object.keys(object).reduce<Output>((acc, key) => {
    const item = object[key]

    if (Array.isArray(item) && !item.length) {
      return acc
    }

    if (item !== null) {
      acc[key] = item
    }
    return acc
  }, {} as Output)
}
