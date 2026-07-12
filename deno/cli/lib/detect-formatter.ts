/**
 * Detect the consumer app's formatter so `generate` can suggest a
 * `client.json#settings.formatter` command when none is configured.
 * Suggestion only — we never pick or run a formatter of our own; the
 * user's tool is always the one configured (decision 2026-07-12,
 * format-agnostic-attribution plan). First match wins, checked in
 * rough order of ecosystem specificity.
 */

import { join } from "@std/path";

export type DetectedFormatter = {
  /** Human-readable tool name, e.g. `'prettier'`. */
  tool: string;
  /** Suggested `settings.formatter` command (file paths get appended). */
  command: string;
  /** What the detection saw, e.g. `'.prettierrc'`. */
  evidence: string;
};

const fileExists = (path: string): boolean => {
  try {
    return Deno.statSync(path).isFile;
  } catch {
    return false;
  }
};

const readPackageJson = (
  appRoot: string,
): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(
      Deno.readTextFileSync(join(appRoot, "package.json")),
    );
    return parsed !== null && typeof parsed === "object" &&
        !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const hasDependency = (
  packageJson: Record<string, unknown>,
  name: string,
): boolean => {
  for (const field of ["dependencies", "devDependencies"]) {
    const dependencies = packageJson[field];
    if (
      dependencies !== null &&
      typeof dependencies === "object" &&
      name in (dependencies as Record<string, unknown>)
    ) {
      return true;
    }
  }
  return false;
};

const PRETTIER_CONFIGS = [
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.js",
  ".prettierrc.mjs",
  ".prettierrc.cjs",
  "prettier.config.js",
  "prettier.config.mjs",
  "prettier.config.cjs",
];

export const detectFormatter = (
  appRoot: string,
): DetectedFormatter | undefined => {
  const packageJson = readPackageJson(appRoot);

  const prettierConfig = PRETTIER_CONFIGS.find((name) =>
    fileExists(join(appRoot, name))
  );
  if (prettierConfig !== undefined) {
    return {
      tool: "prettier",
      command: "npx prettier --write",
      evidence: prettierConfig,
    };
  }
  if (packageJson !== undefined && "prettier" in packageJson) {
    return {
      tool: "prettier",
      command: "npx prettier --write",
      evidence: 'package.json "prettier" key',
    };
  }

  const biomeConfig = ["biome.json", "biome.jsonc"].find((name) =>
    fileExists(join(appRoot, name))
  );
  if (biomeConfig !== undefined) {
    return {
      tool: "biome",
      command: "npx @biomejs/biome format --write",
      evidence: biomeConfig,
    };
  }

  if (packageJson !== undefined && hasDependency(packageJson, "oxfmt")) {
    return {
      tool: "oxfmt",
      command: "npx oxfmt",
      evidence: "package.json oxfmt dependency",
    };
  }

  const denoConfig = ["deno.json", "deno.jsonc"].find((name) =>
    fileExists(join(appRoot, name))
  );
  if (denoConfig !== undefined) {
    return { tool: "deno fmt", command: "deno fmt", evidence: denoConfig };
  }

  return undefined;
};

/** The one-line stderr hint `generate` prints (interactive text mode
 *  only) when a formatter is detectable but `settings.formatter` is
 *  unset. */
export const formatterHint = (detected: DetectedFormatter): string =>
  `Hint: ${detected.evidence} detected but client.json#settings.formatter is not set. ` +
  `Set it to e.g. "${detected.command}" and skmtc will format generated files itself, ` +
  `keeping attribution spans aligned with the formatted output.`;
