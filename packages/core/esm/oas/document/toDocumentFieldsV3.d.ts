import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import type { DocumentFields } from './Document.js';
type ToDocumentV3Args = {
    documentObject: OpenAPIV3.Document;
    context: ParseContext;
};
export declare const toDocumentFieldsV3: ({ documentObject, context }: ToDocumentV3Args) => DocumentFields;
export {};
//# sourceMappingURL=toDocumentFieldsV3.d.ts.map