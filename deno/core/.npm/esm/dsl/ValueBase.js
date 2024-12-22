export class ValueBase {
    constructor({ context, generatorKey }) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "skipped", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "generatorKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.context = context;
        this.generatorKey = generatorKey;
        return new Proxy(this, proxyHandler);
    }
    register(args) {
        this.context.register(args);
    }
}
const proxyHandler = {
    get: (target, propertyName) => {
        return propertyName === 'toString'
            ? new Proxy(target[propertyName], {
                apply: (toString, thisArg) => {
                    if (target.generatorKey) {
                        target.context.callback(target.generatorKey);
                    }
                    return toString.apply(thisArg);
                }
            })
            : target[propertyName];
    }
};
