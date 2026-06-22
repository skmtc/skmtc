import { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { Manager } from "@/lib/manager.ts";
import { failWithRecipe, resolveInputMode, resolveOutputFormat } from "@/lib/strict-mode.ts";
import { forkHeadless, type ForkResult, rmHeadless, type RmResult } from "@/lib/project-headless.ts";
import { resolveHubAuth } from "@/lib/hub-token.ts";
import { collectProjectBaseFiles } from "@/commands/push.ts";

export const description =
  "Manage ephemeral, per-branch hub projects: `fork` a base project for the current branch, `rm` it when the branch merges.";

// --- fork -------------------------------------------------------------------

type RenderForkArgs = {
  skmtcRoot?: SkmtcRoot;
  projectName: string | undefined;
  token: string | undefined;
  origin: string | undefined;
  /** Ephemeral destination override (`@account/slug`); else `<base>-<branch>`. */
  as: string | undefined;
  visibility?: string;
  baseFiles?: boolean;
  jsonFlag?: boolean;
  noInputFlag?: boolean;
};

const FORK_USAGE = "skmtc project fork <project> [--as @account/slug] [--base-files]";
const FORK_EXAMPLE = "skmtc project fork my-api";

export const renderProjectFork = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  token,
  origin,
  as,
  visibility,
  baseFiles: baseFilesFlag,
  jsonFlag,
  noInputFlag,
}: RenderForkArgs) => {
  resolveInputMode({ noInputFlag, jsonFlag });

  if (projectName === undefined) {
    return failWithRecipe({
      command: "project fork",
      arg: "<project>",
      usage: FORK_USAGE,
      example: FORK_EXAMPLE,
      discover: "ls .skmtc/  (list existing projects)",
    });
  }

  const { token: resolvedToken, origin: resolvedOrigin } = resolveHubAuth({ tokenFlag: token, originFlag: origin });
  if (!resolvedToken) {
    return failWithRecipe({
      command: "project fork",
      arg: "--token",
      usage: FORK_USAGE,
      example: FORK_EXAMPLE,
      discover: "Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token.",
    });
  }

  const visibilityValue = visibility === "public" ? "public" : "private";
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()));
  const baseFiles = baseFilesFlag ? await collectProjectBaseFiles(skmtcRoot, projectName) : undefined;

  const result = await forkHeadless({
    skmtcRoot,
    projectName,
    token: resolvedToken,
    origin: resolvedOrigin,
    asFlag: as,
    visibility: visibilityValue,
    baseFiles,
  });

  printForkResult(result, { format: resolveOutputFormat({ jsonFlag }) });
  Deno.exit(result.kind === "failed" ? 1 : 0);
};

export const printForkResult = (result: ForkResult, { format }: { format: "text" | "json" }): void => {
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  switch (result.kind) {
    case "forked": {
      const { ephemeral, base } = result;
      console.log(
        `${result.created ? "Forked" : "Re-seeded"} ${base.account}/${base.slug} → ${ephemeral.account}/${ephemeral.slug}`,
      );
      console.log(`  origin: ${result.origin}`);
      if (result.branch) console.log(`  branch: ${result.branch}`);
      console.log(`  enrichments: ${result.enrichmentCount}`);
      if (result.baseFilesPushed !== undefined) console.log(`  base files: ${result.baseFilesPushed}`);
      if (result.url) console.log(`  project: ${result.url}`);
      return;
    }
    case "failed": {
      console.error(`Fork failed for "${result.projectName}" at ${result.stage}:`);
      console.error(`  ${result.reason}`);
      return;
    }
    default: {
      const _exhaustive: never = result;
      throw new Error(`Unhandled fork result: ${JSON.stringify(_exhaustive)}`);
    }
  }
};

// --- rm ---------------------------------------------------------------------

type RenderRmArgs = {
  skmtcRoot?: SkmtcRoot;
  projectName: string | undefined;
  token: string | undefined;
  origin: string | undefined;
  as: string | undefined;
  jsonFlag?: boolean;
  noInputFlag?: boolean;
};

const RM_USAGE = "skmtc project rm <project> [--as @account/slug]";
const RM_EXAMPLE = "skmtc project rm my-api";

export const renderProjectRm = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  token,
  origin,
  as,
  jsonFlag,
  noInputFlag,
}: RenderRmArgs) => {
  resolveInputMode({ noInputFlag, jsonFlag });

  if (projectName === undefined) {
    return failWithRecipe({
      command: "project rm",
      arg: "<project>",
      usage: RM_USAGE,
      example: RM_EXAMPLE,
      discover: "ls .skmtc/  (list existing projects)",
    });
  }

  const { token: resolvedToken, origin: resolvedOrigin } = resolveHubAuth({ tokenFlag: token, originFlag: origin });
  if (!resolvedToken) {
    return failWithRecipe({
      command: "project rm",
      arg: "--token",
      usage: RM_USAGE,
      example: RM_EXAMPLE,
      discover: "Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token. Deleting needs the admin:resource scope.",
    });
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()));
  const result = await rmHeadless({
    skmtcRoot,
    projectName,
    token: resolvedToken,
    origin: resolvedOrigin,
    asFlag: as,
  });

  printRmResult(result, { format: resolveOutputFormat({ jsonFlag }) });
  Deno.exit(result.kind === "failed" ? 1 : 0);
};

export const printRmResult = (result: RmResult, { format }: { format: "text" | "json" }): void => {
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  switch (result.kind) {
    case "removed": {
      const { ephemeral } = result;
      console.log(
        result.existed
          ? `Removed ${ephemeral.account}/${ephemeral.slug}`
          : `${ephemeral.account}/${ephemeral.slug} already gone — nothing to do.`,
      );
      return;
    }
    case "failed": {
      console.error(`Remove failed for "${result.projectName}" at ${result.stage}:`);
      console.error(`  ${result.reason}`);
      return;
    }
    default: {
      const _exhaustive: never = result;
      throw new Error(`Unhandled rm result: ${JSON.stringify(_exhaustive)}`);
    }
  }
};
