export const uniqueArray = <T>(array: T[]): T[] =>
  Array.from(new Set(array.map((values) => JSON.stringify(values)))).map((values) => JSON.parse(values))
