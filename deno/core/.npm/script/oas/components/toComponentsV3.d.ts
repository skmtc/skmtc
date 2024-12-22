import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasComponents } from './Components.js';
type ToComponentsV3Args = {
    components: OpenAPIV3.ComponentsObject | undefined;
    context: ParseContext;
};
export declare const toComponentsV3: ({ components, context }: ToComponentsV3Args) => OasComponents | undefined;
export {};
//# sourceMappingURL=toComponentsV3.d.ts.map