/** OpenAPI Down Convert — convert an OAS document from OAS 3.1 to OAS 3.0. */

import {
  isJsonObject,
  visitRefObjects,
  visitSchemaObjects,
  walkObject,
  type JsonNode,
  type JsonObject,
  type RefObject,
  type SchemaObject,
  type SchemaVisitor,
} from './refVisitor.ts'

/** Lightweight OAS document top-level fields. */
interface OpenAPI3 extends JsonObject {
  openapi: string
}

/** Options for the converter instantiation. */
export interface ConverterOptions {
  /** If `true`, log conversion transformations to stderr. */
  verbose?: boolean
  /**
   * If `true`, remove `id` values in schema examples, to bypass
   * [Spectral issue 2081](https://github.com/stoplightio/spectral/issues/2081).
   */
  deleteExampleWithId?: boolean
  /** If `true`, replace a `$ref` object that has siblings with an `allOf`. */
  allOfTransform?: boolean
  /** The `authorizationUrl` for the `openIdConnect` -> `oauth2` transformation. */
  authorizationUrl?: string
  /** The `tokenUrl` for the `openIdConnect` -> `oauth2` transformation. */
  tokenUrl?: string
  /**
   * If `true`, convert the `openIdConnect` security scheme to `oauth2`. Some
   * tools (even those which purport to support OAS 3.0) do not process the
   * `openIdConnect` security scheme.
   */
  convertOpenIdConnectToOAuth2?: boolean
  /**
   * Scope descriptions for the `openIdConnect` -> `oauth2` transformation: a
   * simple map in the format `{ scope1: "description of scope1", ... }`. Passed
   * as data (not a file path) so the converter stays free of filesystem I/O and
   * remains bundler/Workers-portable; callers load the file themselves.
   */
  scopeDescriptions?: JsonObject
  /**
   * Earlier versions of the tool converted `$comment` to `x-comment` in JSON
   * Schemas. The tool now deletes `$comment` values by default. Use this
   * option to preserve the conversion and not delete comments.
   */
  convertSchemaComments?: boolean
}

/** Converts an OpenAPI 3.1 document to OpenAPI 3.0. */
export class Converter {
  private openapi30: OpenAPI3
  private verbose = false
  private deleteExampleWithId = false
  private allOfTransform = false
  private authorizationUrl: string
  private tokenUrl: string
  private scopeDescriptions: JsonObject = {}
  private convertSchemaComments = false
  private returnCode = 0
  private convertOpenIdConnectToOAuth2: boolean

  /** A tag used to temporarily mark schema `$ref` objects inside schema objects. */
  public static SCHEMA_REF_TAG: string = 'x-openapi-down-convert-schema-ref'

  /** HTTP methods recognised on a path item. */
  public static readonly HTTP_METHODS: readonly string[] = [
    'delete',
    'get',
    'head',
    'options',
    'patch',
    'post',
    'put',
    'trace',
  ]

  static tagObjectAsSchemaRef(schemaObj: JsonObject): void {
    schemaObj[Converter.SCHEMA_REF_TAG] = true
  }

  static objectTaggedAsSchemaRef(schemaObj: JsonObject): boolean {
    return Converter.SCHEMA_REF_TAG in schemaObj
  }

  static untagObjectAsSchemaRef(obj: JsonObject): JsonObject {
    if (Converter.SCHEMA_REF_TAG in obj) {
      delete obj[Converter.SCHEMA_REF_TAG]
    }
    return obj
  }

