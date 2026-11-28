import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasIntersection,
  TypeSystemValue,
} from '@skmtc/core'
import { toMyLibValue } from './MyLib.ts'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type MyLibIntersectionArgs = {
  context: GenerateContextType
  destinationPath: string
  intersectionSchema: OasIntersection
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class MyLibIntersection extends TsSnippet {
  type = 'intersection' as const
  members: TypeSystemValue[]
  modifiers: Modifiers

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      intersectionSchema,
      modifiers,
    }: MyLibIntersectionArgs,
  ) {
    super({
      context,
      generatorKey,
      stackTrail: intersectionSchema.stackTrail.clone(),
    })

    this.members = intersectionSchema.members.map((member) =>
      toMyLibValue({
        destinationPath,
        schema: member,
        required: true,
        context,
      })
    )

    this.modifiers = modifiers

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    const members = this.members.map((member) => `${member}`).join(', ')

    // SLOT(intersection): a value that matches every member.
    return applyModifiers(`${LIB}.intersection([${members}])`, this.modifiers)
  }
}
