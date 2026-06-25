/**
 * @fileoverview SKMTC Core Settings and Configuration
 *
 * This module provides comprehensive configuration types and schemas for the SKMTC
 * code generation pipeline. It defines settings for generators, modules, packages,
 * and runtime behavior that control how OpenAPI documents are processed and what
 * artifacts are generated.
 *
 * ## Key Features
 *
 * - **Generator Configuration**: Settings for individual code generators
 * - **Module Management**: Package and module resolution configuration
 * - **Runtime Settings**: Control generation behavior and output preferences
 * - **Enrichment Integration**: Support for UI enrichment metadata
 * - **Type Safety**: Comprehensive Valibot validation for all configuration
 *
 * @example Basic generator settings
 * ```typescript
 * import type { Settings } from '@skmtc/core/Settings';
 *
 * const settings: Settings = {
 *   generators: {
 *     'my-generator': {
 *       enabled: true,
 *       config: {
 *         outputPath: './generated',
 *         typescript: true
 *       }
 *     }
 *   },
 *   enrichments: {},
 *   filters: {
 *     includePaths: ['/api/v1/*'],
 *     excludeMethods: ['OPTIONS']
 *   }
 * };
 * ```
 *
 * @example Module package configuration
 * ```typescript
 * import type { ModulePackage } from '@skmtc/core/Settings';
 *
 * const moduleConfig: ModulePackage = {
 *   rootPath: './src/generated',
 *   moduleName: '@my-org/api-client'
 * };
 * ```
 *
 * @module Settings
 */

import {
  type GeneratorEnrichments,
  generatorEnrichments,
} from "./Enrichments.ts";
import * as v from "valibot";
import { type Method, method } from "./Method.ts";

/**
 * Whether a relative path contains a `..` parent-reference segment.
 * `..` is a parent reference only as a whole path segment — a
 * directory name that merely contains dots is not flagged.
 */
const hasParentSegment = (path: string): boolean =>
  path.split(/[/\\]/).some((segment) => segment === "..");

/**
 * Valibot schema for {@link ModulePackage}.
 *
 * `rootPath` must be a **forward** path: `client.json` `basePath` is
 * the common on-disk anchor, so every package sits forward from it.
 * A `..` segment means `basePath` was placed too deep — a misconfig
 * that otherwise misplaces every artifact silently.
 */
export const modulePackage: v.GenericSchema<ModulePackage> = v.object({
  rootPath: v.pipe(
    v.string(),
    v.check(
      (rootPath) => !hasParentSegment(rootPath),
      'package rootPath must be a forward path with no ".." segments — ' +
        "set client.json basePath to a common ancestor of every package " +
        "so each rootPath is written forward from it",
    ),
  ),
  moduleName: v.optional(v.string()),
});

/**
 * Configuration for a module package in the generation output.
 *
 * Module packages allow organizing generated code into separate npm packages
 * or modules with custom root paths and naming conventions.
 *
 * @example
 * ```typescript
 * const packages: ModulePackage[] = [
 *   {
 *     rootPath: './packages/api-client',
 *     moduleName: '@myorg/api-client'
 *   },
 *   {
 *     rootPath: './packages/types',
 *     moduleName: '@myorg/api-types'
 *   }
 * ];
 * ```
 */
export type ModulePackage = {
  /** The root file system path for this package */
  rootPath: string;
  /** Optional module name for package.json or imports */
  moduleName?: string;
};

/**
 * Valibot schema for validating skip paths configuration.
 *
 * Validates `path → method → variant[]` mappings for skipping specific
 * operations. An empty variant array means "every variant of this
 * method"; a populated array names the variants to deny. Methods
 * absent from the inner record are unaffected.
 */
export const skipPaths: v.GenericSchema<SkipPaths> = v.record(
  v.string(),
  v.record(method, v.array(v.string())),
);

/**
 * Valibot schema for validating skip operations configuration.
 *
 * Validates generator-to-skip-paths mappings for skipping operations by generator.
 */
export const skipOperations: v.GenericSchema<SkipOperations> = v.record(
  v.string(),
  skipPaths,
);

/**
 * Valibot schema for {@link SkipModelRefs}. Structurally identical to
 * the operation-arm inner: `refName → variant[]`, with the same
 * empty-array-means-"all variants" rule.
 */
export const skipModelRefs: v.GenericSchema<SkipModelRefs> = v.record(
  v.string(),
  v.array(v.string()),
);

/**
 * Valibot schema for validating skip models configuration.
 *
 * Validates generator-to-skip-model-refs mappings for skipping specific
 * models and variants by generator.
 */
export const skipModels: v.GenericSchema<SkipModels> = v.record(
  v.string(),
  skipModelRefs,
);

