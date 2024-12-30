var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
import { toModelGeneratorKey } from '../../types/GeneratorKeys.js';
import { ModelBase } from './ModelBase.js';
export const toModelInsertable = (config) => {
    var _a;
    const ModelInsertable = (_a = class extends ModelBase {
            constructor(args) {
                super({
                    ...args,
                    generatorKey: toModelGeneratorKey({
                        generatorId: config.id,
                        refName: args.refName
                    })
                });
            }
        },
        __setFunctionName(_a, "ModelInsertable"),
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
            value: 'model'
        }),
        Object.defineProperty(_a, "_class", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ModelInsertable'
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
            value: ({ refName, context }) => {
                const generatorSettings = context.toModelSettings({
                    refName,
                    generatorId: config.id
                });
                return config.toEnrichmentSchema().parse(generatorSettings.enrichments);
            }
        }),
        Object.defineProperty(_a, "isSupported", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => true
        }),
        Object.defineProperty(_a, "pinnable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        }),
        _a);
    return ModelInsertable;
};
