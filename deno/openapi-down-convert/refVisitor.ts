/**
 * Recursive traversal helpers for OpenAPI documents.
 *
 * These functions walk a parsed OpenAPI document and apply transformations to
 * JSON Schema objects and JSON Reference (`$ref`) objects in place.
 */

import { Converter } from './converter.ts'

/** Any JSON value that can appear within an OpenAPI document. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject

/** A JSON object node within an OpenAPI document. */
export interface JsonObject {
  [key: string]: JsonValue
}

/** A node within the OpenAPI document. */
export type JsonNode = JsonValue

/** A JSON Schema object in an API definition. */
export type SchemaObject = JsonObject

/**
 * A JSON Reference object, such as
 * `{ "$ref": "#/components/schemas/problemResponse" }`.
 *
 * Modelled as a plain {@link JsonObject} because transforms freely add and
 * delete sibling keys (including `$ref` itself) while rewriting references.
 */
export type RefObject = JsonObject

/** Callback signature for {@link visitRefObjects}. */
export type RefVisitor = (node: RefObject) => JsonNode

/** Callback signature for {@link visitSchemaObjects}. */
export type SchemaVisitor = (node: SchemaObject) => SchemaObject

/** Callback signature for {@link walkObject}. */
export type ObjectVisitor = (node: JsonObject) => JsonNode

/** Test whether a JSON value is a plain object (not `null`, not an array). */
export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Test whether a JSON node is a `{ $ref: "uri" }` reference object. */
export function isRef(node: JsonObject): boolean {
  return Object.hasOwn(node, '$ref') && typeof node['$ref'] === 'string'
}

/**
 * Walk a JSON object and apply `schemaCallback` when a JSON schema is found.
 *
 * JSON Schema objects are items in `components/schemas` or in an item named
 * `schema`.
 *
 * @param node a node in the OpenAPI document
 * @param schemaCallback the function to call on JSON schema objects
 * @returns the modified (annotated) node
 */
export function visitSchemaObjects(node: JsonObject, schemaCallback: SchemaVisitor): JsonNode {
  const objectVisitor = (node: JsonObject): JsonNode => {
    if (Object.hasOwn(node, 'schema')) {
      const schema = node['schema']
      if (isJsonObject(schema)) {
        node['schema'] = schemaCallback(schema)
      }
    } else if (Object.hasOwn(node, 'schemas')) {
      const schemas = node['schemas']
      if (isJsonObject(schemas)) {
        for (const schemaName in schemas) {
          const schema = schemas[schemaName]
          if (isJsonObject(schema)) {
            const newSchema = schemaCallback(schema)
            schemas[schemaName] = newSchema
            // Tag the schema so other visitors recognise it as a schema $ref.
            Converter.tagObjectAsSchemaRef(newSchema)
          }
        }
      }
    }
    return node
  }
  return walkObject(node, objectVisitor)
}

/**
 * Walk a JSON object and apply `refCallback` when a `{ $ref: url }` is found.
 *
 * @param node a node in the OpenAPI document
 * @param refCallback the function to call on JSON `$ref` objects
 * @returns the modified (annotated) node
 */
export function visitRefObjects(node: JsonObject, refCallback: RefVisitor): JsonNode {
  const objectVisitor = (node: JsonObject): JsonNode => {
    if (isRef(node)) {
      return refCallback(node)
    }
    return node
  }
  return walkObject(node, objectVisitor)
}

/**
 * Walk a JSON object or array and apply `objectCallback` to every object found.
 *
 * @param node a node in the OpenAPI document
 * @param objectCallback the function to call on JSON objects
 * @returns the modified (annotated) node
 */
export function walkObject(
  node: JsonObject | JsonValue[],
  objectCallback: ObjectVisitor
): JsonNode {
  if (Array.isArray(node)) {
    return walkArray(node)
  }
  return walkObj(node)

  function walkObj(node: JsonObject): JsonNode {
    const result = objectCallback(node)
    if (isJsonObject(result)) {
      // Copy the keys since the callback may re-enter and mutate the object.
      for (const key of [...Object.keys(node)]) {
        const value = node[key]
        if (Array.isArray(value)) {
          node[key] = walkArray(value)
        } else if (value !== null && typeof value === 'object') {
          node[key] = walkObj(value)
        }
      }
    }
    return result
  }

  function walkArray(array: JsonValue[]): JsonValue[] {
    for (let index = 0; index < array.length; index += 1) {
      const value = array[index]
      if (Array.isArray(value)) {
        array[index] = walkArray(value)
      } else if (value !== null && typeof value === 'object') {
        array[index] = walkObj(value)
      }
    }
    return array
  }
}
