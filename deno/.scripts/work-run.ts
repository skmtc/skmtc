/**
 * The fixed run whose function calls `work.ts` counts: the models and the
 * operations of `core/_schemas/remote-com.json`, as TypeScript types and
 * fetch functions.
 *
 * The projections are written here and not shared with the skeleton of the
 * model skill, so that an edit of the skeleton does not move the counts.
 *
 * `work.ts` starts this file with `deno run --coverage`. It prints one line of
 * JSON with the number of generated files.
 */

import {
  camelCase,
  capitalize,
  decapitalize,
  emptyEnrichmentSchema,
  isEmpty,
  OasVoid,
  StackTrail,
  toArtifacts,
  toEndpointName,
  toGeneratorOnlyKey,
  toModelEntry,
  toModelGeneratorKey,
  toModelName,
  toModelRef,
  toOasOperationEntry
} from '@skmtc/core'
import type {
  ContentSettings,
  CustomValue,
  EmptyEnrichments,
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasArray,
  OasBoolean,
  OasInteger,
  OasIntersection,
  OasNumber,
  OasObject,
  OasOperation,
  OasRef,
  OasSchema,
  OasString,
  OasUnion,
  RefParts,
  SchemaToValueFn,
  SchemaType,
  Stringable,
  TypeSystemValue
} from '@skmtc/core'
import {
  createType,
  handleKey,
  List,
  sanitizeIdentifier,
  toPathTemplate,
  toTsModelProjectionBase,
  toTsOasOperationProjectionBase,
  TsSnippet,
  withDescription
} from '@skmtc/lang-typescript'

const MODEL_ID = '@work/models'
const OPERATION_ID = '@work/operations'

/** Adds `| null` and the description to a type. The property adds its own `?`. */
const applyModifiers = (value: Stringable, modifiers: Modifiers): string =>
  withDescription(modifiers.nullable ? `(${value} | null)` : `${value}`, modifiers)

type ValueArgs<Schema> = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  modifiers: Modifiers
  rootRef: RefParts | undefined
  schema: Schema
}

class WorkString extends TsSnippet {
  type = 'string' as const
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers

  constructor({ context, generatorKey, modifiers, schema }: ValueArgs<OasString>) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.format = schema.format
    this.enums = schema.enums
    this.modifiers = modifiers
  }

  override toString(): string {
    const members = this.enums?.map(value => JSON.stringify(value))

    return applyModifiers(members ? `(${members.join(' | ')})` : 'string', this.modifiers)
  }
}

class WorkNumber extends TsSnippet {
  type = 'number' as const
  modifiers: Modifiers

  constructor({ context, generatorKey, modifiers, schema }: ValueArgs<OasNumber>) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers('number', this.modifiers)
  }
}

class WorkInteger extends TsSnippet {
  type = 'integer' as const
  modifiers: Modifiers

  constructor({ context, generatorKey, modifiers, schema }: ValueArgs<OasInteger>) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers('number', this.modifiers)
  }
}

class WorkBoolean extends TsSnippet {
  type = 'boolean' as const
  modifiers: Modifiers

  constructor({ context, generatorKey, modifiers, schema }: ValueArgs<OasBoolean>) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers('boolean', this.modifiers)
  }
}

type WorkUnknownArgs = {
  context: GenerateContextType
  generatorKey: GeneratorKey
  schema?: OasSchema
}

class WorkUnknown extends TsSnippet {
  type = 'unknown' as const

  constructor({ context, generatorKey, schema }: WorkUnknownArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })
  }

  override toString(): string {
    return 'unknown'
  }
}

type WorkVoidArgs = {
  context: GenerateContextType
  generatorKey: GeneratorKey
}

class WorkVoid extends TsSnippet {
  type = 'void' as const

  constructor({ context, generatorKey }: WorkVoidArgs) {
    super({ context, generatorKey })
  }

  override toString(): string {
    return 'void'
  }
}

class WorkArray extends TsSnippet {
  type = 'array' as const
  items: TypeSystemValue
  modifiers: Modifiers

  constructor(args: ValueArgs<OasArray>) {
    const { context, destinationPath, generatorKey, modifiers, rootRef, schema } = args

    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.items = toWorkValue({
      context,
      destinationPath,
      rootRef,
      required: true,
      schema: schema.items
    })
  }

  override toString(): string {
    return applyModifiers(`Array<${this.items}>`, this.modifiers)
  }
}

class WorkUnion extends TsSnippet {
  type = 'union' as const
  members: TypeSystemValue[]
  discriminator: string | undefined
  modifiers: Modifiers

  constructor(args: ValueArgs<OasUnion>) {
    const { context, destinationPath, generatorKey, modifiers, rootRef, schema } = args

    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.discriminator = schema.discriminator?.propertyName
    this.members = schema.members.map(member =>
      toWorkValue({ context, destinationPath, rootRef, required: true, schema: member })
    )
  }

