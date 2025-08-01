import type { OasRef } from '../oas/ref/Ref.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import { match } from 'ts-pattern'
import { isEmpty } from './isEmpty.ts'

type CollatedExampleArgs = {
  objectSchema: OasSchema | OasRef<'schema'> | undefined
  depth: number
}

export const collateExamples = ({ objectSchema, depth }: CollatedExampleArgs): unknown => {
  if (!objectSchema) {
    return undefined
  }

  if (depth > 15) {
    throw new Error('Depth limit reached')
  }

  const result = match(objectSchema)
    .with({ type: 'ref' }, matched => {
      return collateExamples({
        objectSchema: matched.resolve(),
        depth: depth + 1
      })
    })
    .with({ type: 'object' }, matched => {
      if (matched.example) {
        return matched.example
      }

      const output: Record<string, any> = {}

      Object.entries(matched.properties ?? {}).forEach(([key, value]) => {
        if (value.type === 'custom') {
          return
        }

        const propertyExample = collateExamples({
          objectSchema: value,
          depth: depth + 1
        })

        if (propertyExample) {
          output[key] = propertyExample
        }
      })

      return isEmpty(output) ? undefined : output
    })
    .with({ type: 'array' }, matched => {
      if (matched.example) {
        return matched.example
      }

      const itemsExample = collateExamples({
        objectSchema: matched.items,
        depth: depth + 1
      })

      return itemsExample ? [itemsExample] : undefined
    })
    .with({ type: 'string' }, ({ example }) => example)
    .with({ type: 'number' }, ({ example }) => example)
    .with({ type: 'integer' }, ({ example }) => example)
    .with({ type: 'boolean' }, ({ example }) => example)
    .with({ type: 'unknown' }, ({ example }) => example)
    .with({ type: 'union' }, ({ members }) => {
      for (const member of members) {
        const unionExample = collateExamples({
          objectSchema: member,
          depth: depth + 1
        })

        if (unionExample) {
          return unionExample
        }
      }
    })
    .exhaustive()

  return result
}
