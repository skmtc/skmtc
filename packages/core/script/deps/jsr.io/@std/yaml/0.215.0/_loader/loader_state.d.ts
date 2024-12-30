import type { YAMLError } from "../_error.js";
import type { SchemaDefinition, TypeMap } from "../schema.js";
import { State } from "../_state.js";
import type { Type } from "../type.js";
import type { Any, ArrayObject } from "../_utils.js";
export interface LoaderStateOptions {
    legacy?: boolean;
    listener?: ((...args: Any[]) => void) | null;
    /** string to be used as a file path in error/warning messages. */
    filename?: string;
    /** specifies a schema to use. */
    schema?: SchemaDefinition;
    /** compatibility with JSON.parse behaviour. */
    json?: boolean;
    /** function to call on warning messages. */
    onWarning?(this: null, e?: YAMLError): void;
}
export type ResultType = any[] | Record<string, any> | string;
export declare class LoaderState extends State {
    input: string;
    documents: Any[];
    length: number;
    lineIndent: number;
    lineStart: number;
    position: number;
    line: number;
    filename?: string;
    onWarning?: (...args: Any[]) => void;
    legacy: boolean;
    json: boolean;
    listener?: ((...args: Any[]) => void) | null;
    implicitTypes: Type[];
    typeMap: TypeMap;
    version?: string | null;
    checkLineBreaks?: boolean;
    tagMap?: ArrayObject;
    anchorMap?: ArrayObject;
    tag?: string | null;
    anchor?: string | null;
    kind?: string | null;
    result: ResultType | null;
    constructor(input: string, { filename, schema, onWarning, legacy, json, listener, }: LoaderStateOptions);
}
//# sourceMappingURL=loader_state.d.ts.map