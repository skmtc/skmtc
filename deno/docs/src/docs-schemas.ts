// Zod v4 schemas for the SKMTC docs.json structure
// Matches the types defined in docs-types.ts

import { z } from 'zod'
import type { TsType, DocNode, Param } from './docs-types.ts'

// Forward declarations for recursive types
const tsTypeSchema: z.ZodType<TsType> = z.lazy(() => tsTypeUnionSchema)
const docNodeSchema: z.ZodType<DocNode> = z.lazy(() => docNodeUnionSchema)
const paramSchema: z.ZodType<Param> = z.lazy(() => paramUnionSchema)

// Basic enums and types
export const declarationKindSchema = z.enum(['export', 'declare', 'private', 'protected'])

export const jsDocTagKindSchema = z.enum([
  'module',
  'example',
  'param',
  'return',
  'returns',
  'throws',
  'deprecated',
  'since',
  'see',
  'author',
  'version',
  'experimental',
  'internal',
  'template',
  'unsupported'
])

export const variableKindSchema = z.enum(['const', 'let', 'var'])

export const accessibilitySchema = z.enum(['public', 'protected', 'private'])

export const methodKindSchema = z.enum(['method', 'getter', 'setter'])

export const paramKindSchema = z.enum(['identifier', 'array', 'object', 'rest', 'assign'])

export const literalKindSchema = z.enum(['string', 'number', 'boolean', 'bigInt'])

// Location
export const locationSchema = z.object({
  filename: z.string(),
  line: z.number(),
  col: z.number(),
  byteIndex: z.number()
})

// JsDoc
export const jsDocTagSchema = z.object({
  kind: jsDocTagKindSchema,
  name: z.string().optional(),
  doc: z.string().optional()
})

export const jsDocSchema = z.object({
  doc: z.string().optional(),
  tags: z.array(jsDocTagSchema).optional()
})

// Decorator
export const decoratorSchema = z.object({
  name: z.string(),
  args: z.array(z.string()).optional()
})

// TypeParam
export const typeParamSchema = z.object({
  name: z.string(),
  constraint: z.lazy(() => tsTypeSchema).optional(),
  default: z.lazy(() => tsTypeSchema).optional()
})

// TsTypeLiteral discriminated union
export const tsTypeLiteralStringSchema = z.object({
  kind: z.literal('string'),
  string: z.string()
})

export const tsTypeLiteralNumberSchema = z.object({
  kind: z.literal('number'),
  number: z.number()
})

export const tsTypeLiteralBooleanSchema = z.object({
  kind: z.literal('boolean'),
  boolean: z.boolean()
})

export const tsTypeLiteralBigIntSchema = z.object({
  kind: z.literal('bigInt'),
  bigInt: z.string()
})

export const tsTypeLiteralTemplateSchema = z.object({
  kind: z.literal('template'),
  template: z.unknown()
})

export const tsTypeLiteralSchema = z.discriminatedUnion('kind', [
  tsTypeLiteralStringSchema,
  tsTypeLiteralNumberSchema,
  tsTypeLiteralBooleanSchema,
  tsTypeLiteralBigIntSchema,
  tsTypeLiteralTemplateSchema
])

// TsType helper types
export const tsTypeRefSchema = z.object({
  typeName: z.string(),
  typeParams: z
    .array(z.lazy(() => tsTypeSchema))
    .nullable()
    .optional()
})

export const tsTypeConditionalSchema = z.object({
  checkType: z.lazy(() => tsTypeSchema),
  extendsType: z.lazy(() => tsTypeSchema),
  trueType: z.lazy(() => tsTypeSchema),
  falseType: z.lazy(() => tsTypeSchema)
})

export const tsTypeInferSchema = z.object({
  typeParam: typeParamSchema
})

export const tsTypeIndexedSchema = z.object({
  readonly: z.boolean(),
  objType: z.lazy(() => tsTypeSchema),
  indexType: z.lazy(() => tsTypeSchema)
})

export const tsTypeMappedSchema = z.object({
  readonly: z.boolean().optional(),
  optional: z.boolean().optional(),
  typeParam: typeParamSchema,
  nameType: z.lazy(() => tsTypeSchema).optional(),
  tsType: z.lazy(() => tsTypeSchema).optional()
})

export const tsTypeFnOrConstructorSchema = z.object({
  constructor: z.boolean(),
  tsType: z.lazy(() => tsTypeSchema),
  params: z.array(z.lazy(() => paramSchema)),
  typeParams: z.array(typeParamSchema)
})

