import { ValueBase } from '../ValueBase.js';
export class OperationBase extends ValueBase {
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
        this.context.register({
            ...args,
            destinationPath: this.settings.exportPath
        });
    }
}