const skip: v.GenericSchema<Skip> = v.union([
  skipOperations,
  skipModels,
  v.string(),
]);

/**
 * Valibot schema for {@link IncludePaths}. Structurally identical to
 * {@link skipPaths} — both map a path to a `method → variant[]` record
 * — but kept distinct so docstrings can convey the opposite semantics
 * (allow vs deny) and so the two shapes can diverge in the future
 * without breaking the other.
 */
export const includePaths: v.GenericSchema<IncludePaths> = v.record(
  v.string(),
  v.record(method, v.array(v.string())),
);

/**
 * Valibot schema for {@link IncludeOperations}. Maps generator id to
 * {@link IncludePaths}.
 */
export const includeOperations: v.GenericSchema<IncludeOperations> = v.record(
  v.string(),
  includePaths,
);

/**
 * Valibot schema for {@link IncludeModelRefs}. Sibling to
 * {@link skipModelRefs} — `refName → variant[]`. Same shape, opposite
 * semantics.
 */
export const includeModelRefs: v.GenericSchema<IncludeModelRefs> = v.record(
  v.string(),
  v.array(v.string()),
);

/**
 * Valibot schema for {@link IncludeModels}. Maps generator id to a
 * `refName → variant[]` record.
 */
export const includeModels: v.GenericSchema<IncludeModels> = v.record(
  v.string(),
  includeModelRefs,
);

const include: v.GenericSchema<Include> = v.union([
  includeOperations,
  includeModels,
  v.string(),
]);

/**
 * Valibot schema for validating client settings configuration.
 *
 * Validates the complete client settings structure including base paths,
 * packages, include/skip filters, and enrichments.
 */
/**
 * Valibot schema for the gen-maps (`anchors`) settings block. Lives
 * inside {@link clientSettings} as an optional field. See
 * {@link AnchorsSettings} for the consumer-facing fields.
 */
export const anchorsSettings: v.GenericSchema<AnchorsSettings> = v.object({
  enabled: v.boolean(),
  out: v.optional(v.string()),
});

export const clientSettings: v.GenericSchema<ClientSettings> = v.object({
  basePath: v.optional(v.string()),
  schemaSource: v.optional(v.string()),
  packages: v.optional(v.array(modulePackage)),
  enrichments: v.optional(generatorEnrichments),
  include: v.optional(v.array(include)),
  skip: v.optional(v.array(skip)),
  anchors: v.optional(anchorsSettings),
  inputDirs: v.optional(v.array(v.string())),
});

/**
 * Configuration for skipping specific HTTP methods + variants on API paths.
 *
 * Maps `path → method → variant[]`. The variant array uses these conventions:
 *
 * - `[]` (empty) means "every variant of this method" — the equivalent
 *   of pre-variants `[method]`-only entries.
 * - `['main', 'customer']` means "only those variants" — paired with
 *   `include`, a way to opt in a subset; paired with `skip`, a way to
 *   deny a subset.
 * - Method key absent means "this method is not affected by the entry".
 *
 * @example
 * ```typescript
 * const skipPaths: SkipPaths = {
 *   '/admin/users': { get: [], post: [] },                // skip all variants of both
 *   '/quotes/{id}': { patch: ['description', 'validity'] } // skip just two variants
 * };
 * ```
 */
export type SkipPaths = Record<string, Partial<Record<Method, string[]>>>;

/**
 * Configuration for skipping specific model refNames + variants.
 *
 * Maps `refName → variant[]`. The variant array uses the same
 * conventions as {@link SkipPaths}:
 *
 * - `[]` (empty) means "every variant of this refName" — the equivalent
 *   of pre-variants whole-model entries.
 * - `['main', 'coercive']` means "only those variants" — paired with
 *   `include`, a way to opt in a subset; paired with `skip`, a way to
 *   deny a subset.
 * - refName key absent means "this refName is not affected by the entry".
 *
 * @example
 * ```typescript
 * const skipModelRefs: SkipModelRefs = {
 *   'InternalModel': [],              // skip all variants
 *   'Customer':      ['coercive']     // skip just one variant
 * };
 * ```
 */
export type SkipModelRefs = Record<string, string[]>;

/**
 * Configuration for skipping model generation by generator type.
 *
 * Maps generator keys to {@link SkipModelRefs} configurations for
 * excluding specific models (and their variants) from generation.
 *
 * Model names are matched exactly against the schema's refName; variant
 * names are matched exactly against the per-model variant key.
 *
 * @example
 * ```typescript
 * const skipModels: SkipModels = {
 *   'typescript-models': { 'InternalModel': [], 'DebugInfo': [] },
 *   'validation':        { 'TempModel': [] }
 * };
 * ```
 */
