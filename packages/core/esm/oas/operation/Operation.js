import { OasObject } from '../object/Object.js';
/** Operation represents a resource path and a method that can be enacted against it */
export class OasOperation {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'operation'
        });
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "method", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pathItem", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "operationId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "summary", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tags", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "parameters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "requestBody", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "responses", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "deprecated", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "extensionFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.path = fields.path;
        this.method = fields.method;
        this.pathItem = fields.pathItem;
        this.operationId = fields.operationId;
        this.summary = fields.summary;
        this.tags = fields.tags;
        this.description = fields.description;
        this.parameters = fields.parameters;
        this.requestBody = fields.requestBody;
        this.responses = fields.responses;
        this.deprecated = fields.deprecated;
        this.extensionFields = fields.extensionFields;
    }
    toSuccessResponse() {
        const { default: defaultResponse, ...httpCodeResponses } = this.responses;
        const successCode = Object.keys(httpCodeResponses)
            .map(httpCode => parseInt(httpCode))
            .sort((a, b) => a - b)
            .find(httpCode => httpCode >= 200 && httpCode < 300);
        return successCode ? httpCodeResponses[successCode] : defaultResponse;
    }
    toRequestBody(map, mediaType = 'application/json') {
        const requestBody = this.requestBody?.resolve();
        const schema = requestBody?.content[mediaType]?.schema;
        return schema ? map({ schema, requestBody }) : undefined;
    }
    /**
     * Resolve all parameters and optionally filter by location
     *
     * @param filter - only include parameters from specified locations
     * @returns
     */
    toParams(filter) {
        return (this.parameters
            ?.map(param => param.resolve())
            .filter(param => filter?.length ? filter.includes(param.location) : true) ?? []);
    }
    toParametersObject(filter) {
        const parameters = this.toParams(filter);
        return parameters.reduce((acc, parameter) => {
            return acc.addProperty({
                name: parameter.name,
                schema: parameter.toSchema(),
                required: parameter.required
            });
        }, OasObject.empty());
    }
}
