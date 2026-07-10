/**
 * @module SKMTC Core
 *
 * SKMTC is a powerful TypeScript/Deno library
 * for processing OpenAPI v3 documents and generating code artifacts. It provides a
 * comprehensive three-phase pipeline for parsing, generating, and rendering OpenAPI
 * schemas into various output formats.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { toArtifacts } from '@skmtc/core';
 *
 * const result = await toArtifacts({
 *   traceId: 'my-trace',
 *   spanId: 'my-span',
 *   documentObject: openApiDoc,
 *   settings: clientSettings,
 *   toGeneratorConfigMap: () => generatorMap,
 *   startAt: Date.now(),
 *   silent: false
 * });
 *
 * console.log(result.artifacts); // Generated code files
 * console.log(result.manifest);  // Generation metadata
 * ```
 *
 * ## Architecture
 *
 * The library follows a three-phase pipeline:
 * - **Parse Phase**: Converts OpenAPI v3 JSON into internal OAS objects
 * - **Generate Phase**: Transforms OAS objects into generator artifacts
 * - **Render Phase**: Renders artifacts to formatted files
 *
 * ## Key Components
 *
 * - {@link CoreContext} - Main orchestration class for the pipeline
 * - {@link toArtifacts} - Primary transformation function
 * - {@link SnippetBase} - Abstract root for both Projections (named, exported
 *   artifacts) and Snippets (anonymous, embedded values)
 * - {@link toModelProjectionBase}, {@link toOasOperationProjectionBase}, and
 *   {@link toGqlOperationProjectionBase} - the projection-base factories
 *   language packages build their veneers on
 * - {@link List} - Powerful string manipulation and code generation utility
 *
 * ## Type System
 *
 * The library provides comprehensive TypeScript types for OpenAPI schemas,
 * generator configurations, and output artifacts. All major types are
 * validated using Valibot schemas for runtime safety.
 *
 * @example Basic Usage
 * ```typescript
 * import { CoreContext } from '@skmtc/core';
 *
 * const context = new CoreContext({
 *   spanId: 'my-span',
 *   silent: false
 * });
 *
 * const result = await context.toArtifacts({
 *   documentObject: myOpenApiDoc,
 *   settings: mySettings,
 *   toGeneratorConfigMap: () => myGenerators,
 *   silent: false
 * });
 * ```
 */

