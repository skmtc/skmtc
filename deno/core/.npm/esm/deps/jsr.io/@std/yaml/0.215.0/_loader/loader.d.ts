import { LoaderStateOptions } from "./loader_state.js";
export type CbFunction = (doc: unknown) => void;
export declare function loadAll<T extends CbFunction | LoaderStateOptions>(input: string, iteratorOrOption?: T, options?: LoaderStateOptions): T extends CbFunction ? void : unknown[];
export declare function load(input: string, options?: LoaderStateOptions): unknown;
//# sourceMappingURL=loader.d.ts.map