// TsTypeObjectLiteral components
export const tsTypeConstructorSchema = z.object({
  jsDoc: jsDocSchema.optional(),
  accessibility: accessibilitySchema.nullable().optional(),
  name: z.string().optional(),
  params: z.array(z.lazy(() => paramSchema)),
  location: locationSchema
})

export const functionDefSchema = z.object({
  params: z.array(z.lazy(() => paramSchema)),
  returnType: z.lazy(() => tsTypeSchema).optional(),
  hasBody: z.boolean(),
  isAsync: z.boolean(),
  isGenerator: z.boolean(),
  typeParams: z.array(typeParamSchema)
})

export const tsTypeMethodSchema = z.object({
  jsDoc: jsDocSchema.optional(),
  accessibility: accessibilitySchema.nullable().optional(),
  optional: z.boolean(),
  name: z.string(),
  kind: methodKindSchema,
  functionDef: functionDefSchema,
  location: locationSchema
})

export const tsTypePropertySchema = z.object({
  jsDoc: jsDocSchema.optional(),
  accessibility: accessibilitySchema.nullable().optional(),
  name: z.string(),
  params: z.array(z.lazy(() => paramSchema)),
  computed: z.boolean(),
  optional: z.boolean(),
  tsType: z.lazy(() => tsTypeSchema),
  typeParams: z.array(typeParamSchema),
  location: locationSchema
})

export const tsTypeCallSignatureSchema = z.object({
  jsDoc: jsDocSchema.optional(),
  params: z.array(z.lazy(() => paramSchema)),
  tsType: z.lazy(() => tsTypeSchema),
  typeParams: z.array(typeParamSchema)
})

export const tsTypeIndexSignatureSchema = z.object({
  readonly: z.boolean(),
  params: z.array(z.lazy(() => paramSchema)),
  tsType: z.lazy(() => tsTypeSchema).optional()
})

export const tsTypeObjectLiteralSchema = z.object({
  constructors: z.array(tsTypeConstructorSchema),
  methods: z.array(tsTypeMethodSchema),
  properties: z.array(tsTypePropertySchema),
  callSignatures: z.array(tsTypeCallSignatureSchema),
  indexSignatures: z.array(tsTypeIndexSignatureSchema)
})

// TsType base
const tsTypeBaseSchema = z.object({
  repr: z.string()
})

// TsType discriminated union variants
export const tsTypeKeywordSchema = tsTypeBaseSchema.extend({
  kind: z.literal('keyword'),
  keyword: z.string()
})

export const tsTypeLiteralTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('literal'),
  literal: tsTypeLiteralSchema
})

export const tsTypeObjectLiteralTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('typeLiteral'),
  typeLiteral: tsTypeObjectLiteralSchema
})

export const tsTypeArraySchema = tsTypeBaseSchema.extend({
  kind: z.literal('array'),
  array: z.lazy(() => tsTypeSchema)
})

export const tsTypeTupleSchema = tsTypeBaseSchema.extend({
  kind: z.literal('tuple'),
  tuple: z.array(z.lazy(() => tsTypeSchema))
})

export const tsTypeReferenceSchema = tsTypeBaseSchema.extend({
  kind: z.literal('typeRef'),
  typeRef: tsTypeRefSchema
})

export const tsTypeUnionTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('union'),
  union: z.array(z.lazy(() => tsTypeSchema))
})

export const tsTypeIntersectionSchema = tsTypeBaseSchema.extend({
  kind: z.literal('intersection'),
  intersection: z.array(z.lazy(() => tsTypeSchema))
})

export const tsTypeConditionalTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('conditional'),
  conditionalType: tsTypeConditionalSchema.optional()
})

export const tsTypeInferTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('infer'),
  infer: tsTypeInferSchema
})

export const tsTypeIndexedTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('indexed'),
  indexed: tsTypeIndexedSchema
})

export const tsTypeMappedTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('mapped'),
  mapped: tsTypeMappedSchema.optional()
})

export const tsTypeFnOrConstructorTypeSchema = tsTypeBaseSchema.extend({
  kind: z.literal('fnOrConstructor'),
  fnOrConstructor: tsTypeFnOrConstructorSchema
})

export const tsTypeParenthesizedSchema = tsTypeBaseSchema.extend({
  kind: z.literal('parenthesized'),
  parenthesized: z.lazy(() => tsTypeSchema)
})

export const tsTypeRestSchema = tsTypeBaseSchema.extend({
  kind: z.literal('rest'),
  rest: z.lazy(() => tsTypeSchema)
})

