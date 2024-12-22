import { ValueBase } from './ValueBase.js';
export class GatewayBase extends ValueBase {
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