export * from './app/validate.ts'
export * from './context/CoreContext.ts'
export * from './context/GenerateContext.ts'
export * from './context/ParseContext.ts'
export * from './context/RenderContext.ts'
export * from './context/generateTypes.ts'
export * from './dsl/constants.ts'
export * from './dsl/SnippetBase.ts'
export * from './dsl/Lang.ts'
export * from './dsl/ContentSettings.ts'
export * from './dsl/Definition.ts'
export * from './dsl/FileBase.ts'
export * from './dsl/CodeFileBase.ts'
export * from './dsl/ImportBase.ts'
export * from './dsl/ReExportBase.ts'
export * from './dsl/JsonFile.ts'
export * from './dsl/MarkdownFile.ts'
export * from './dsl/GeneratedValueList.ts'
export * from './dsl/IdentifierBase.ts'
export * from './dsl/IdentifierType.ts'
export * from './dsl/Inserted.ts'
export * from './dsl/model/ModelDriver.ts'
export * from './dsl/model/toModelProjectionBase.ts'
export * from './dsl/model/toModelEntry.ts'
export * from './dsl/model/types.ts'
export * from './dsl/operation/oas/OasOperationDriver.ts'
export * from './dsl/operation/oas/toOasOperationProjectionBase.ts'
export * from './dsl/operation/oas/toOasOperationEntry.ts'
export * from './dsl/operation/oas/types.ts'
export * from './dsl/webhook/WebhookDriver.ts'
export * from './dsl/webhook/toWebhookProjectionBase.ts'
export * from './dsl/webhook/toWebhookEntry.ts'
export * from './dsl/webhook/types.ts'
export * from './dsl/operation/gql/GqlOperationDriver.ts'
export * from './dsl/operation/gql/toGqlOperationProjectionBase.ts'
export * from './dsl/operation/gql/toGqlOperationEntry.ts'
export * from './dsl/operation/gql/types.ts'
export * from './dsl/Stringable.ts'
export * from './helpers/collateExamples.ts'
export * from './helpers/formatNumber.ts'
export * from './helpers/isEmpty.ts'
export * from './helpers/isImported.ts'
export * from './helpers/isGeneratorName.ts'
export * from './helpers/naming.ts'
export * from './helpers/refFns.ts'
export * from './helpers/strings.ts'
export * from './helpers/parseModuleName.ts'
export * from './helpers/toResolvedArtifactPath.ts'
export * from './helpers/withVariant.ts'
export * from './helpers/toVariantList.ts'
export * from './context/StackTrail.ts'
export * from './oas/array/Array.ts'
export * from './oas/array/array-types.ts'
export * from './parse/v3-0/array/toArray.ts'
export * from './oas/boolean/Boolean.ts'
export * from './oas/boolean/boolean-types.ts'
export * from './parse/v3-0/boolean/toBoolean.ts'
export * from './oas/components/Components.ts'
export * from './oas/contact/Contact.ts'
export * from './oas/contact/contact-types.ts'
export * from './oas/discriminator/Discriminator.ts'
export * from './oas/discriminator/discriminator-types.ts'
export * from './oas/document/Document.ts'
export * from './oas/example/Example.ts'
export * from './oas/example/example-types.ts'
export * from './oas/header/Header.ts'
export * from './oas/link/Link.ts'
export * from './oas/externalDocs/ExternalDocs.ts'
export * from './oas/info/Info.ts'
export * from './oas/info/info-types.ts'
export * from './oas/license/License.ts'
export * from './oas/license/license-types.ts'
export * from './oas/mediaType/MediaType.ts'
export * from './oas/integer/Integer.ts'
export * from './oas/integer/integer-types.ts'
export * from './parse/v3-0/integer/toInteger.ts'
export * from './oas/number/Number.ts'
export * from './oas/number/number-types.ts'
export * from './parse/v3-0/number/toNumber.ts'
export * from './oas/object/Object.ts'
export * from './parse/v3-0/object/toObject.ts'
export * from './oas/operation/Operation.ts'
export * from './oas/webhook/Webhook.ts'
export * from './parse/v3-0/webhook/toWebhooksV3.ts'
export * from './oas/parameter/Parameter.ts'
export * from './oas/parameter/parameter-types.ts'
export * from './oas/pathItem/PathItem.ts'
export * from './oas/ref/Ref.ts'
export * from './oas/ref/ref-types.ts'
export * from './parse/v3-0/ref/toRefV31.ts'
export * from './oas/requestBody/RequestBody.ts'
export * from './oas/response/Response.ts'
export * from './oas/schema/Schema.ts'
export * from './oas/schemaPath/traverseSchema.ts'
export * from './parse/v3-0/schema/toSchemasV3.ts'
export * from './oas/securityRequirement/SecurityRequirement.ts'
export * from './oas/securitySchemes/SecurityScheme.ts'
export * from './oas/server/Server.ts'
export * from './oas/serverVariable/ServerVariable.ts'
export * from './oas/string/String.ts'
export * from './oas/string/string-types.ts'
export * from './parse/v3-0/string/toString.ts'
export * from './oas/tag/Tag.ts'
export * from './oas/tag/tag-types.ts'
export * from './oas/union/Union.ts'
export * from './parse/v3-0/union/toUnion.ts'
export * from './oas/unknown/Unknown.ts'
export * from './oas/unknown/unknown-types.ts'
export * from './parse/v3-0/unknown/toUnknown.ts'
export * from './oas/void/Void.ts'
export * from './run/toArtifacts.ts'
export * from './run/toInspection.ts'
export * from './run/toSupportedSubjects.ts'
export type * from './types/SupportedSubjects.ts'
export * from './run/toEnrichmentDefaults.ts'
export type * from './types/EnrichmentDefaults.ts'
export * from './dsl/CustomValue.ts'
export * from './types/DenoJson.ts'
export * from './types/EnrichmentRequest.ts'
export * from './types/Enrichments.ts'
export * from './dsl/GeneratedValue.ts'
export * from './dsl/GeneratorKeys.ts'
export * from './types/GeneratorType.ts'
export * from './types/Logger.ts'
export * from './types/Manifest.ts'
export * from './types/Method.ts'
export * from './types/Modifiers.ts'
export * from './types/ModuleExport.ts'
export * from './types/ModuleSelect.ts'
export * from './types/SchemaPath.ts'
export * from './enrichments/toEnrichmentDescriptor.ts'
export * from './enrichments/validateConfig.ts'
export * from './enrichments/readEnrichments.ts'
export * from './types/Preview.ts'
export * from './types/RefName.ts'
export * from './types/Results.ts'
export * from './types/Settings.ts'
export * from './types/ClientJsonCompact.ts'
export * from './types/SkmtcDocument.ts'
export * from './types/TypeSystem.ts'
export * from './types/Variant.ts'
export * from './gql/document/GqlDocument.ts'
export * from './gql/registry/GqlRegistry.ts'
export * from './gql/operation/GqlOperation.ts'
export * from './gql/operation/synthesizeArgsObject.ts'
export * from './gql/argument/GqlArgument.ts'
export * from './gql/rootType/GqlRootTypes.ts'
export * from './context/ParseIssue.ts'
// GraphQL parser entry points are imported directly from their specific
// files (e.g. `parsers/graphql/toGqlDocument.ts`) rather than through a
// barrel — the unified `ParseContext` is the primary surface for GQL
// parsing and lives in `context/ParseContext.ts`, already exported
// above.
