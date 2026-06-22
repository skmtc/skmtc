import { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { Manager } from "@/lib/manager.ts";
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat,
} from "@/lib/strict-mode.ts";
import { pushHeadless, type PushHeadlessResult } from "@/lib/push-headless.ts";
import { resolveHubAuth } from "@/lib/hub-token.ts";
import { collectBaseFiles } from "@/lib/source-upload.ts";
import { toAbsoluteRootPath } from "@/lib/to-root-path.ts";
import { dirname } from "@std/path/dirname";
import { join } from "@std/path/join";

export const description =
  "Push this project's client.json (config + enrichments) to its skmtc-hub project. The destination is the `project: \"@account/slug\"` field in client.json (or --project); it overwrites the hub project's config. The project must already exist on the hub.";

type RenderPushArgs = {
  skmtcRoot?: SkmtcRoot;
  projectName: string | undefined;
  token: string | undefined;
  origin: string | undefined;
  /** `--project` destination override (`@account/slug`). */
  project: string | undefined;
  force?: boolean;
  /** `--base-files`: also push the app tree to /preview/base-files. */
  baseFiles?: boolean;
  jsonFlag?: boolean;
  noInputFlag?: boolean;
};

const USAGE = "skmtc push <project> [--project @account/slug] [--base-files]";

/**
 * Collect a project's base files for `--base-files`: the app tree rooted at the
 * app dir (`dirname(basePath)` — scoped to this app, not sibling apps), with the
 * manifest's generated output excluded. Delegates the ignore methodology to
 * {@link collectBaseFiles}.
 */
export const collectProjectBaseFiles = async (
  skmtcRoot: SkmtcRoot,
  projectName: string,
): Promise<Record<string, string>> => {
  const project = skmtcRoot.findProject(projectName);
  const basePath = project.clientJson.contents?.settings?.basePath ?? ".";
  const appRootRel = dirname(basePath);
  // The app root is the dir that CONTAINS `.skmtc/` (toAbsoluteRootPath), not
  // the `.skmtc` dir itself (toRootPath). basePath is relative to it.
  const appRoot = join(toAbsoluteRootPath(), appRootRel);
  // Manifest destinations are SKMTC-root-relative; strip the app-root prefix so
  // they line up with the app-root-relative collected paths.
  const prefix = appRootRel === "." ? "" : `${appRootRel}/`;
  const generated = new Set(
    Object.keys(project.manifest.contents?.files ?? {}).map((path) =>
      prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path
    ),
  );
  return collectBaseFiles(appRoot, generated);
};
const EXAMPLE = "skmtc push my-api --project @acme-org/petstore-client";

export const renderPush = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  token,
  origin,
  project: projectFlag,
  force,
  baseFiles: baseFilesFlag,
  jsonFlag,
  noInputFlag,
}: RenderPushArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag });

  if (projectName === undefined) {
    return failWithRecipe({
      command: "push",
      arg: "<project>",
      usage: USAGE,
      example: EXAMPLE,
      discover: "ls .skmtc/  (list existing projects)",
    });
  }

  const { token: resolvedToken, origin: resolvedOrigin } = resolveHubAuth({
    tokenFlag: token,
    originFlag: origin,
  });

  if (!resolvedToken) {
    return failWithRecipe({
      command: "push",
      arg: "--token",
      usage: USAGE,
      example: EXAMPLE,
      discover:
        "Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token. Mint a PAT at https://skmtc.dev/settings/tokens.",
    });
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()));

  // Interactive overwrite gate (the "warn before overwrite" affordance). In
  // strict/agent mode there's no prompt — the push overwrites as documented.
  // `--force` skips the prompt in a TTY too.
  const confirmOverwrite = mode === "interactive" && !force
    ? (
      { account, slug, enrichmentCount }: {
        account: string;
        slug: string;
        enrichmentCount: number;
      },
    ) =>
      Promise.resolve(
        confirm(
          `${account}/${slug} already has config ` +
            `(${enrichmentCount} enrichment row${
              enrichmentCount === 1 ? "" : "s"
            }). Overwrite?`,
        ),
      )
    : undefined;

  const baseFiles = baseFilesFlag
    ? await collectProjectBaseFiles(skmtcRoot, projectName)
    : undefined;

  const result = await pushHeadless({
    skmtcRoot,
    projectName,
    token: resolvedToken,
    origin: resolvedOrigin,
    projectFlag,
    confirmOverwrite,
    baseFiles,
  });

  printPushResult(result, { format: resolveOutputFormat({ jsonFlag }) });
  Deno.exit(result.kind === "failed" ? 1 : 0);
};

type PrintPushResultOptions = {
  format: "text" | "json";
};

export const printPushResult = (
  result: PushHeadlessResult,
  { format }: PrintPushResultOptions,
): void => {
  switch (format) {
    case "json": {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "text": {
      switch (result.kind) {
        case "pushed": {
          console.log(
            `Pushed "${result.projectName}" → ${result.project.account}/${result.project.slug}`,
          );
          console.log(`  origin: ${result.origin}`);
          console.log(`  enrichments: ${result.enrichmentCount}`);
          if (result.overwroteExistingConfig) {
            console.log("  note: replaced existing config");
          }
          if (result.remoteWritten) {
            console.log("  note: recorded destination in client.json#project");
          }
          if (result.baseFilesPushed !== undefined) {
            console.log(`  base files: ${result.baseFilesPushed}`);
          }
          return;
        }
        case "aborted": {
          console.log(
            `Push aborted — ${result.project.account}/${result.project.slug} left unchanged.`,
          );
          return;
        }
        case "failed": {
          console.error(
            `Push failed for "${result.projectName}" at ${result.stage}:`,
          );
          console.error(`  ${result.reason}`);
          return;
        }
        default: {
          const _exhaustive: never = result;
          throw new Error(
            `Unhandled push result: ${JSON.stringify(_exhaustive)}`,
          );
        }
      }
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(
        `Unhandled output format: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};
