import { camelCase, OasVoid } from '@skmtc/core'
import type {
  GenerateContextType,
  GeneratorKey,
  OasOperation,
  OasParameter,
  OasRef,
  OasSchema,
  Stringable
} from '@skmtc/core'
import { TsMethod, TsSnippet, register, toPathTemplate } from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'
import { join } from '@std/path'

/** Deterministic method name from method + path: `GET /orders/{id}` → `getOrdersId`. */
export const toMethodName = (operation: OasOperation): string => {
  return `${operation.method}${camelCase(operation.path, { upperFirst: true })}`
}

type InsertZodModelArgs = {
  context: GenerateContextType
  schema: OasSchema | OasRef<'schema'> | OasVoid
  fallbackName: string
  destinationPath: string
}

/**
 * Materialize a schema as a gen-zod model and return its emitted name.
 *
 * A `$ref` schema goes through gen-zod's own identity (its own file under
 * `@/types/`), with the import into `destinationPath` stitched by the engine.
 * An anonymous schema has no refName, so this generator places it in its own
 * `@/types/<fallbackName>.generated.ts` file and registers the import.
 */
const insertZodModel = ({
  context,
  schema,
  fallbackName,
  destinationPath
}: InsertZodModelArgs): string => {
  if (schema.isRef()) {
    const definition = context.insertNormalizedModel(ZodProjection, {
      schema,
      fallbackName,
      destinationPath
    })

    return definition.identifier.name
  }

  const modelPath = join('@', 'types', `${fallbackName}.generated.ts`)

  const definition = context.insertNormalizedModel(ZodProjection, {
    schema,
    fallbackName,
    destinationPath: modelPath
  })

  const name = definition.identifier.name

  register(context, { imports: { [modelPath]: [name] }, destinationPath })

  return name
}

type PathParameterArgs = {
  context: GenerateContextType
  parameter: OasParameter
  generatorKey: GeneratorKey
}

export class PathParameter extends TsSnippet {
  name: string

  constructor({ context, parameter, generatorKey }: PathParameterArgs) {
    super({ context, generatorKey })

    // Name stays unsanitized so it matches the `${name}` slot in the
    // fetch path template. Path parameters serialize into the URL, so
    // they are accepted as strings.
    this.name = parameter.name
  }

  override toString(): string {
    return `${this.name}: string`
  }
}

type BodyParameterArgs = {
  context: GenerateContextType
  destinationPath: string
  schema: OasSchema | OasRef<'schema'>
  fallbackName: string
  generatorKey: GeneratorKey
}

export class BodyParameter extends TsSnippet {
  schemaName: string

  constructor({ context, destinationPath, schema, fallbackName, generatorKey }: BodyParameterArgs) {
    super({ context, generatorKey })

    this.schemaName = insertZodModel({ context, schema, fallbackName, destinationPath })

    this.register({ imports: { zod: ['z'] }, destinationPath })
  }

  override toString(): string {
    return `body: z.infer<typeof ${this.schemaName}>`
  }
}

type MethodBodyArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
  hasBody: boolean
  generatorKey: GeneratorKey
}

export class MethodBody extends TsSnippet {
  responseName: string
  path: string
  method: string
  hasBody: boolean

  constructor({ context, operation, destinationPath, hasBody, generatorKey }: MethodBodyArgs) {
    super({ context, generatorKey })

    const responseSchema = operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty()

    this.responseName = insertZodModel({
      context,
      schema: responseSchema,
      fallbackName: `${toMethodName(operation)}Response`,
      destinationPath
    })

    this.path = operation.path
    this.method = operation.method
    this.hasBody = hasBody
  }

  override toString(): string {
    const bodyFields = this.hasBody
      ? `,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)`
      : ''

    return `const res = await fetch(\`${toPathTemplate(this.path)}\`, {
      method: '${this.method.toUpperCase()}'${bodyFields}
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return ${this.responseName}.parse(await res.json())`
  }
}

type ToClientMethodArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
  generatorKey: GeneratorKey
}

export const toClientMethod = ({
  context,
  operation,
  destinationPath,
  generatorKey
}: ToClientMethodArgs): TsMethod => {
  const parameters: Stringable[] = operation
    .toParams(['path'])
    .map(parameter => new PathParameter({ context, parameter, generatorKey }))

  const bodySchema = operation.toRequestBody(({ schema }) => schema)

  if (bodySchema) {
    parameters.push(
      new BodyParameter({
        context,
        destinationPath,
        schema: bodySchema,
        fallbackName: `${toMethodName(operation)}Body`,
        generatorKey
      })
    )
  }

  return new TsMethod({
    name: toMethodName(operation),
    async: true,
    parameters,
    body: new MethodBody({
      context,
      operation,
      destinationPath,
      hasBody: Boolean(bodySchema),
      generatorKey
    })
  })
}