export type SkipModels = Record<string, SkipModelRefs>;

/**
 * Configuration for skipping operation generation by generator type.
 *
 * Maps generator keys to {@link SkipPaths} configurations for excluding
 * specific operations from generation.
 *
 * @example
 * ```typescript
 * const skipOperations: SkipOperations = {
 *   'api-client': {
 *     '/internal/**': ['*'],
 *     '/admin': ['delete']
 *   }
 * };
 * ```
 */
export type SkipOperations = Record<string, SkipPaths>;

/**
 * Union type representing different skip configurations.
 *
 * Can be either operation-specific skipping, model-specific skipping,
 * or a simple string pattern for broad exclusions.
 */
export type Skip = SkipOperations | SkipModels | string;

/**
 * Allow-list counterpart to {@link SkipPaths}. Same `path → method →
 * variant[]` shape and the same `[]`-means-"all variants" rule, but
 * with opposite semantics: only matching `(path, method, variant)`
 * tuples are admitted. Matching is exact on path, method, and variant
 * name. No wildcards or globs.
 *
 * @example
 * ```typescript
 * const includePaths: IncludePaths = {
 *   '/customers': { post: [] },                 // all variants of POST
 *   '/quotes/{id}': { patch: ['description'] }  // only the 'description' variant
 * };
 * ```
 */
export type IncludePaths = Record<string, Partial<Record<Method, string[]>>>;

/**
 * Allow-list counterpart to {@link SkipModelRefs}. Same
 * `refName → variant[]` shape and the same `[]`-means-"all variants"
 * rule, but with opposite semantics: only matching `(refName, variant)`
 * tuples are admitted. Matching is exact on refName and variant name.
 * No wildcards or globs.
 *
 * @example
 * ```typescript
 * const includeModelRefs: IncludeModelRefs = {
 *   'Customer': [],            // all variants of Customer
 *   'Order':    ['coercive']   // only the 'coercive' variant of Order
 * };
 * ```
 */
export type IncludeModelRefs = Record<string, string[]>;

/**
 * Allow-list counterpart to {@link SkipModels}. Maps generator id to
 * {@link IncludeModelRefs}.
 *
 * @example
 * ```typescript
 * const includeModels: IncludeModels = {
 *   '@skmtc/gen-zod-variants': { 'Customer': [], 'Order': ['coercive'] }
 * };
 * ```
 */
export type IncludeModels = Record<string, IncludeModelRefs>;

/**
 * Allow-list counterpart to {@link SkipOperations}. Maps generator id
 * to {@link IncludePaths}.
 *
 * @example
 * ```typescript
 * const includeOperations: IncludeOperations = {
 *   '@skmtc/gen-shadcn-form': {
 *     '/customers': ['post'],
 *     '/locations': ['post']
 *   }
 * };
 * ```
 */
export type IncludeOperations = Record<string, IncludePaths>;

/**
 * Union type representing allow-list filter entries. Mirrors the
 * {@link Skip} shape so the two can be combined consistently in
 * {@link ClientSettings}:
 *
 * - A string entry like `'@skmtc/gen-form'` includes the whole generator
 *   (every operation/model it would otherwise emit).
 * - An {@link IncludeOperations} entry includes specific (path, method)
 *   pairs for one operation generator.
 * - An {@link IncludeModels} entry includes specific refNames for one
 *   model generator.
 *
 * **Presence is the gate.** When `include` is `undefined` or `[]`, no
 * filter is active (everything emits as if no include were set).
 * When `include` is set and non-empty, only generators / operations /
 * models matching at least one entry will emit; everything else is
 * silently filtered out.
 *
 * **Precedence vs `skip`:** `include` builds the candidate set, `skip`
 * removes from it. An operation that's in both an `include` allow-list
 * entry AND a `skip` deny-list entry is skipped. This mirrors
 * `tsconfig.json`'s `include` + `exclude` pair.
 */
export type Include = IncludeOperations | IncludeModels | string;

