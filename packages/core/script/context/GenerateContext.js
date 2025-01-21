"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _GenerateContext_instances, _GenerateContext_files, _GenerateContext_previews, _GenerateContext_stackTrail, _GenerateContext_runOperationGenerator, _GenerateContext_runModelGenerator, _GenerateContext_getFile, _GenerateContext_addFile;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateContext = void 0;
const mod_js_1 = require("../deps/jsr.io/@std/path/1.0.6/mod.js");
const Import_js_1 = require("../dsl/Import.js");
const Definition_js_1 = require("../dsl/Definition.js");
const OperationDriver_js_1 = require("../dsl/operation/OperationDriver.js");
const ModelDriver_js_1 = require("../dsl/model/ModelDriver.js");
const ContentSettings_js_1 = require("../dsl/ContentSettings.js");
const Sentry = __importStar(require("@sentry/deno"));
const tracer_js_1 = require("../helpers/tracer.js");
const Inserted_js_1 = require("../dsl/Inserted.js");
const File_js_1 = require("../dsl/File.js");
const tiny_invariant_1 = __importDefault(require("tiny-invariant"));
class GenerateContext {
    constructor({ oasDocument, settings, logger, callback, captureCurrentResult, stackTrail, toGeneratorsMap }) {
        _GenerateContext_instances.add(this);
        _GenerateContext_files.set(this, void 0);
        _GenerateContext_previews.set(this, void 0);
        Object.defineProperty(this, "oasDocument", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "callback", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "captureCurrentResult", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "toGeneratorsMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _GenerateContext_stackTrail.set(this, void 0);
        this.logger = logger;
        __classPrivateFieldSet(this, _GenerateContext_files, new Map(), "f");
        __classPrivateFieldSet(this, _GenerateContext_previews, {}, "f");
        this.oasDocument = oasDocument;
        this.settings = settings;
        this.callback = callback;
        __classPrivateFieldSet(this, _GenerateContext_stackTrail, stackTrail, "f");
        this.captureCurrentResult = captureCurrentResult;
        this.toGeneratorsMap = toGeneratorsMap;
    }
    /**
     * @internal
     */
    generate() {
        const generators = Object.values(this.toGeneratorsMap());
        Sentry.startSpan({ name: 'Generate operations' }, () => generators
            .filter(generator => generator.type === 'operation')
            .forEach(generator => {
            this.trace(generator.id, () => {
                __classPrivateFieldGet(this, _GenerateContext_instances, "m", _GenerateContext_runOperationGenerator).call(this, { oasDocument: this.oasDocument, generator });
            });
        }));
        Sentry.startSpan({ name: 'Generate models' }, () => {
            generators
                .filter(generator => generator.type === 'model')
                .forEach(generator => {
                this.trace(generator.id, () => {
                    __classPrivateFieldGet(this, _GenerateContext_instances, "m", _GenerateContext_runModelGenerator).call(this, { oasDocument: this.oasDocument, generator });
                });
            });
        });
        return {
            files: __classPrivateFieldGet(this, _GenerateContext_files, "f"),
            previews: __classPrivateFieldGet(this, _GenerateContext_previews, "f")
        };
    }
    trace(token, fn) {
        return (0, tracer_js_1.tracer)(__classPrivateFieldGet(this, _GenerateContext_stackTrail, "f"), token, fn);
    }
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
    createAndRegisterDefinition({ schema, identifier, destinationPath, schemaToValueFn }) {
        const cachedDefinition = this.findDefinition({
            name: identifier.name,
            exportPath: destinationPath
        });
        // @TODO add check to make sure retrieved definition
        // used same generator and same schema #SKM-47
        if (cachedDefinition) {
            return cachedDefinition;
        }
        const value = schemaToValueFn({
            context: this,
            schema,
            destinationPath,
            required: true
        });
        return this.defineAndRegister({
            identifier,
            value,
            destinationPath
        });
    }
    /**
     * Create and register a definition with the given `identifier` at `destinationPath`.
     *
     * @experimental
     */
    defineAndRegister({ identifier, value, destinationPath }) {
        // @TODO cache check is duplicatd if call comes from
        // createAndRegisterDefinition. Look for a way to share code between
        // these two functions
        const cachedDefinition = this.findDefinition({
            name: identifier.name,
            exportPath: destinationPath
        });
        // @TODO add check to make sure retrieved definition
        // used same generator and same schema #SKM-47
        if (cachedDefinition) {
            return cachedDefinition;
        }
        const definition = new Definition_js_1.Definition({
            context: this,
            identifier,
            value
        });
        this.register({
            definitions: [definition],
            destinationPath
        });
        return definition;
    }
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
    register({ imports = {}, definitions, destinationPath, reExports, preview }) {
        // TODO deduplicate import names and definition names against each other
        const currentFile = __classPrivateFieldGet(this, _GenerateContext_instances, "m", _GenerateContext_getFile).call(this, destinationPath);
        Object.entries(reExports ?? {}).forEach(([importModule, identifiers]) => {
            if (!currentFile.reExports.get(importModule) && identifiers.length) {
                currentFile.reExports.set(importModule, {});
            }
            identifiers.forEach(identifier => {
                const entityType = identifier.entityType.type;
                const module = currentFile.reExports.get(importModule);
                (0, tiny_invariant_1.default)(module, 'Module not found');
                if (!module[entityType]) {
                    module[entityType] = new Set();
                }
                module[entityType].add(identifier.name);
            });
        });
        Object.entries(imports).forEach(([importModule, importNames]) => {
            const module = currentFile.imports.get(importModule);
            const importItem = new Import_js_1.Import({ module: importModule, importNames });
            if (module) {
                importItem.importNames.forEach(n => module.add(`${n}`));
            }
            else {
                currentFile.imports.set(importModule, new Set(importItem.importNames.map(n => `${n}`)));
            }
        });
        definitions?.forEach(definition => {
            if (!definition) {
                return;
            }
            const { name } = definition.identifier;
            if (!currentFile.definitions.has(name)) {
                currentFile.definitions.set(name, definition);
            }
        });
        Object.entries(preview ?? {}).forEach(([group, { name, route, source, input, formatter }]) => {
            if (!__classPrivateFieldGet(this, _GenerateContext_previews, "f")[group]) {
                __classPrivateFieldGet(this, _GenerateContext_previews, "f")[group] = {};
            }
            __classPrivateFieldGet(this, _GenerateContext_previews, "f")[group][name] = {
                name,
                exportPath: destinationPath,
                group,
                route,
                source,
                ...(input ? { input } : {}),
                ...(formatter ? { formatter } : {})
            };
        });
    }
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
    insertOperation({ insertable, operation, generation, destinationPath }) {
        const { settings, definition } = new OperationDriver_js_1.OperationDriver({
            context: this,
            insertable,
            operation,
            generation,
            destinationPath
        });
        return new Inserted_js_1.Inserted({ settings, definition });
    }
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
    insertModel({ insertable, refName, generation, destinationPath }) {
        const { settings, definition } = new ModelDriver_js_1.ModelDriver({
            context: this,
            insertable,
            refName,
            generation,
            destinationPath
        });
        return new Inserted_js_1.Inserted({ settings, definition });
    }
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
    toOperationContentSettings({ operation, insertable }) {
        const settings = this.toOperationSettings({
            generatorId: insertable.id,
            path: operation.path,
            method: operation.method
        });
        return new ContentSettings_js_1.ContentSettings({
            selected: Boolean(settings),
            identifier: insertable.toIdentifier(operation),
            exportPath: insertable.toExportPath(operation),
            enrichments: insertable.toEnrichments({ operation, context: this })
        });
    }
    /**
     * Generate and return content settings for model insertable and refName.
     *
     * Content settings are produced by passing base settings and refName
     * through toIdentifier and toExportPath static methods on the
     * insertable.
     * @param { refName, insertable }
     * @returns Content settings for model
     */
    toModelContentSettings({ refName, insertable }) {
        const selected = this.toModelSettings({
            generatorId: insertable.id,
            refName
        });
        return new ContentSettings_js_1.ContentSettings({
            identifier: insertable.toIdentifier(refName),
            selected: Boolean(selected),
            exportPath: insertable.toExportPath(refName),
            enrichments: insertable.toEnrichments({ refName, context: this })
        });
    }
    /**
     * Generate and return content settings for a gateway
     *
     * Content settings are produced by passing base settings
     * through toIdentifier, toExportPath methods on the gateway
     * @param gateway
     * @returns Content settings for model
     */
    toGatewayContentSetting(gateway) {
        return new ContentSettings_js_1.ContentSettings({
            identifier: gateway.toIdentifier(),
            selected: true,
            exportPath: gateway.toExportPath(),
            enrichments: undefined
        });
    }
    /**
     * Look up operation settings for a given generatorId, path and method.
     * @param { generatorId, path, method }
     * @returns Base settings for operation
     */
    toOperationSettings({ generatorId, path, method }) {
        const generatorSettings = this.toGeneratorSettings(generatorId);
        const operationSettings = generatorSettings && 'operations' in generatorSettings
            ? generatorSettings.operations[path]?.[method]
            : undefined;
        return operationSettings ?? { selected: false, enrichments: undefined };
    }
    toModelSettings({ generatorId, refName }) {
        const generatorSettings = this.toGeneratorSettings(generatorId);
        const modelSettings = generatorSettings && 'models' in generatorSettings
            ? generatorSettings.models[refName]
            : undefined;
        return modelSettings ?? { selected: false, enrichments: undefined };
    }
    toGeneratorSettings(generatorId) {
        return this.settings?.generators?.find(({ id }) => id === generatorId);
    }
    /**
     * Perform one lookup of schema by `refName`.
     * @param refName
     * @returns Matching schema or ref
     * @throws if schema is not found
     */
    resolveSchemaRefOnce(refName) {
        const schema = this.oasDocument.components?.schemas?.[refName]?.resolveOnce();
        if (!schema) {
            throw new Error(`Schema not found: ${refName}`);
        }
        return schema;
    }
    /**
     * Check if definition name `name` in file with path `exportPath`
     * has already been created and registered.
     *
     * @param { name, exportPath }
     * @returns Matching definition if found or `undefined` otherwise
     */
    findDefinition({ name, exportPath }) {
        return __classPrivateFieldGet(this, _GenerateContext_instances, "m", _GenerateContext_getFile).call(this, exportPath).definitions.get(name);
    }
}
exports.GenerateContext = GenerateContext;
_GenerateContext_files = new WeakMap(), _GenerateContext_previews = new WeakMap(), _GenerateContext_stackTrail = new WeakMap(), _GenerateContext_instances = new WeakSet(), _GenerateContext_runOperationGenerator = function _GenerateContext_runOperationGenerator({ oasDocument, generator }) {
    if (generator._class === 'OperationGateway') {
        const gatewaySettings = this.toGatewayContentSetting(generator);
        const gatewayInstance = new generator({
            context: this,
            settings: gatewaySettings
        });
        oasDocument.operations.forEach(operation => {
            // TODO If we make OasOperation generic, for example by
            // adding a `method` type, we could make isSupported
            // a type guard which could help us narrow down the
            // exact operation type that a generator receives.
            // This would allow us to remove some type checks
            // in the generator implementations
            // https://linear.app/skmtc/issue/SKM-32/generic-models-operations
            const { path, method } = operation;
            this.trace([path, method], () => {
                if (!generator.isSupported({
                    operation,
                    context: this
                })) {
                    return this.captureCurrentResult('notSupported');
                }
                const settings = this.toOperationSettings({
                    generatorId: generator.id,
                    path,
                    method
                });
                if (!settings) {
                    return this.captureCurrentResult('notSelected');
                }
                gatewayInstance.transformOperation(operation);
                this.captureCurrentResult('success');
            });
        });
        return this.defineAndRegister({
            identifier: gatewaySettings.identifier,
            value: gatewayInstance,
            destinationPath: gatewaySettings.exportPath
        });
    }
    if (generator._class === 'OperationInsertable') {
        return oasDocument.operations.forEach(operation => {
            // TODO If we make OasOperation generic, for example by
            // adding a `method` type, we could make isSupported
            // a type guard which could help us narrow down the
            // exact operation type that a generator receives.
            // This would allow us to remove some type checks
            // in the generator implementations
            // https://linear.app/skmtc/issue/SKM-32/generic-models-operations
            const { path, method } = operation;
            this.trace([path, method], () => {
                if (!generator.isSupported({ operation, context: this })) {
                    return this.captureCurrentResult('notSupported');
                }
                const settings = this.toOperationSettings({
                    generatorId: generator.id,
                    path,
                    method
                });
                if (!settings) {
                    return this.captureCurrentResult('notSelected');
                }
                this.insertOperation({ insertable: generator, operation });
                this.captureCurrentResult('success');
            });
        });
    }
    throw new Error(`Unknown generator type`);
}, _GenerateContext_runModelGenerator = function _GenerateContext_runModelGenerator({ oasDocument, generator }) {
    const refNames = oasDocument.components?.toSchemasRefNames() ?? [];
    return refNames.forEach(refName => {
        this.trace(refName, () => {
            if (!generator.isSupported()) {
                return this.captureCurrentResult('notSupported');
            }
            const selected = this.toModelSettings({
                generatorId: generator.id,
                refName
            });
            if (!selected) {
                return this.captureCurrentResult('notSelected');
            }
            this.insertModel({ insertable: generator, refName });
            this.captureCurrentResult('success');
        });
    });
}, _GenerateContext_getFile = function _GenerateContext_getFile(filePath, { throwIfNotFound = false } = {}) {
    const normalisedPath = (0, mod_js_1.normalize)(filePath);
    const currentFile = __classPrivateFieldGet(this, _GenerateContext_files, "f").get(normalisedPath);
    if (!currentFile) {
        if (throwIfNotFound) {
            throw new Error(`File not found: '${normalisedPath}'`);
        }
        else {
            return __classPrivateFieldGet(this, _GenerateContext_instances, "m", _GenerateContext_addFile).call(this, normalisedPath);
        }
    }
    return currentFile;
}, _GenerateContext_addFile = function _GenerateContext_addFile(normalisedPath) {
    if (__classPrivateFieldGet(this, _GenerateContext_files, "f").has(normalisedPath)) {
        throw new Error(`File already exists: ${normalisedPath}`);
    }
    const newFile = new File_js_1.File({ path: normalisedPath, settings: this.settings });
    __classPrivateFieldGet(this, _GenerateContext_files, "f").set(normalisedPath, newFile);
    return newFile;
};
