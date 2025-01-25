
import { isIdentifierName } from '@babel/helper-validator-identifier'

import { camelCase } from 'lodash-es'
import { match, P } from 'ts-pattern'
import type { TypeSystemObject, TypeSystemValue, TypeSystemVoid } from '../types/TypeSystem.js'
import type { Definition } from '../dsl/Definition.js'
import { List } from './List.js'
import type { Stringable } from '../dsl/Stringable.js'

type FunctionParameterArgs = {
  name?: string
  typeDefinition: Definition<TypeSystemObject | TypeSystemVoid>
  destructure?: boolean
  required?: boolean
  skipEmpty?: boolean
}

type ParameterProperties = VoidParameter | DestructuredParameter | RegularParameter

type VoidParameter = {
  type: 'void'
}

type DestructuredParameter = {
  type: 'destructured'
  typeDefinition: Definition<TypeSystemObject>
  required: true
}

type RegularParameter = {
  type: 'regular'
  name: string
  typeDefinition: Definition<TypeSystemValue>
  required: boolean
}

export class FunctionParameter {
  properties: ParameterProperties
  skipEmpty?: boolean

  constructor(args: FunctionParameterArgs) {
    this.skipEmpty = args.skipEmpty

    if (args.typeDefinition.value.type === 'object') {
      this.properties = match(args)
        .with(
          { destructure: true, required: true },
          ({ typeDefinition, required }): DestructuredParameter => ({
            type: 'destructured' as const,
            typeDefinition: typeDefinition as Definition<TypeSystemObject>,
            required
          })
        )
        .with({ name: P.string }, ({ typeDefinition, name, required }) => ({
          type: 'regular' as const,
          name,
          typeDefinition: typeDefinition as Definition<TypeSystemObject>,
          required: required ?? false
        }))
        .otherwise(() => {
          throw new Error('Invalid FunctionParameter')
        })
    } else {
      this.properties = { type: 'void' }
    }
  }

  hasProperty(name: string): boolean {
    return match(this.properties)
      .with({ type: 'void' }, () => false)
      .with({ type: 'regular' }, ({ typeDefinition }) => {
        const { value } = typeDefinition
        return Boolean(value.type === 'object' && value.objectProperties?.properties[name])
      })
      .with({ type: 'destructured' }, ({ typeDefinition }) => {
        return Boolean(typeDefinition.value.objectProperties?.properties[name])
      })
      .exhaustive()
  }

  toPropertyList(): List {
    return match(this.properties)
      .with({ type: 'void' }, () => List.toEmpty())
      .with({ type: 'regular' }, ({ name }) => List.toSingle(name))
      .with({ type: 'destructured' }, ({ typeDefinition }) => {
        return List.fromKeys(typeDefinition.value.objectProperties?.properties).toObjectPlain()
      })
      .exhaustive()
  }

  toInbound(): string {
    return match(this.properties)
      .with({ type: 'void' }, () => '')
      .with({ type: 'regular' }, ({ name }) => `${name}`)
      .with({ type: 'destructured' }, ({ typeDefinition }) => {
        return toDestructured(typeDefinition).toString()
      })
      .exhaustive()
  }

  toString(): string {
    return match(this.properties)
      .with({ type: 'void' }, () => '')
      .with({ type: 'regular' }, ({ name, typeDefinition, required }) => {
        return `${name}${required ? '' : '?'}: ${typeDefinition.identifier}`
      })
      .with({ type: 'destructured' }, ({ typeDefinition }) => {
        if (this.skipEmpty) {
          const isEmpty =
            Object.keys(typeDefinition.value.objectProperties?.properties ?? {}).length === 0

          if (isEmpty) {
            return ''
          }
        }

        return List.toKeyValue(
          toDestructured(typeDefinition).toString(),
          typeDefinition.identifier
        ).toString()
      })
      .exhaustive()
  }
}

const toDestructured = (
  typeDefinition: Definition<TypeSystemObject>
): List<Stringable[], ', ', '{}'> => {
  return List.fromKeys(typeDefinition.value.objectProperties?.properties).toObject(key => {
    return isIdentifierName(key) ? key : List.toKeyValue(key, camelCase(key))
  })
}
