import type { OpenAPIV3 } from 'openapi-types';
import { OasDocument } from '../oas/document/Document.js';
import type * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js';
import type { StackTrail } from './StackTrail.js';
type ConstructorArgs = {
    schema: string;
    logger: log.Logger;
    stackTrail: StackTrail;
};
export type ParseReturn = {
    oasDocument: OasDocument;
    extensions: Record<string, unknown>;
};
type RegisterExtensionArgs = {
    type: string;
    stackTrail: string[];
    extensionFields: Record<string, unknown>;
};
export declare class ParseContext {
    #private;
    schema: string;
    logger: log.Logger;
    oasDocument: OasDocument;
    stackTrail: StackTrail;
    extentions: Record<string, unknown>;
    constructor({ schema, logger, stackTrail }: ConstructorArgs);
    parse(): OasDocument;
    trace<T>(token: string | string[], fn: () => T): T;
    registerExtension({ extensionFields, stackTrail, type }: RegisterExtensionArgs): void;
    logSkippedFields(skipped: Record<string, unknown>): void;
}
export declare const parseSchema: (schema: string) => OpenAPIV3.Document<{}>;
export {};
//# sourceMappingURL=ParseContext.d.ts.map