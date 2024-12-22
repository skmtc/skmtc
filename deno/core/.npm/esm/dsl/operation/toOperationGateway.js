var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
import { GatewayBase } from '../GatewayBase.js';
export const toOperationGateway = (config) => {
    var _a;
    const OperationGateway = (_a = class extends GatewayBase {
            constructor({ context, settings }) {
                super({ context, settings });
            }
        },
        __setFunctionName(_a, "OperationGateway"),
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
            value: 'OperationGateway'
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
        Object.defineProperty(_a, "isSupported", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.isSupported ?? (() => true)
        }),
        Object.defineProperty(_a, "pinnable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        }),
        _a);
    return OperationGateway;
};
