import type { OasOperation } from '../oas/operation/Operation.js';
import type { Method } from '../types/Method.js';
export declare const toEndpointType: (operation: OasOperation) => "query" | "mutation";
/** generates endpoint name in the `camelCase{method}Api{path}` format */
export declare const toEndpointName: (operation: OasOperation) => string;
export declare const toResponseName: (operation: OasOperation) => string;
export declare const toArgsName: (operation: OasOperation) => string;
export declare const toMethodVerb: (method: Method) => string;
//# sourceMappingURL=naming.d.ts.map