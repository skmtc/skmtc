import type { DumperStateOptions } from "./_dumper/dumper_state.js";
export type DumpOptions = DumperStateOptions;
/**
 * Serializes `object` as a YAML document.
 *
 * You can disable exceptions by setting the skipInvalid option to true.
 */
export declare function stringify(obj: Record<string, unknown>, options?: DumpOptions): string;
//# sourceMappingURL=stringify.d.ts.map