import type { ImportNameArg } from '../dsl/Import.js';
import { Definition } from '../dsl/Definition.js';
import type { OasDocument } from '../oas/document/Document.js';
import type { OasSchema } from '../oas/schema/Schema.js';
import type { OasRef } from '../oas/ref/Ref.js';
import type { ClientGeneratorSettings, ClientSettings, EnrichedSetting } from '../types/Settings.js';
import type { Method } from '../types/Method.js';
import type { OperationInsertable, OperationGateway } from '../dsl/operation/OperationInsertable.js';
import type { OasOperation } from '../oas/operation/Operation.js';
import type { ModelInsertable } from '../dsl/model/ModelInsertable.js';
import type { GenerationType, GeneratedValue } from '../types/GeneratedValue.js';
import { ContentSettings } from '../dsl/ContentSettings.js';
import type { RefName } from '../types/RefName.js';
import type * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js';
import type { GeneratorKey } from '../types/GeneratorKeys.js';
import type { ResultType } from '../types/Results.js';
import type { StackTrail } from './StackTrail.js';
import type { Identifier } from '../dsl/Identifier.js';
import type { SchemaToValueFn, SchemaType, TypeSystemOutput } from '../types/TypeSystem.js';
import { Inserted } from '../dsl/Inserted.js';
import { File } from '../dsl/File.js';
import type { GeneratorsMap, GeneratorType } from '../types/GeneratorType.js';
type ConstructorArgs = {
    oasDocument: OasDocument;
    settings: ClientSettings | undefined;
    logger: log.Logger;
    callback: (generatorKey: GeneratorKey) => void;
    stackTrail: StackTrail;
    captureCurrentResult: (result: ResultType) => void;
    toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<GeneratorType<EnrichmentType>, EnrichmentType>;
};
export type PickArgs = {
    name: string;
    exportPath: string;
};
export type ApplyPackageImportsArgs = {
    destinationPath: string;
    exportPath: string;
};
export type RegisterArgs = {
    imports?: Record<string, ImportNameArg[]>;
    reExports?: Record<string, Identifier[]>;
    definitions?: (Definition | undefined)[];
    preview?: {
        [group: string]: string;
    };
    destinationPath: string;
};
export type CreateAndRegisterDefinition<Schema extends SchemaType> = {
    schema: Schema;
    identifier: Identifier;
    destinationPath: string;
    schemaToValueFn: SchemaToValueFn;
};
export type DefineAndRegisterArgs<V extends GeneratedValue> = {
    identifier: Identifier;
    value: V;
    destinationPath: string;
};
export type GetOperationSettingsArgs = {
    generatorId: string;
    path: string;
    method: Method;
};
export type AddRenderDependencyArgs = {
    generatorId: string;
    operation: OasOperation;
    dependencies: string[];
};
export type ToModelSettingsArgs = {
    generatorId: string;
    refName: RefName;
};
export type InsertOperationArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
    insertable: OperationInsertable<V, EnrichmentType>;
    operation: OasOperation;
    generation?: T;
    destinationPath?: string;
};
export type InsertModelArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
    insertable: ModelInsertable<V, EnrichmentType>;
    refName: RefName;
    generation?: T;
    destinationPath?: string;
};
export type InsertReturn<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = Inserted<V, T, EnrichmentType>;
type ToOperationSettingsArgs<V, EnrichmentType> = {
    operation: OasOperation;
    insertable: OperationInsertable<V, EnrichmentType>;
};
type BuildModelSettingsArgs<V, EnrichmentType> = {
    refName: RefName;
    insertable: ModelInsertable<V, EnrichmentType>;
};
type GenerateResult = {
    files: Map<string, File>;
    previews: Record<string, Record<string, string>>;
};
export declare class GenerateContext {
    #private;
    oasDocument: OasDocument;
    settings: ClientSettings | undefined;
    logger: log.Logger;
    callback: (generatorKey: GeneratorKey) => void;
    captureCurrentResult: (result: ResultType) => void;
    toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<GeneratorType<EnrichmentType>, EnrichmentType>;
    constructor({ oasDocument, settings, logger, callback, captureCurrentResult, stackTrail, toGeneratorsMap }: ConstructorArgs);
    /**
     * @internal
     */
    generate(): GenerateResult;
    trace<T>(token: string | string[], fn: () => T): T;
    /**
     * Converts schema to value using `schemaToValueFn` and creates definition
     * with the given `identifier` at `destinationPath`.
     *
     * If a definition with the same name already exists, it will be returned
     * instead of creating a new one.
     *
     * @experimental
     *
     * @param schema - The schema to create the definition for.
     * @param identifier - The identifier for the definition.
     * @param destinationPath - The path to the file where the definition will be registered.
     * @param schemaToValueFn - A function that converts the schema to a value.
     * @returns The created definition or cached definition if it already exists.
     */
    createAndRegisterDefinition<Schema extends SchemaType>({ schema, identifier, destinationPath, schemaToValueFn }: CreateAndRegisterDefinition<Schema>): Definition<TypeSystemOutput<Schema['type']>>;
    /**
     * Create and register a definition with the given `identifier` at `destinationPath`.
     *
     * @experimental
     */
    defineAndRegister<V extends GeneratedValue>({ identifier, value, destinationPath }: DefineAndRegisterArgs<V>): Definition<V>;
    /**
     * Insert supplied `imports` and `definitions` into file at `destinationPath`.
     *
     * If an import from a specified module already exists in the file, the
     * import names are appended to the existing import.
     *
     * Definitions will only be added if there is not already a definition with
     * the same name in the file.
     *
     * @mutates this.files
     */
    register({ imports, definitions, destinationPath, reExports, preview }: RegisterArgs): void;
    /**
     * Insert operation into the output file with path `destinationPath`.
     *
     * Insert will perform the following steps:
     * 1. Generate content settings for the supplied operation
     * 2. Look up definition in file with path `destinationPath`
     * 3. If definition is not found, it will create a new one and register it
     * 4. If the definition is defined at a location that is different from
     *    the current file, it will add an import to the current file from
     *    that location
     * 5. Use the content settings to generate the operation using the
     *    insertable's driver
     * @mutates this.files
     */
    insertOperation<V extends GeneratedValue, T extends GenerationType, ET>({ insertable, operation, generation, destinationPath }: InsertOperationArgs<V, T, ET>): Inserted<V, T, ET>;
    /**
     * Insert model into the output file with path `destinationPath`.
     *
     * Insert will perform the following steps:
     * 1. Generate content settings for the supplied model
     * 2. Look up definition in file with path `destinationPath`
     * 3. If definition is not found, it will create a new one and register it
     * 4. If the definition is defined at a location that is different from
     *    the current file, it will add an import to the current file from
     *    that location
     * 5. Use the content settings to generate the model using the
     *    insertable's driver
     * @mutates this.files
     */
    insertModel<V extends GeneratedValue, T extends GenerationType, EnrichmentType>({ insertable, refName, generation, destinationPath }: InsertModelArgs<V, T, EnrichmentType>): Inserted<V, T, EnrichmentType>;
    /**
     * Generate and return content settings for operation insertable and
     * operation.
     *
     * Content settings are produced by passing base settings and operation
     * through toIdentifier and toExportPath static methods on the
     * insertable.
     * @param { operation, insertable }
     * @returns
     */
    toOperationContentSettings<V, EnrichmentType>({ operation, insertable }: ToOperationSettingsArgs<V, EnrichmentType>): ContentSettings<EnrichmentType>;
    /**
     * Generate and return content settings for model insertable and refName.
     *
     * Content settings are produced by passing base settings and refName
     * through toIdentifier and toExportPath static methods on the
     * insertable.
     * @param { refName, insertable }
     * @returns Content settings for model
     */
    toModelContentSettings<V, EnrichmentType>({ refName, insertable }: BuildModelSettingsArgs<V, EnrichmentType>): ContentSettings<EnrichmentType>;
    /**
     * Generate and return content settings for a gateway
     *
     * Content settings are produced by passing base settings
     * through toIdentifier, toExportPath methods on the gateway
     * @param gateway
     * @returns Content settings for model
     */
    toGatewayContentSetting<EnrichmentType>(gateway: OperationGateway<EnrichmentType>): ContentSettings<undefined>;
    /**
     * Look up operation settings for a given generatorId, path and method.
     * @param { generatorId, path, method }
     * @returns Base settings for operation
     */
    toOperationSettings({ generatorId, path, method }: GetOperationSettingsArgs): EnrichedSetting;
    toModelSettings({ generatorId, refName }: ToModelSettingsArgs): EnrichedSetting;
    toGeneratorSettings(generatorId: string): ClientGeneratorSettings | undefined;
    /**
     * Perform one lookup of schema by `refName`.
     * @param refName
     * @returns Matching schema or ref
     * @throws if schema is not found
     */
    resolveSchemaRefOnce(refName: RefName): OasSchema | OasRef<'schema'>;
    /**
     * Check if definition name `name` in file with path `exportPath`
     * has already been created and registered.
     *
     * @param { name, exportPath }
     * @returns Matching definition if found or `undefined` otherwise
     */
    findDefinition({ name, exportPath }: PickArgs): Definition | undefined;
}
export {};
//# sourceMappingURL=GenerateContext.d.ts.map