"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayBase = void 0;
const ValueBase_js_1 = require("./ValueBase.js");
class GatewayBase extends ValueBase_js_1.ValueBase {
    constructor({ context, settings }) {
        super({ context });
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.settings = settings;
    }
    register(args) {
        this.context.register({
            ...args,
            destinationPath: this.settings.exportPath
        });
    }
}
exports.GatewayBase = GatewayBase;
