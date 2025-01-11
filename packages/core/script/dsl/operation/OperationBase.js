"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationBase = void 0;
const GeneratorKeys_js_1 = require("../../types/GeneratorKeys.js");
const ValueBase_js_1 = require("../ValueBase.js");
class OperationBase extends ValueBase_js_1.ValueBase {
    constructor({ context, generatorKey, settings, operation }) {
        super({ context });
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "operation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "generatorKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.generatorKey = generatorKey;
        this.operation = operation;
        this.settings = settings;
    }
    insertOperation(insertable, operation) {
        return this.context.insertOperation({
            insertable,
            operation,
            generation: 'force',
            destinationPath: this.settings.exportPath
        });
    }
    insertModel(insertable, refName) {
        return this.context.insertModel({
            insertable,
            refName,
            generation: 'force',
            destinationPath: this.settings.exportPath
        });
    }
    createAndRegisterDefinition({ schema, identifier, schemaToValueFn }) {
        return this.context.createAndRegisterDefinition({
            schema,
            identifier,
            schemaToValueFn,
            destinationPath: this.settings.exportPath
        });
    }
    register(args) {
        const preview = Object.keys(args.preview ?? {}).length
            ? Object.fromEntries(Object.entries(args.preview ?? {}).map(([group, preview]) => {
                const previewWithSource = {
                    ...preview,
                    source: {
                        type: 'operation',
                        generatorId: (0, GeneratorKeys_js_1.toGeneratorId)(this.generatorKey),
                        operationPath: this.operation.path,
                        operationMethod: this.operation.method
                    }
                };
                return [group, previewWithSource];
            }))
            : undefined;
        this.context.register({
            ...args,
            preview,
            destinationPath: this.settings.exportPath
        });
    }
}
exports.OperationBase = OperationBase;