/**
 * Main configuration object for SKMTC client settings.
 *
 * Controls various aspects of code generation including output paths,
 * package organization, enrichments, and selective skipping of content.
 *
 * @example Basic configuration
 * ```typescript
 * const settings: ClientSettings = {
 *   basePath: './src/generated',
 *   skip: [
 *     'InternalModel',  // Skip specific model
 *     {
 *       'api-client': {
 *         '/admin/**': ['*']  // Skip all admin operations
 *       }
 *     }
 *   ]
 * };
 * ```
 *
 * @example Advanced configuration with enrichments
 * ```typescript
 * // OAS enrichment hierarchy: generatorId → path → method → { table | form | input }
 * const settings: ClientSettings = {
 *   basePath: './generated',
 *   packages: [
 *     {
 *       rootPath: './packages/client',
 *       moduleName: '@company/api-client'
 *     }
 *   ],
 *   enrichments: {
 *     'react-forms': {
 *       '/users': {
 *         post: { form: { title: 'Create User', fields: [] } }
 *       }
 *     }
 *   },
 *   skip: [
 *     {
 *       'api-client': {
 *         '/health': ['get']
 *       }
 *     }
 *   ]
 * };
 * ```
 *
 * @example GraphQL enrichment hierarchy
 * ```typescript
 * // GraphQL enrichment hierarchy: generatorId → rootKind → fieldName → { table | form | input }
 * const settings: ClientSettings = {
 *   basePath: './generated',
 *   enrichments: {
 *     'react-forms': {
 *       mutation: {
 *         createUser: { form: { title: 'Create User', fields: [] } }
 *       }
 *     }
 *   }
 * };
 * ```
 */
/**
 * Per-project gen-maps (`anchors`) configuration. Lives at
 * `client.json#settings.anchors`.
 *
 * v1 honours the two fields below. Future fields (parser choice,
 * gzip compression, map toggle) will land additively as the
 * Phase G adapter swap and Phase D polish work proceeds.
 */
export type AnchorsSettings = {
  /**
   * Master switch. `true` emits a sidecar per generated source file
   * and a project-level generation map. `false` (or omitted) runs
   * generation as if gen-maps didn't exist — zero overhead.
   */
  enabled: boolean;
  /**
   * Output directory for sidecars + generation map, relative to
   * `.skmtc/<project>/`. Defaults to `'.maps'` when omitted. The
   * `skmtc init` template gitignores the `.maps` subtree by default
   * since sidecars are build output, not source.
   */
  out?: string;
};

export type ClientSettings = {
  /** Base output path for generated files */
  basePath?: string;
  /** Array of module package configurations */
  packages?: ModulePackage[];
  /** Custom enrichments for extending generation */
  enrichments?: GeneratorEnrichments;
  /**
   * Allow-list filter applied before {@link skip}. When set and
   * non-empty, only generators / operations / models matching an
   * entry are emitted; everything else is silently filtered out.
   * See {@link Include} for the per-entry shape and precedence rules.
   */
  include?: Include[];
  /** Array of skip (deny-list) configurations to exclude content */
  skip?: Skip[];
  /**
   * Gen-maps (`anchors`) configuration. When `enabled: true`, the CLI
   * emits per-file sidecars and a generation map alongside the
   * generated artifacts. Omitted by default; the feature is opt-in
   * in v1. See {@link AnchorsSettings}.
   */
  anchors?: AnchorsSettings;
  /**
   * Preview input-matcher discovery directories (project-root relative, e.g.
   * `src/fields`, `src/inputs`). A preview/hub concern: the generation engine
   * ignores it. Declared here so the CLI preserves it when reading `client.json`
   * and carries it through `skmtc push` to the hub.
   */
  inputDirs?: string[];
};

/**
 * Configuration for SKMTC client with optional project identification.
 *
 * Extends client settings with an optional project key for multi-project
 * environments or organizational contexts.
 */
export type SkmtcClientConfig = {
  /** Url of the server when running locally */
  serverUrl?: string;
  /** Optional project identifier for organizational contexts */
  projectKey?: string;
  /**
   * skmtc-hub push destination in `@<account>/<slug>` form (the account may be
   * a user or an org) — the `skmtc push` target, analogous to a git remote.
   * Ignored by `skmtc generate`; consumed only by `skmtc push`.
   */
  project?: string;
  /**
   * skmtc-hub API binding in `@<account>/<slug>` form — the registered schema
   * this project's `source` maps to on the hub, analogous to a git remote.
   * Recorded by `skmtc project create` (the schema-register write-back) so a
   * re-run versions the same API instead of creating a duplicate. Ignored by
   * `skmtc generate`.
   */
  api?: string;
  /** Optional schema path or url for OpenAPI schema */
  source?: string;
  /** Client settings for customizing generation behavior */
  settings: ClientSettings;
};

/**
 * Valibot schema for validating SKMTC client configuration.
 *
 * Validates the complete client configuration including project key
 * and client settings structure.
 */
export const skmtcClientConfig: v.GenericSchema<SkmtcClientConfig> = v.object({
  serverUrl: v.optional(v.string()),
  projectKey: v.optional(v.string()),
  project: v.optional(v.string()),
  api: v.optional(v.string()),
  source: v.optional(v.string()),
  settings: clientSettings,
});
