import type { GenerateContext } from '../context/GenerateContext.js'
import { Definition } from '../dsl/Definition.js'
import { Identifier } from '../dsl/Identifier.js'
import type { TypeSystemObject } from '../types/TypeSystem.js'
import { FunctionParameter } from './FunctionParameter.js'
import { toPathTemplate } from './toPathTemplate.js'

type ConstructorArgs = {
  context: GenerateContext
  argName?: string
  typeName: string
  typeValue: TypeSystemObject
  pathTemplate: string
}

export class PathParams {
  context: GenerateContext
  typeDefinition: Definition<TypeSystemObject>
  parameter: FunctionParameter
  path: string

  constructor({
    context,
    argName,
    typeName,
    typeValue,
    pathTemplate
  }: ConstructorArgs) {
    this.context = context

    this.typeDefinition = new Definition<TypeSystemObject>({
      context,
      identifier: Identifier.createType(typeName),
      value: typeValue
    })

    this.parameter = new FunctionParameter({
      name: argName,
      typeDefinition: this.typeDefinition,
      destructure: !argName,
      required: true
    })

    const queryArg =
      this.parameter.properties.type === 'regular'
        ? this.parameter.properties.name
        : undefined

    // @TODO Reconcile pathTemplate with params
    this.path = toPathTemplate(pathTemplate, queryArg)
  }
}
