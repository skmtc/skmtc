/**
 * What core parses a document to, as JSON Schema that a validator can read.
 *
 * Run as a program it parses the document on its standard input, and prints
 * the result as JSON: {@link parseInProcess} starts it so, because running out
 * of memory cannot be caught.
 */

import { fromFileUrl } from '@std/path'
import * as log from '@std/log'
import { type OasRef, type OasSchema, ParseContext, StackTrail } from '@skmtc/core'
import { isRecord } from './api-surface.ts'
import { mapSchemas } from './openapi-grid-rules.ts'

/** The keywords that describe a value and do not change which values are valid. */
export const ANNOTATIONS = [
  'default',
  'readOnly',
  'deprecated',
  'description',
  'externalDocs'
] as const

export type Annotation = (typeof ANNOTATIONS)[number]

export type CoreSchema = {
  /** What it parsed to: `ref`, `object`, `intersection`, … */
  form: string
  /** The schema as core reads it: `nullable` allows `null` whatever is beside it. */
  json: Record<string, unknown>
  /** The annotations at the site. */
  annotations: Annotation[]
}

export type CoreDocument = {
  /** The schema components that are left. */
  schemas: Record<string, CoreSchema>
  issues: { type: string; location: string }[]
}

type Schema = OasSchema | OasRef<'schema'>

const toProperties = (properties: Record<string, Schema>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(properties).map(([name, property]) => [name, toCoreJson(property)])
  )

const toAdditionalProperties = (
  additionalProperties: boolean | Schema | null | undefined
): unknown =>
  typeof additionalProperties === 'object' && additionalProperties !== null
    ? toCoreJson(additionalProperties)
    : (additionalProperties ?? undefined)

/**
 * A parsed schema as JSON, as `core/test/parseBoundedMain.ts` writes it, with
 * these differences:
 * - an object that says nothing about other properties stays open, where
 *   `toJsonSchema` writes `additionalProperties: false`;
 * - a ref with keywords that change its values is the schema at its site
 *   (`resolve()`), so without the keywords that core leaves out there;
 * - a union is an `anyOf`: core does not keep which of the two it was.
 */
export const toCoreJson = (schema: Schema): Record<string, unknown> => {
  if (schema.isRef()) {
    return schema.hasValueSiblings()
      ? toCoreJson(schema.resolve())
      : { $ref: schema.$ref, nullable: schema.nullable }
  }

  switch (schema.type) {
    case 'object': {
      const { nullable, properties, required, enums, minProperties, maxProperties } = schema
      const schemas = Object.entries(properties ?? {}).flatMap(
        ([name, property]): [string, Schema][] =>
          property.type === 'custom' ? [] : [[name, property]]
      )

      return {
        type: 'object',
        nullable,
        properties: toProperties(Object.fromEntries(schemas)),
        required,
        enum: enums,
        minProperties,
        maxProperties,
        additionalProperties: toAdditionalProperties(schema.additionalProperties)
      }
    }
    case 'array':
      return { ...schema.toJsonSchema({ resolve: false }), items: toCoreJson(schema.items) }
    case 'union':
      return { nullable: schema.nullable, anyOf: schema.members.map(toCoreJson) }
    case 'intersection':
      return { nullable: schema.nullable, allOf: schema.members.map(toCoreJson) }
    case 'unknown':
      return {}
    default:
      return { ...schema.toJsonSchema({ resolve: false }) }
  }
}

/** Whether the site has the annotation: on the schema, on a member that each value matches, or on every member of a union. */
const hasAnnotation = (schema: Schema, annotation: Annotation): boolean => {
  if (schema.isRef() && schema.toSkippedSiblings().includes(annotation)) {
    return false
  }

  const key = annotation === 'default' && schema.type === 'array' ? 'defaultValue' : annotation
  const value: unknown = Reflect.get(schema, key)

  if (value !== undefined && value !== false) {
    return true
  }

  if (schema.isRef()) {
    return false
  }

  switch (schema.type) {
    case 'intersection':
      return schema.members.some(member => hasAnnotation(member, annotation))
    case 'union':
      return schema.members.every(member => hasAnnotation(member, annotation))
    default:
      return false
  }
}

export const toCoreSchema = (schema: Schema): CoreSchema => ({
  form: schema.type,
  json: toCoreJson(schema),
  annotations: ANNOTATIONS.filter(annotation => hasAnnotation(schema, annotation))
})

type ParseArgs = ConstructorParameters<typeof ParseContext>[0]['input']

const parse = (input: ParseArgs): CoreDocument => {
  const context = new ParseContext({
    input,
    logger: new log.Logger('openapi-grid', 'ERROR'),
    silent: true
  })
  const parsed = context.parse(new StackTrail(['TEST']))

  if (parsed.type !== 'oas') {
    throw new Error('expected an OpenAPI document')
  }

  const schemas = Object.entries(parsed.value.components?.schemas ?? {})

  return {
    schemas: Object.fromEntries(schemas.map(([name, schema]) => [name, toCoreSchema(schema)])),
    issues: context.issues.map(({ type, location }) => ({ type, location }))
  }
}

/**
 * A schema of {@link toCoreJson} as 2020-12. Core reads `nullable` as "or
 * null" whatever else the schema says, so it is a branch of its own.
 */
export const translateCore = (schema: unknown): unknown => {
  if (!isRecord(schema)) {
    return schema
  }

  const { nullable, $ref, minimum, maximum, exclusiveMinimum, exclusiveMaximum, ...rest } = schema
  const keywords = Object.fromEntries(
    Object.entries({
      ...mapSchemas(rest, translateCore),
      $ref:
        typeof $ref === 'string' ? $ref.replace('#/components/schemas/', '#/$defs/') : undefined,
      [exclusiveMinimum === true ? 'exclusiveMinimum' : 'minimum']: minimum,
      [exclusiveMaximum === true ? 'exclusiveMaximum' : 'maximum']: maximum
    }).filter(([_key, value]) => value !== undefined)
  )

  return nullable === true ? { anyOf: [keywords, { type: 'null' }] } : keywords
}

const isCoreDocument = (value: unknown): value is CoreDocument =>
  isRecord(value) && isRecord(value.schemas) && Array.isArray(value.issues)

type ParseInProcessArgs = { document: unknown; timeout?: number }

/**
 * What core parses the document to, in a process of its own with bounded time
 * and memory. `undefined` when the parse does not return.
 */
export const parseInProcess = async ({
  document,
  timeout = 20_000
}: ParseInProcessArgs): Promise<CoreDocument | undefined> => {
  const process = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '--no-check',
      '--allow-read',
      '--allow-env',
      '--v8-flags=--max-old-space-size=512',
      fromFileUrl(import.meta.url)
    ],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'null',
    signal: AbortSignal.timeout(timeout)
  }).spawn()

  // A process that is stopped before it has read the document breaks the pipe.
  const written = new Response(JSON.stringify(document)).body
    ?.pipeTo(process.stdin)
    .catch(() => undefined)
  const [{ success, stdout }] = await Promise.all([process.output(), written])

  if (!success) {
    return undefined
  }

  const result: unknown = JSON.parse(new TextDecoder().decode(stdout))

  if (!isCoreDocument(result)) {
    throw new Error('the parse process printed something else')
  }

  return result
}

if (import.meta.main) {
  const document = JSON.parse(await new Response(Deno.stdin.readable).text())

  console.log(JSON.stringify(parse({ type: 'oas', value: document })))
}