export const tsTypeOptionalSchema = tsTypeBaseSchema.extend({
  kind: z.literal('optional'),
  optional: z.lazy(() => tsTypeSchema)
})

export const tsTypeIdentifierSchema = tsTypeBaseSchema.extend({
  kind: z.literal('identifier')
})

export const tsTypeIndexedAccessSchema = tsTypeBaseSchema.extend({
  kind: z.literal('indexedAccess'),
  indexedAccess: tsTypeIndexedSchema
})

export const tsTypeOperatorSchema = tsTypeBaseSchema.extend({
  kind: z.literal('typeOperator'),
  typeOperator: z.unknown()
})

export const tsTypePredicateSchema = tsTypeBaseSchema.extend({
  kind: z.literal('typePredicate'),
  typePredicate: z.unknown()
})

export const tsTypeQuerySchema = tsTypeBaseSchema.extend({
  kind: z.literal('typeQuery'),
  typeQuery: z.unknown()
})

// Complete TsType union
const tsTypeUnionSchema = z.discriminatedUnion('kind', [
  tsTypeKeywordSchema,
  tsTypeLiteralTypeSchema,
  tsTypeObjectLiteralTypeSchema,
  tsTypeArraySchema,
  tsTypeTupleSchema,
  tsTypeReferenceSchema,
  tsTypeUnionTypeSchema,
  tsTypeIntersectionSchema,
  tsTypeConditionalTypeSchema,
  tsTypeInferTypeSchema,
  tsTypeIndexedTypeSchema,
  tsTypeMappedTypeSchema,
  tsTypeFnOrConstructorTypeSchema,
  tsTypeParenthesizedSchema,
  tsTypeRestSchema,
  tsTypeOptionalSchema,
  tsTypeIdentifierSchema,
  tsTypeIndexedAccessSchema,
  tsTypeOperatorSchema,
  tsTypePredicateSchema,
  tsTypeQuerySchema
])

// Param variants
export const paramIdentifierSchema = z.object({
  kind: z.literal('identifier'),
  name: z.string().optional(),
  optional: z.boolean().optional(),
  tsType: tsTypeSchema.nullable().optional()
})

export const paramArraySchema = z.object({
  kind: z.literal('array'),
  elements: z.array(z.lazy(() => paramSchema)).optional(),
  optional: z.boolean().optional(),
  tsType: tsTypeSchema.nullable().optional()
})

export const paramObjectSchema = z.object({
  kind: z.literal('object'),
  props: z.array(z.lazy(() => paramSchema)).optional(),
  optional: z.boolean().optional(),
  tsType: tsTypeSchema.nullable().optional()
})

export const paramRestSchema = z.object({
  kind: z.literal('rest'),
  arg: z.lazy(() => paramSchema).optional(),
  optional: z.boolean().optional(),
  tsType: tsTypeSchema.nullable().optional()
})

export const paramAssignSchema = z.object({
  kind: z.literal('assign'),
  left: z.lazy(() => paramSchema).optional(),
  right: z.unknown().optional(),
  optional: z.boolean().optional(),
  tsType: tsTypeSchema.nullable().optional()
})

export const paramKeyValueSchema = z.object({
  kind: z.literal('keyValue'),
  key: z.string().optional(),
  value: z.lazy(() => paramSchema).optional(),
  optional: z.boolean().optional(),
  tsType: tsTypeSchema.nullable().optional()
})

// Complete Param union
const paramUnionSchema = z.discriminatedUnion('kind', [
  paramIdentifierSchema,
  paramArraySchema,
  paramObjectSchema,
  paramRestSchema,
  paramAssignSchema,
  paramKeyValueSchema
])

// Definition types
export const variableDefSchema = z.object({
  tsType: tsTypeSchema,
  kind: variableKindSchema
})

export const typeAliasDefSchema = z.object({
  tsType: tsTypeSchema,
  typeParams: z.array(typeParamSchema)
})

export const classConstructorSchema = z.object({
  jsDoc: jsDocSchema.optional(),
  accessibility: accessibilitySchema.nullable().optional(),
  name: z.string(),
  params: z.array(paramSchema),
  location: locationSchema
})

export const classPropertySchema = z.object({
  jsDoc: jsDocSchema.optional(),
  tsType: tsTypeSchema.optional(),
  readonly: z.boolean(),
  accessibility: accessibilitySchema.nullable().optional(),
  optional: z.boolean(),
  isAbstract: z.boolean(),
  isStatic: z.boolean(),
  name: z.string(),
  location: locationSchema,
  decorators: z.array(decoratorSchema).optional()
})

