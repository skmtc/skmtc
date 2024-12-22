import { EntityType } from './EntityType.js'

type ConstructorArgs = {
  name: string
  typeName?: string
  entityType: EntityType
}

export class Identifier {
  name: string
  entityType: EntityType
  typeName?: string

  private constructor({ name, typeName, entityType }: ConstructorArgs) {
    this.name = name
    this.typeName = typeName
    this.entityType = entityType
  }

  static createVariable(name: string, typeName?: string): Identifier {
    if (typeName) {
      return new Identifier({
        name,
        typeName,
        entityType: new EntityType('variable')
      })
    }

    return new Identifier({
      name,
      entityType: new EntityType('variable')
    })
  }

  static createType(name: string): Identifier {
    return new Identifier({
      name,
      entityType: new EntityType('type')
    })
  }

  toString(): string {
    return this.name
  }
}