  /** Construct a new Converter. */
  constructor(openapiDocument: object, options?: ConverterOptions) {
    this.openapi30 = Converter.deepClone(openapiDocument) as OpenAPI3
    this.verbose = Boolean(options?.verbose)
    this.deleteExampleWithId = Boolean(options?.deleteExampleWithId)
    this.allOfTransform = Boolean(options?.allOfTransform)
    this.authorizationUrl = options?.authorizationUrl || 'https://www.example.com/oauth2/authorize'
    this.tokenUrl = options?.tokenUrl || 'https://www.example.com/oauth2/token'
    this.convertOpenIdConnectToOAuth2 = options?.convertOpenIdConnectToOAuth2 ||
      Boolean(options?.scopeDescriptions)
    if (options?.scopeDescriptions) {
      this.scopeDescriptions = options.scopeDescriptions
    }
    this.convertSchemaComments = Boolean(options?.convertSchemaComments)
  }

  /** Log a message to the `console.warn` stream if verbose is true. */
  private log(...message: unknown[]): void {
    if (this.verbose) {
      this.warn(...message)
    }
  }

  /**
   * Log a message to the `console.warn` stream. Prefix the message string with
   * `Warning: ` if it does not already have that text.
   */
  private warn(...message: unknown[]): void {
    const [first] = message
    if (typeof first === 'string' && !first.startsWith('Warning')) {
      message[0] = `Warning: ${first}`
    }
    console.warn(...message)
  }

  /**
   * Log an error message to the `console.error` stream. Prefix the message
   * string with `Error: ` if it does not already start with `Error`.
   * Increments the `returnCode`, causing `convert()` to throw an Error.
   */
  private error(...message: unknown[]): void {
    const [first] = message
    if (typeof first === 'string' && !first.startsWith('Error')) {
      message[0] = `Error: ${first}`
    }
    this.returnCode++
    console.error(...message)
  }

  /**
   * Convert the OpenAPI document to 3.0.
   * @returns the converted document. The input is not modified.
   */
  public convert(): object {
    this.log('Converting from OpenAPI 3.1 to 3.0')
    this.openapi30.openapi = '3.0.3'
    this.removeLicenseIdentifier()
    this.convertSchemaRef()
    if (this.convertOpenIdConnectToOAuth2) {
      this.convertOpenIdConnectSecuritySchemesToOAuth2()
    }
    this.convertJsonSchemaExamples()
    this.convertJsonSchemaContentEncoding()
    this.convertJsonSchemaContentMediaType()
    this.convertConstToEnum()
    this.convertNullableOneOfAnyOf()
    this.convertNullableTypeArray()
    this.convertExclusiveMinMax()
    this.removeWebhooksObject()
    this.removeUnsupportedSchemaKeywords()
    if (this.convertSchemaComments) {
      this.renameSchema$comment()
    } else {
      this.deleteSchema$comment()
    }
    // Note: simplifyNonSchemaRef must be performed after all the above schema
    // transformations, since visiting all the schema $ref objects tags them
    // with x-openapi-down-convert-schema-ref so simplifyNonSchemaRef can apply
    // to any $ref that is not tagged x-openapi-down-convert-schema-ref.
    this.simplifyNonSchemaRef()
    // Remove the x-openapi-down-convert-schema-ref tags.
    this.untagSchemaRef()
    if (this.returnCode > 0) {
      throw new Error('Cannot down convert this OpenAPI definition.')
    }
    return this.openapi30
  }

