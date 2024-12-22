import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasBoolean } from './Boolean.js';
type ToBooleanArgs = {
    value: OpenAPIV3.NonArraySchemaObject;
    context: ParseContext;
};
export declare const toBoolean: ({ value, context }: ToBooleanArgs) => OasBoolean;
export {};
//# sourceMappingURL=toBoolean.d.ts.map