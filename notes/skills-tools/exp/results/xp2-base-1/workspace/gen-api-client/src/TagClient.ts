import type { EmptyEnrichments, OasOperationProjectionConstructorArgs } from '@skmtc/core'
import { TsClass, TsConstructor } from '@skmtc/lang-typescript'
import { TagClientBase } from './base.ts'
import { toClientMethod } from './toClientMethod.ts'
import { toTag } from './naming.ts'

/**
 * One class per tag. The first operation of a tag constructs the whole
 * client: every operation sharing the tag becomes a method, so the class
 * and its file exist exactly once regardless of how many operations the
 * tag has (the entry's transform skips tags that already have a definition).
 */
export class TagClient extends TagClientBase {
  value: TsClass

  constructor(args: OasOperationProjectionConstructorArgs<EmptyEnrichments>) {
    super(args)

    this.value = new TsClass({
      classConstructor: new TsConstructor({ parameters: ['private baseUrl: string'] })
    })

    const { document } = this.context

    if (document.type !== 'oas') {
      throw new Error('@exp/gen-api-client only supports OpenAPI documents')
    }

    const tag = toTag(args.operation)

    document.value.operations
      .filter(operation => toTag(operation) === tag)
      .forEach(operation => {
        this.value.addMethod(
          toClientMethod({
            context: this.context,
            operation,
            destinationPath: this.settings.exportPath
          })
        )
      })
  }

  override toString(): string {
    return `${this.value}`
  }
}