  /**
   * OpenAPI 3.1 uses JSON Schema 2020-12 which allows schema `examples`;
   * OpenAPI 3.0 uses JSON Schema Draft 7 which only allows `example`.
   * Replace all `examples` with `example`, using `examples[0]`.
   */
  convertJsonSchemaExamples(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      for (const key in schema) {
        const subSchema = schema[key]
        if (subSchema !== null && typeof subSchema === 'object') {
          if (key === 'examples') {
            const examples = schema['examples']
            if (Array.isArray(examples) && examples.length > 0) {
              delete schema['examples']
              const first = examples[0]
              if (this.deleteExampleWithId && isJsonObject(first) && Object.hasOwn(first, 'id')) {
                this.log(`Deleted schema example with \`id\` property:\n${this.json(examples)}`)
              } else {
                schema['example'] = first
                this.log(`Replaces examples with examples[0]. Old examples:\n${this.json(examples)}`)
              }
            }
          } else {
            schema[key] = walkObject(subSchema, schemaVisitor)
          }
        }
      }
      Converter.tagObjectAsSchemaRef(schema)
      return schema
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  private walkNestedSchemaObjects(schema: JsonObject, schemaVisitor: SchemaVisitor): JsonObject {
    for (const key in schema) {
      const subSchema = schema[key]
      if (subSchema !== null && typeof subSchema === 'object') {
        schema[key] = walkObject(subSchema, schemaVisitor)
      }
    }
    return schema
  }

  /**
   * OpenAPI 3.1 uses JSON Schema 2020-12 which allows `const`.
   * OpenAPI 3.0 uses JSON Schema Draft 7 which only allows `enum`.
   * Replace all `const: value` with `enum: [ value ]`.
   */
  convertConstToEnum(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      if (schema['const']) {
        const constant = schema['const']
        delete schema['const']
        schema['enum'] = [constant]
        this.log(`Converted const: ${constant} to enum`)
      }
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  /**
   * Convert OpenAPI 3.1 / JSON Schema 2020-12 numeric `exclusiveMinimum` and
   * `exclusiveMaximum` (which inherit JSON Schema's number-valued form) to
   * OpenAPI 3.0's boolean-modifier form: `{minimum: N, exclusiveMinimum: true}`.
   *
   * Rules per side (min shown; max is mirrored):
   *
   * - If `exclusiveMinimum` is already a boolean (3.0 shape) → leave as-is.
   * - If only `exclusiveMinimum: <number>` → rewrite to
   *   `{minimum: <number>, exclusiveMinimum: true}`.
   * - If both `minimum` and `exclusiveMinimum: <number>` are set, merge to the
   *   stricter bound.
   */
  convertExclusiveMinMax(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      this.normaliseExclusiveBound(schema, 'minimum', 'exclusiveMinimum', /* exclusiveWinsOnEqual */ true)
      this.normaliseExclusiveBound(schema, 'maximum', 'exclusiveMaximum', /* exclusiveWinsOnEqual */ true)
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  private normaliseExclusiveBound(
    schema: SchemaObject,
    inclusiveKey: 'minimum' | 'maximum',
    exclusiveKey: 'exclusiveMinimum' | 'exclusiveMaximum',
    exclusiveWinsOnEqual: boolean,
  ): void {
    const exclusiveRaw = schema[exclusiveKey]
    // Already in 3.0 boolean-modifier form, or absent — nothing to do.
    if (typeof exclusiveRaw !== 'number') {
      return
    }

    const inclusiveRaw = schema[inclusiveKey]
    if (typeof inclusiveRaw !== 'number') {
      // 3.1 form `exclusiveMinimum: N` with no `minimum` →
      // 3.0 form `{minimum: N, exclusiveMinimum: true}`.
      schema[inclusiveKey] = exclusiveRaw
      schema[exclusiveKey] = true
      this.log(
        `Converted numeric ${exclusiveKey}: ${exclusiveRaw} to 3.0 ${inclusiveKey} + boolean ${exclusiveKey}`,
      )
      return
    }

    // Both present — pick the stricter bound. For minimum: stricter is the
    // LARGER value; for maximum: stricter is the SMALLER value.
    // `exclusiveWinsOnEqual` controls the tiebreak when values are equal.
    const exclusiveStricter = inclusiveKey === 'minimum'
      ? exclusiveRaw > inclusiveRaw || (exclusiveWinsOnEqual && exclusiveRaw === inclusiveRaw)
      : exclusiveRaw < inclusiveRaw || (exclusiveWinsOnEqual && exclusiveRaw === inclusiveRaw)

    if (exclusiveStricter) {
      schema[inclusiveKey] = exclusiveRaw
      schema[exclusiveKey] = true
      this.log(
        `Merged ${exclusiveKey}:${exclusiveRaw} + ${inclusiveKey}:${inclusiveRaw} → exclusive form at ${exclusiveRaw}`,
      )
    } else {
      delete schema[exclusiveKey]
      this.log(
        `Merged ${exclusiveKey}:${exclusiveRaw} + ${inclusiveKey}:${inclusiveRaw} → kept inclusive ${inclusiveKey}:${inclusiveRaw}`,
      )
    }
  }

  /**
   * Fold `{type: 'null'}` (or bare `{enum: [null]}`) members of `oneOf`/
   * `anyOf` into `nullable: true` on the wrapper. OpenAPI 3.1 expresses a
   * nullable reference as `oneOf: [{$ref: ...}, {type: 'null'}]` — 3.0 has no
   * null type, so the member is removed and the group is marked `nullable`.
   * The group keyword is kept even when a single member remains: `nullable`
   * as a direct sibling of a `$ref` would be ignored in 3.0, while a
   * single-member group with a sibling `nullable` is 3.0's encoding for a
   * nullable reference.
   */
  convertNullableOneOfAnyOf(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      for (const groupType of ['oneOf', 'anyOf']) {
        const members = schema[groupType]
        if (!Array.isArray(members) || !members.some((member) => this.isNullSchema(member))) {
          continue
        }
        const remaining = members.filter((member) => !this.isNullSchema(member))
        if (remaining.length === 0) {
          this.error(
            `Unable to down-convert ${groupType} with only null members: ${JSON.stringify(schema)}`,
          )
          continue
        }
        schema[groupType] = remaining
        schema['nullable'] = true
        this.log(`Converted null member of ${groupType} to nullable: true`)
      }
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  /**
   * A schema that matches only `null`: `type: 'null'` (with any annotations),
   * or a bare single-value `enum: [null]` with no `type`.
   */
  private isNullSchema(member: unknown): boolean {
    if (member === null || typeof member !== 'object') {
      return false
    }
    const schema = member as SchemaObject
    if (schema['type'] === 'null') {
      return true
    }
    const enumValues = schema['enum']
    return !Object.hasOwn(schema, 'type') && Array.isArray(enumValues) &&
      enumValues.length === 1 && enumValues[0] === null
  }

  /**
   * Convert 2-element type arrays containing `'null'` to a string type with
   * `nullable: true`.
   */
  convertNullableTypeArray(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      if (Object.hasOwn(schema, 'type')) {
        const schemaType = schema['type']
        if (Array.isArray(schemaType) && schemaType.length === 2 && schemaType.includes('null')) {
          const nonNull = schemaType.filter((entry) => entry !== 'null')[0]
          schema['type'] = nonNull
          schema['nullable'] = true
          this.log(`Converted schema type array to nullable`)
        }
      }
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  removeWebhooksObject(): void {
    if (Object.hasOwn(this.openapi30, 'webhooks')) {
      this.log(`Deleted webhooks object`)
      delete this.openapi30['webhooks']
    }
  }

  removeUnsupportedSchemaKeywords(): void {
    const keywordsToRemove = [
      '$id',
      '$schema',
      'unevaluatedProperties',
      'contentMediaType',
      'patternProperties',
      'propertyNames',
    ]
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      keywordsToRemove.forEach((key) => {
        if (Object.hasOwn(schema, key)) {
          delete schema[key]
          this.log(`Removed unsupported schema keyword ${key}`)
        }
      })
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  renameSchema$comment(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      if (Object.hasOwn(schema, '$comment')) {
        schema['x-comment'] = schema['$comment']
        delete schema['$comment']
        this.log(`schema $comment renamed to x-comment`)
      }
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  private deleteSchema$comment(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      if (Object.hasOwn(schema, '$comment')) {
        const comment = schema['$comment']
        delete schema['$comment']
        this.log(`schema $comment deleted: ${comment}`)
      }
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  /**
   * Convert `contentMediaType: 'application/octet-stream'` to `format: binary`
   * in `type: string` schemas. Warn if the schema has a `format` already and it
   * is not `binary`.
   */
  convertJsonSchemaContentMediaType(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      if (
        Object.hasOwn(schema, 'type') &&
        schema['type'] === 'string' &&
        Object.hasOwn(schema, 'contentMediaType') &&
        schema['contentMediaType'] === 'application/octet-stream'
      ) {
        if (Object.hasOwn(schema, 'format')) {
          if (schema['format'] === 'binary') {
            this.log(
              `Deleted schema contentMediaType: application/octet-stream (leaving format: binary)`,
            )
            delete schema['contentMediaType']
          } else {
            this.error(
              `Unable to down-convert schema with contentMediaType: application/octet-stream to format: binary because the schema already has a format (${schema['format']})`,
            )
          }
        } else {
          delete schema['contentMediaType']
          schema['format'] = 'binary'
          this.log(`Converted schema contentMediaType: application/octet-stream to format: binary`)
        }
      }
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  /**
   * Convert `contentEncoding: base64` to `format: byte` in `type: string`
   * schemas. It is an error if the schema has a `format` already and it is not
   * `byte`.
   */
  convertJsonSchemaContentEncoding(): void {
    const schemaVisitor: SchemaVisitor = (schema: SchemaObject): SchemaObject => {
      if (
        Object.hasOwn(schema, 'type') &&
        schema['type'] === 'string' &&
        Object.hasOwn(schema, 'contentEncoding')
      ) {
        if (schema['contentEncoding'] === 'base64') {
          if (Object.hasOwn(schema, 'format')) {
            if (schema['format'] === 'byte') {
              this.log(`Deleted schema contentEncoding: base64 (leaving format: byte)`)
              delete schema['contentEncoding']
            } else {
              this.error(
                `Unable to down-convert schema contentEncoding: base64 to format: byte because the schema already has a format (${schema['format']})`,
              )
            }
          } else {
            delete schema['contentEncoding']
            schema['format'] = 'byte'
            this.log(`Converted schema: 'contentEncoding: base64' to 'format: byte'`)
          }
        } else {
          this.error(`Unable to down-convert contentEncoding: ${schema['contentEncoding']}`)
        }
      }
      return this.walkNestedSchemaObjects(schema, schemaVisitor)
    }
    visitSchemaObjects(this.openapi30, schemaVisitor)
  }

  private json(x: unknown): string {
    return JSON.stringify(x, null, 2)
  }

  /**
   * Convert the `openIdConnect` security scheme to the `oauth2` security
   * scheme, since not all tools support `openIdConnect` even when they claim
   * support for OAS 3.0. Collect all the scopes used in any security
   * requirements within operations and add them to the scheme.
   */
  convertOpenIdConnectSecuritySchemesToOAuth2(): void {
    const oauth2Scopes = (schemeName: string): JsonObject => {
      const scopes: JsonObject = {}
      const paths = this.openapi30['paths']
      if (!isJsonObject(paths)) {
        return scopes
      }
      for (const path in paths) {
        const pathItem = paths[path]
        if (!isJsonObject(pathItem)) {
          continue
        }
        // Filter out path.{$ref, summary, description, parameters, servers}
        // and x-* specification extensions.
        const methods = Object.keys(pathItem).filter((op) => Converter.HTTP_METHODS.includes(op))
        methods.forEach((method) => {
          const operation = pathItem[method]
          if (!isJsonObject(operation)) {
            return
          }
          const security = operation['security']
          if (!Array.isArray(security)) {
            return
          }
          security.forEach((requirement) => {
            if (!isJsonObject(requirement)) {
              return
            }
            const requiredScopes = requirement[schemeName]
            if (!Array.isArray(requiredScopes)) {
              return
            }
            requiredScopes.forEach((scope) => {
              if (typeof scope !== 'string') {
                return
              }
              scopes[scope] = this.scopeDescriptions[scope] || `TODO: describe the '${scope}' scope`
            })
          })
        })
      }
      return scopes
    }

    const components = this.openapi30['components']
    const securitySchemes = isJsonObject(components) ? components['securitySchemes'] : undefined
    if (!isJsonObject(securitySchemes)) {
      return
    }
    for (const schemeName in securitySchemes) {
      const scheme = securitySchemes[schemeName]
      if (!isJsonObject(scheme)) {
        continue
      }
      if (scheme['type'] === 'openIdConnect') {
        this.log(`Converting openIdConnect security scheme to oauth2/authorizationCode`)
        scheme['type'] = 'oauth2'
        const openIdConnectUrl = scheme['openIdConnectUrl']
        scheme['description'] = `OAuth2 Authorization Code Flow. The client may
GET the OpenID Connect configuration JSON from \`${openIdConnectUrl}\`
to get the correct \`authorizationUrl\` and \`tokenUrl\`.`
        delete scheme['openIdConnectUrl']
        scheme['flows'] = {
          authorizationCode: {
            authorizationUrl: this.authorizationUrl,
            tokenUrl: this.tokenUrl,
            scopes: oauth2Scopes(schemeName),
          },
        }
      }
    }
  }

  /**
   * Find remaining OpenAPI 3.0 Reference Objects that have not been tagged as
   * schema `$ref` objects and down convert them to JSON Reference objects with
   * _only_ a `$ref` property.
   */
  simplifyNonSchemaRef(): void {
    visitRefObjects(this.openapi30, (node: RefObject): JsonNode => {
      if (Object.keys(node).length === 1) {
        return node
      } else if (Converter.objectTaggedAsSchemaRef(node)) {
        return node
      } else {
        this.log(`Down convert reference object to JSON Reference:\n${JSON.stringify(node, null, 3)}`)
        Object.keys(node)
          .filter((key) => key !== '$ref')
          .forEach((key) => delete node[key])
        return node
      }
    })
  }

  /**
   * Remove the `x-openapi-down-convert-schema-ref` property added to schema
   * `$ref` objects during visiting.
   */
  untagSchemaRef(): void {
    walkObject(this.openapi30, Converter.untagObjectAsSchemaRef)
  }

  /** Remove `info.license.identifier` if it exists (not part of OAS 3.0). */
  removeLicenseIdentifier(): void {
    const info = this.openapi30['info']
    if (!isJsonObject(info)) {
      return
    }
    const license = info['license']
    if (!isJsonObject(license)) {
      return
    }
    if (license['identifier']) {
      this.log(`Removed info.license.identifier: ${license['identifier']}`)
      delete license['identifier']
    }
  }

  /**
   * In a JSON Schema, replace `{ ..., $ref: "uri" }` with
   * `{ ..., allOf: [ { $ref: "uri" } ] }`.
   *
   * This transformation breaks `openapi-generator` SDK generation, so it is
   * disabled unless the `allOfTransform` option is `true`.
   */
  convertSchemaRef(): void {
    const simplifyRefObjectsInSchemas = (schema: SchemaObject): SchemaObject => {
      visitRefObjects(schema, (node: RefObject): JsonNode => {
        if (Object.keys(node).length === 1) {
          // Already a valid JSON reference object.
          return node
        }
        const ref = node.$ref
        if (typeof ref !== 'string') {
          return node
        }
        this.log(`Converting JSON Schema $ref ${this.json(node)} to allOf: [ $ref ]`)
        node['allOf'] = [{ $ref: ref }]
        delete node.$ref
        return node
      })
      return schema
    }

    if (this.allOfTransform) {
      visitSchemaObjects(this.openapi30, (schema: SchemaObject): SchemaObject => {
        return simplifyRefObjectsInSchemas(schema)
      })
    }
  }

  public static deepClone(obj: object): object {
    // structuredClone is a native Web API available in both Deno and modern
    // Node — a true structured clone, not a JSON round-trip.
    return structuredClone(obj)
  }
}
