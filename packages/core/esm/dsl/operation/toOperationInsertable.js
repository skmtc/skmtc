var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
import { toOperationGeneratorKey } from '../../types/GeneratorKeys.js';
import { OperationBase } from './OperationBase.js';
export const toOperationInsertable = (config) => {
    var _a;
    const OperationInsertable = (_a = class extends OperationBase {
            constructor(args) {
                super({
                    ...args,
                    generatorKey: toOperationGeneratorKey({
                        generatorId: config.id,
                        operation: args.operation
                    })
                });
            }
        },
        __setFunctionName(_a, "OperationInsertable"),
        Object.defineProperty(_a, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.id
        }),
        Object.defineProperty(_a, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'operation'
        }),
        Object.defineProperty(_a, "_class", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OperationInsertable'
        }),
        Object.defineProperty(_a, "toIdentifier", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.toIdentifier.bind(config)
        }),
        Object.defineProperty(_a, "toExportPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.toExportPath.bind(config)
        }),
        Object.defineProperty(_a, "toEnrichmentRequest", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.toEnrichmentRequest?.bind(config)
        }),
        Object.defineProperty(_a, "toEnrichmentSchema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.toEnrichmentSchema.bind(config)
        }),
        Object.defineProperty(_a, "toEnrichments", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ({ operation, context }) => {
                const generatorSettings = context.toOperationSettings({
                    generatorId: config.id,
                    path: operation.path,
                    method: operation.method
                });
                const responseSchema = config.toEnrichmentSchema?.();
                return responseSchema?.parse(generatorSettings.enrichments);
            }
        }),
        Object.defineProperty(_a, "isSupported", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ({ context, operation }) => {
                if (typeof config.isSupported !== 'function') {
                    return true;
                }
                const enrichments = OperationInsertable.toEnrichments({ operation, context });
                return config.isSupported({ context, operation, enrichments });
            }
        }),
        Object.defineProperty(_a, "pinnable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.pinnable ?? false
        }),
        _a);
    return OperationInsertable;
};
