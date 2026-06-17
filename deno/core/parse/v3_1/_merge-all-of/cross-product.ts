import type { SchemaOrReference } from './types.ts'

export const crossProduct = (a: SchemaOrReference[], b: SchemaOrReference[]) => {
  return a.reduce<[SchemaOrReference, SchemaOrReference][]>(
    (acc, x) => [...acc, ...b.map((y): [SchemaOrReference, SchemaOrReference] => [x, y])],
    []
  )
}
