"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactRouterPathParams = void 0;
const ValueBase_js_1 = require("../dsl/ValueBase.js");
class ReactRouterPathParams extends ValueBase_js_1.ValueBase {
    constructor({ context, operation, generatorKey, destinationPath }) {
        super({ context, generatorKey });
        Object.defineProperty(this, "getParams", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "assertParams", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "passProps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "names", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const names = operation.toParams(['path']).map(param => param.name);
        this.names = names;
        if (names.length > 0) {
            this.getParams = `const { ${names.join(', ')} } = useParams()`;
            this.assertParams = names
                .map(param => `invariant(${param}, 'Expected ${param} to be defined')`)
                .join('\n');
            this.passProps = names.map(param => `${param}={${param}}`).join(' ');
            this.register({
                imports: {
                    'react-router-dom': ['useParams'],
                    'tiny-invariant': [{ default: 'invariant' }]
                },
                destinationPath
            });
        }
    }
    toString() {
        return ``;
    }
}
exports.ReactRouterPathParams = ReactRouterPathParams;
