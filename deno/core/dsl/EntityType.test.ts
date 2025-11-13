import { assertEquals, assertThrows } from '@std/assert'
import { EntityType } from '@/dsl/EntityType.ts'

Deno.test('EntityType', async (t) => {
  await t.step('constructor and type property', async (t) => {
    await t.step('should create variable entity type', () => {
      const entity = new EntityType('variable')
      assertEquals(entity.type, 'variable')
    })

    await t.step('should create type entity type', () => {
      const entity = new EntityType('type')
      assertEquals(entity.type, 'type')
    })
  })

  await t.step('toString() method', async (t) => {
    await t.step('should return "const" for variable entity type', () => {
      const entity = new EntityType('variable')
      assertEquals(entity.toString(), 'const')
    })

    await t.step('should return "type" for type entity type', () => {
      const entity = new EntityType('type')
      assertEquals(entity.toString(), 'type')
    })

    await t.step('should throw error for invalid entity type', () => {
      // Create an entity with an invalid type by bypassing TypeScript
      const entity = new EntityType('variable')
      // Force an invalid type to test the exhaustiveness check
      Object.defineProperty(entity, 'type', {
        value: 'invalid',
        writable: true,
      })

      assertThrows(
        () => entity.toString(),
        Error,
        'Unhandled entity type: invalid',
      )
    })
  })

  await t.step('integration scenarios', async (t) => {
    await t.step('should handle multiple instances independently', () => {
      const varEntity = new EntityType('variable')
      const typeEntity = new EntityType('type')
      const anotherVarEntity = new EntityType('variable')

      assertEquals(varEntity.toString(), 'const')
      assertEquals(typeEntity.toString(), 'type')
      assertEquals(anotherVarEntity.toString(), 'const')
    })

    await t.step('should be usable in template strings', () => {
      const varEntity = new EntityType('variable')
      const typeEntity = new EntityType('type')

      const varDeclaration = `${varEntity} myVariable = 'value';`
      const typeDeclaration = `${typeEntity} MyType = string;`

      assertEquals(varDeclaration, "const myVariable = 'value';")
      assertEquals(typeDeclaration, 'type MyType = string;')
    })
  })
})