  override toString(): string {
    return applyModifiers(`(${this.members.join(' | ')})`, this.modifiers)
  }
}

class WorkIntersection extends TsSnippet {
  type = 'intersection' as const
  members: TypeSystemValue[]
  modifiers: Modifiers

  constructor(args: ValueArgs<OasIntersection>) {
    const { context, destinationPath, generatorKey, modifiers, rootRef, schema } = args

    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.members = schema.members.map(member =>
      toWorkValue({ context, destinationPath, rootRef, required: true, schema: member })
    )
  }

  override toString(): string {
    return applyModifiers(`(${this.members.join(' & ')})`, this.modifiers)
  }
}

type WorkPropertiesArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: string[]
  rootRef: RefParts | undefined
}

class WorkProperties extends TsSnippet {
  properties: Record<string, TypeSystemValue>
  required: string[]

  constructor(args: WorkPropertiesArgs) {
    const { context, destinationPath, generatorKey, properties, required, rootRef } = args

    super({ context, generatorKey })

    this.required = required
    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, schema]) => [
        key,
        toWorkValue({
          context,
          destinationPath,
          rootRef,
          required: required.includes(key),
          schema
        })
      ])
    )
  }

  override toString(): string {
    const entries = Object.entries(this.properties).map(([key, value]) => {
      const name = handleKey(key)

      return List.toKeyValue(this.required.includes(key) ? name : `${name}?`, value)
    })

    return List.toObject(entries).toString()
  }
}

type WorkRecordPropertiesArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  rootRef: RefParts | undefined
  schema: true | OasSchema | OasRef<'schema'>
}

class WorkRecordProperties extends TsSnippet {
  value: TypeSystemValue

  constructor(args: WorkRecordPropertiesArgs) {
    const { context, destinationPath, generatorKey, rootRef, schema } = args

    super({ context, generatorKey })

    this.value =
      schema === true || isEmpty(schema)
        ? new WorkUnknown({ context, generatorKey })
        : toWorkValue({ context, destinationPath, rootRef, required: true, schema })
  }

  override toString(): string {
    return `Record<string, ${this.value}>`
  }
}

class WorkObject extends TsSnippet {
  type = 'object' as const
  objectProperties: WorkProperties | null
  recordProperties: WorkRecordProperties | null
  modifiers: Modifiers

  constructor(args: ValueArgs<OasObject>) {
    const { context, destinationPath, generatorKey, modifiers, rootRef, schema } = args
    const { properties, required = [], additionalProperties } = schema

    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.objectProperties =
      properties && !isEmpty(properties)
        ? new WorkProperties({
            context,
            destinationPath,
            generatorKey,
            properties,
            required,
            rootRef
          })
        : null
    this.recordProperties = additionalProperties
      ? new WorkRecordProperties({
          context,
          destinationPath,
          generatorKey,
          rootRef,
          schema: additionalProperties
        })
      : null
  }

  override toString(): string {
    const parts = [this.objectProperties, this.recordProperties].filter(part => part !== null)

    return applyModifiers(parts.length ? `(${parts.join(' & ')})` : '{}', this.modifiers)
  }
}

type WorkRefArgs = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  ref: OasRef<'schema'>
  rootRef: RefParts | undefined
}

class WorkRef extends TsSnippet {
  type = 'ref' as const
  name: string
  modifiers: Modifiers

  constructor({ context, destinationPath, modifiers, ref, rootRef }: WorkRefArgs) {
    super({
      context,
      generatorKey: toModelGeneratorKey({ generatorId: MODEL_ID, ref, variant: 'main' }),
      stackTrail: ref.stackTrail.clone()
    })

    const modelRef = toModelRef({
      context,
      destinationPath,
      ref,
      rootRef,
      projection: WorkModel,
      variant: 'main'
    })

    this.name = modelRef.settings.identifier.name
    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers(this.name, this.modifiers)
  }
}

const toWorkValue: SchemaToValueFn = args => {
  const { context, destinationPath, required, rootRef } = args
  const schema: SchemaType = args.schema
  const generatorKey = toGeneratorOnlyKey({ generatorId: MODEL_ID })
  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined,
    description: 'description' in schema ? schema.description : undefined
  }
  const shared = { context, destinationPath, generatorKey, modifiers, rootRef }

  switch (schema.type) {
    case 'custom':
      return schema
    case 'ref':
      return new WorkRef({ context, destinationPath, modifiers, ref: schema, rootRef })
    case 'array':
      return new WorkArray({ ...shared, schema })
    case 'object':
      return new WorkObject({ ...shared, schema })
    case 'union':
      return new WorkUnion({ ...shared, schema })
    case 'intersection':
      return new WorkIntersection({ ...shared, schema })
    case 'string':
      return new WorkString({ ...shared, schema })
    case 'number':
      return new WorkNumber({ ...shared, schema })
    case 'integer':
      return new WorkInteger({ ...shared, schema })
    case 'boolean':
      return new WorkBoolean({ ...shared, schema })
    case 'void':
      return new WorkVoid({ context, generatorKey })
    case 'unknown':
      return new WorkUnknown({ context, generatorKey, schema })
  }
}

