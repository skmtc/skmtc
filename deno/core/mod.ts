/**
 * @module SKMTC Core
 * 
 * SKMTC (Schema Kit Mapping & Type Conversion) is a powerful TypeScript/Deno library
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
 * - {@link ContentBase} - Base class for creating generators
 * - {@link ModelBase} and {@link OperationBase} - DSL building blocks
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
 *   prettier: prettierConfig,
 *   silent: false
 * });
 * ```
 */

export * from './app/validate.ts'
export * from './context/CoreContext.ts'
export * from './context/GenerateContext.ts'
export * from './context/ParseContext.ts'
export * from './dsl/constants.ts'
export * from './dsl/ContentBase.ts'
export * from './dsl/ContentSettings.ts'
export * from './dsl/Definition.ts'
export * from './dsl/EntityType.ts'
export * from './dsl/GeneratedValueList.ts'
export * from './dsl/Identifier.ts'
export * from './dsl/Import.ts'
export * from './dsl/Inserted.ts'
export * from './dsl/model/ModelBase.ts'
export * from './dsl/model/ModelDriver.ts'
export * from './dsl/model/toModelBase.ts'
export * from './dsl/model/toModelEntry.ts'
export * from './dsl/model/types.ts'
export * from './dsl/operation/OperationBase.ts'
export * from './dsl/operation/OperationDriver.ts'
export * from './dsl/operation/toOperationBase.ts'
export * from './dsl/operation/toOperationEntry.ts'
export * from './dsl/operation/types.ts'
export * from './dsl/Stringable.ts'
export * from './helpers/collateExamples.ts'
export * from './helpers/formatNumber.ts'
export * from './helpers/generationStats.ts'
export * from './helpers/isEmpty.ts'
export * from './helpers/isImported.ts'
export * from './helpers/naming.ts'
export * from './helpers/refFns.ts'
export * from './helpers/strings.ts'
export * from './helpers/parseModuleName.ts'
export * from './helpers/toResolvedArtifactPath.ts'
export * from './oas/array/Array.ts'
export * from './oas/boolean/Boolean.ts'
export * from './oas/components/Components.ts'
export * from './oas/discriminator/Discriminator.ts'
export * from './oas/document/Document.ts'
export * from './oas/info/Info.ts'
export * from './oas/integer/Integer.ts'
export * from './oas/number/Number.ts'
export * from './oas/object/Object.ts'
export * from './oas/operation/Operation.ts'
export * from './oas/parameter/Parameter.ts'
export * from './oas/ref/Ref.ts'
export * from './oas/requestBody/RequestBody.ts'
export * from './oas/response/Response.ts'
export * from './oas/schema/Schema.ts'
export * from './oas/string/String.ts'
export * from './oas/tag/Tag.ts'
export * from './oas/union/Union.ts'
export * from './oas/unknown/Unknown.ts'
export * from './oas/void/Void.ts'
export * from './run/toArtifacts.ts'
export * from './run/toV3JsonDocument.ts'
export * from './types/CustomValue.ts'
export * from './types/DenoJson.ts'
export * from './types/EnrichmentRequest.ts'
export * from './types/Enrichments.ts'
export * from './types/GeneratedValue.ts'
export * from './types/GeneratorKeys.ts'
export * from './types/GeneratorType.ts'
export * from './types/Manifest.ts'
export * from './types/Method.ts'
export * from './types/Modifiers.ts'
export * from './types/ModuleExport.ts'
export * from './types/PrettierConfig.ts'
export * from './types/Preview.ts'
export * from './types/RefName.ts'
export * from './types/Settings.ts'
export * from './types/TypeSystem.ts'
export * from './typescript/FunctionParameter.ts'
export * from './typescript/identifiers.ts'
export * from './typescript/keyValues.ts'
export * from './typescript/List.ts'
export * from './typescript/PathParams.ts'
export * from './typescript/ReactRouterPathParams.ts'
export * from './typescript/toPathTemplate.ts'
export * from './typescript/toPathParams.ts'
export * from './typescript/withDescription.ts'
