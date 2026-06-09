import { FileBase } from '@/dsl/FileBase.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'

/**
 * The base every language's *code* file extends — a {@link FileBase} that
 * also carries imports. (`JsonFile`, which has no imports, extends
 * {@link FileBase} directly.)
 *
 * The import collection and its merge are **language-neutral**: imports are
 * held keyed by {@link ImportBase.mergeKey} and collapsed via
 * {@link ImportBase.merge}, with no language-specific logic. The spike
 * proved this same `Map` + merge serves TypeScript (per-module grouping,
 * type-tags) and Go (whole-package imports, discarded symbol lists)
 * identically — only the *arrangement* of the rendered import section
 * differs, which is why `toString()` stays abstract and lives on the
 * language subclass (`TsFile`, `GoFile`).
 */
export abstract class CodeFileBase extends FileBase {
  /** Registered imports, keyed by {@link ImportBase.mergeKey}. */
  imports: Map<string, ImportBase> = new Map()

  /**
   * Merge imports in, collapsing any that share a `mergeKey()` with an
   * existing entry via {@link ImportBase.merge}. Neutral — the engine's
   * `register` calls this on the abstract base for every language's file.
   */
  addImports(incoming: ImportBase[]): void {
    for (const importEntry of incoming) {
      const key = importEntry.mergeKey()
      const existing = this.imports.get(key)

      this.imports.set(key, existing ? existing.merge(importEntry) : importEntry)
    }
  }
}
