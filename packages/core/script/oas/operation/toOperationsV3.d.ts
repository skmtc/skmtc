import type { OpenAPIV3 } from 'openapi-types';
import type { Method } from '../../types/Method.js';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasOperation } from './Operation.js';
import type { OasPathItem } from '../pathItem/PathItem.js';
type OperationInfo = {
    method: Method;
    path: string;
    pathItem: OasPathItem;
};
type ToOperationV3Args = {
    operation: OpenAPIV3.OperationObject;
    operationInfo: OperationInfo;
    context: ParseContext;
};
export declare const toOperationV3: ({ operation, operationInfo, context }: ToOperationV3Args) => OasOperation;
type ToOperationsV3Args = {
    paths: OpenAPIV3.PathsObject;
    context: ParseContext;
};
export declare const toOperationsV3: ({ paths, context }: ToOperationsV3Args) => OasOperation[];
export {};
//# sourceMappingURL=toOperationsV3.d.ts.map