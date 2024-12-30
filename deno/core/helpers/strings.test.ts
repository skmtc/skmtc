import { assertEquals } from 'jsr:@std/assert@^1.0.10'
import { camelCase } from './strings.ts'

Deno.test('camelCase removes trailing non-alphanumeric characters', () => {
  const camelCased = camelCase('/products/{id}')

  assertEquals(camelCased, 'productsId')
})

Deno.test('camelCase capitalises first letter of complex string when upperFirst is true', () => {
  const camelCased = camelCase('/products/{id}/items/{itemId}', { upperFirst: true })

  assertEquals(camelCased, 'ProductsIdItemsItemId')
})

Deno.test('camelCase capitalises first letter of simple string when upperFirst is true', () => {
  const camelCased = camelCase('products', { upperFirst: true })

  assertEquals(camelCased, 'Products')
})