const WorkModelBase = toTsModelProjectionBase<EmptyEnrichments>({
  id: MODEL_ID,
  toIdentifierName: ({ ref }) =>
    sanitizeIdentifier(capitalize(toModelName(ref, name => camelCase(name)))),
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath({ ref, enrichments, variant }) {
    return `@/models/${this.toIdentifierName({ ref, enrichments, variant })}.generated.ts`
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

type WorkModelArgs = {
  context: GenerateContextType
  destinationPath: string
  ref: RefParts
  settings: ContentSettings<EmptyEnrichments>
  rootRef?: RefParts
}

class WorkModel extends WorkModelBase {
  value: TypeSystemValue

  constructor({ context, destinationPath, ref, settings, rootRef }: WorkModelArgs) {
    super({ context, ref, settings })

    this.value = toWorkValue({
      context,
      destinationPath,
      rootRef,
      required: true,
      schema: context.resolveSchemaRefOnce(ref)
    })
  }

  static schemaToValueFn = (...args: Parameters<typeof toWorkValue>) => toWorkValue(...args)

  static createIdentifier = createType

  override toString(): string {
    return `${this.value}`
  }
}

const WorkOperationBase = toTsOasOperationProjectionBase<EmptyEnrichments>({
  id: OPERATION_ID,
  toIdentifierName: ({ operation }) => sanitizeIdentifier(decapitalize(toEndpointName(operation))),
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath({ operation, enrichments, variant }) {
    return `@/operations/${this.toIdentifierName({ operation, enrichments, variant })}.generated.ts`
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

type WorkOperationArgs = {
  context: GenerateContextType
  operation: OasOperation
  settings: ContentSettings<EmptyEnrichments>
}

class WorkOperation extends WorkOperationBase {
  argsName: string
  bodyName: string
  responseName: string

  constructor({ context, operation, settings }: WorkOperationArgs) {
    super({ context, operation, settings })

    const name = capitalize(settings.identifier.name)

    this.argsName = this.insertNormalizedModel(WorkModel, {
      schema: operation.toParametersObject(),
      fallbackName: `${name}Args`
    }).identifier.name

    this.bodyName = this.insertNormalizedModel(WorkModel, {
      schema: operation.toRequestBody(({ schema }) => schema) ?? OasVoid.empty(),
      fallbackName: `${name}Body`
    }).identifier.name

    this.responseName = this.insertNormalizedModel(WorkModel, {
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${name}Response`
    }).identifier.name
  }

  override toString(): string {
    const { method, path } = this.operation
    const parameters = List.toParams([`args: ${this.argsName}`, `body: ${this.bodyName}`])
    const options = List.toObject([
      List.toKeyValue('method', `'${method.toUpperCase()}'`),
      List.toKeyValue('body', 'JSON.stringify(body)')
    ])

    return `async ${parameters}: Promise<${this.responseName}> => {
  const response = await fetch(\`${toPathTemplate(path, 'args')}\`, ${options})

  return await response.json()
}`
  }
}

const modelEntry = toModelEntry<EmptyEnrichments>({
  id: MODEL_ID,
  toEnrichmentSchema: () => emptyEnrichmentSchema,
  transform: ({ context, ref }) => {
    context.insertModel(WorkModel, ref)
  }
})

const operationEntry = toOasOperationEntry<EmptyEnrichments>({
  id: OPERATION_ID,
  toEnrichmentSchema: () => emptyEnrichmentSchema,
  transform: ({ context, operation, variant }) => {
    context.insertOperation({ projection: WorkOperation, operation, variant })
  }
})

/** Generates the document with both projections, and the attribution a server always emits. */
export const generateWork = async () => {
  const documentUrl = new URL('../core/_schemas/remote-com.json', import.meta.url)
  const document = JSON.parse(await Deno.readTextFile(documentUrl))

  return toArtifacts({
    traceId: 'work',
    spanId: 'work',
    document: { type: 'oas', value: document },
    settings: undefined,
    stackTrail: new StackTrail(['work']),
    // The entry map's enrichment type is the caller's choice, so a map of real
    // entries cannot satisfy it without a cast.
    toGeneratorConfigMap: (() => ({
      [modelEntry.id]: modelEntry,
      [operationEntry.id]: operationEntry
    })) as Parameters<typeof toArtifacts>[0]['toGeneratorConfigMap'],
    startAt: Date.now(),
    silent: true,
    attribution: { postPass: { schemaSrc: 'oas' } }
  })
}

if (import.meta.main) {
  const { artifacts, manifest } = await generateWork()

  if (JSON.stringify(manifest.results).includes(':"error"')) {
    throw new Error('the run has a subject that failed to generate')
  }

  console.log(JSON.stringify({ files: Object.keys(artifacts).length }))
}