export const classMethodSchema = z.object({
  jsDoc: jsDocSchema.optional(),
  accessibility: accessibilitySchema.nullable().optional(),
  optional: z.boolean(),
  isAbstract: z.boolean(),
  isStatic: z.boolean(),
  name: z.string(),
  kind: methodKindSchema,
  functionDef: functionDefSchema,
  location: locationSchema,
  decorators: z.array(decoratorSchema).optional()
})

export const classIndexSignatureSchema = z.object({
  readonly: z.boolean(),
  params: z.array(paramSchema),
  tsType: tsTypeSchema.optional()
})

export const classDefSchema = z.object({
  isAbstract: z.boolean(),
  constructors: z.array(classConstructorSchema),
  properties: z.array(classPropertySchema),
  methods: z.array(classMethodSchema),
  indexSignatures: z.array(classIndexSignatureSchema),
  superClass: tsTypeSchema.optional(),
  implements: z.array(tsTypeSchema),
  typeParams: z.array(typeParamSchema),
  decorators: z.array(decoratorSchema).optional()
})

export const interfaceMethodSchema = z.object({
  name: z.string(),
  location: locationSchema,
  jsDoc: jsDocSchema.optional(),
  optional: z.boolean(),
  params: z.array(paramSchema),
  returnType: tsTypeSchema.optional(),
  typeParams: z.array(typeParamSchema)
})

export const interfacePropertySchema = z.object({
  name: z.string(),
  location: locationSchema,
  jsDoc: jsDocSchema.optional(),
  params: z.array(paramSchema),
  computed: z.boolean(),
  optional: z.boolean(),
  tsType: tsTypeSchema,
  typeParams: z.array(typeParamSchema)
})

export const interfaceCallSignatureSchema = z.object({
  jsDoc: jsDocSchema.optional(),
  location: locationSchema,
  params: z.array(paramSchema),
  tsType: tsTypeSchema,
  typeParams: z.array(typeParamSchema)
})

export const interfaceIndexSignatureSchema = z.object({
  readonly: z.boolean(),
  params: z.array(paramSchema),
  tsType: tsTypeSchema.optional()
})

export const interfaceDefSchema = z.object({
  extends: z.array(tsTypeSchema),
  methods: z.array(interfaceMethodSchema),
  properties: z.array(interfacePropertySchema),
  callSignatures: z.array(interfaceCallSignatureSchema),
  indexSignatures: z.array(interfaceIndexSignatureSchema),
  typeParams: z.array(typeParamSchema)
})

export const namespaceDefSchema = z.object({
  elements: z.array(z.lazy(() => docNodeSchema))
})

export const enumMemberSchema = z.object({
  name: z.string(),
  jsDoc: jsDocSchema.optional(),
  location: locationSchema,
  init: tsTypeSchema.optional()
})

export const enumDefSchema = z.object({
  members: z.array(enumMemberSchema)
})

// DocNode base and variants
const docNodeBaseSchema = z.object({
  name: z.string(),
  isDefault: z.boolean().optional(),
  location: locationSchema,
  declarationKind: declarationKindSchema,
  jsDoc: jsDocSchema.optional()
})

export const moduleDocNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('moduleDoc')
})

export const variableNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('variable'),
  variableDef: variableDefSchema
})

export const typeAliasNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('typeAlias'),
  typeAliasDef: typeAliasDefSchema
})

export const functionNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('function'),
  functionDef: functionDefSchema
})

export const classNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('class'),
  classDef: classDefSchema
})

export const interfaceNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('interface'),
  interfaceDef: interfaceDefSchema
})

export const namespaceNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('namespace'),
  namespaceDef: namespaceDefSchema
})

export const enumNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('enum'),
  enumDef: enumDefSchema
})

export const importNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('import')
})

export const exportNodeSchema = docNodeBaseSchema.extend({
  kind: z.literal('export')
})

// Complete DocNode union
const docNodeUnionSchema = z.discriminatedUnion('kind', [
  moduleDocNodeSchema,
  variableNodeSchema,
  typeAliasNodeSchema,
  functionNodeSchema,
  classNodeSchema,
  interfaceNodeSchema,
  namespaceNodeSchema,
  enumNodeSchema,
  importNodeSchema,
  exportNodeSchema
])

// Main DocsJson schema
export const docsJsonSchema = z.object({
  version: z.number(),
  nodes: z.array(docNodeSchema)
})

// Export the lazy schemas properly typed
export { tsTypeSchema, docNodeSchema, paramSchema }
