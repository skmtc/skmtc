import React from "react";
import { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { Manager } from "@/lib/manager.ts";
import { render } from "ink";
import { App } from "@/components/App.tsx";
import type { SkmtcState } from "@/components/SkmtcContext.tsx";
import type { InkRenderFn } from "@/commands/types.ts";
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat,
} from "@/lib/strict-mode.ts";
import {
  publishHeadless,
  type PublishHeadlessResult,
} from "@/lib/publish-headless.ts";
import { resolveHubAuth } from "@/lib/hub-token.ts";

export const description =
  "Build and publish an immutable version of this project to skmtc-hub. Versions are addressed by semver; re-publishing an existing version is rejected.";

type RenderPublishArgs = {
  skmtcRoot?: SkmtcRoot;
  projectName: string | undefined;
  token: string | undefined;
  origin: string | undefined;
  version: string | undefined;
  jsonFlag?: boolean;
  noInputFlag?: boolean;
  renderFn?: InkRenderFn;
  AppComponent?: typeof App;
};

const USAGE = "skmtc publish <project> --token <pat> [--version <semver>]";
const EXAMPLE = "skmtc publish my-api --token $SKMTC_HUB_TOKEN";

export const renderPublish = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  token,
  origin,
  version,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App,
}: RenderPublishArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag });

  if (projectName === undefined) {
    return failWithRecipe({
      command: "publish",
      arg: "<project>",
      usage: USAGE,
      example: EXAMPLE,
      discover: "ls .skmtc/  (list existing projects)",
    });
  }

  if (mode === "strict") {
    const { token: resolvedToken, origin: resolvedOrigin } = resolveHubAuth({
      tokenFlag: token,
      originFlag: origin,
    });

    if (!resolvedToken) {
      return failWithRecipe({
        command: "publish",
        arg: "--token",
        usage: USAGE,
        example: EXAMPLE,
        discover:
          "Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token. Mint a PAT at https://skmtc.dev/settings/tokens.",
      });
    }

    const skmtcRoot = providedSkmtcRoot ??
      (await SkmtcRoot.open(new Manager()));
    const result = await publishHeadless({
      skmtcRoot,
      projectName,
      token: resolvedToken,
      origin: resolvedOrigin,
      version,
    });
    printPublishResult(result, { format: resolveOutputFormat({ jsonFlag }) });
    Deno.exit(result.kind === "published" ? 0 : 1);
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()));

  // Thread the CLI args through to the Ink view so the PublishView
  // can run `publishHeadless` without re-resolving env vars.
  const initialState: SkmtcState = {
    view: {
      page: "publish",
      projectName,
      token,
      origin,
      version,
    },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: [],
  };

  renderFn(<AppComponent initialState={initialState} />);
};

type PrintPublishResultOptions = {
  format: "text" | "json";
};

export const printPublishResult = (
  result: PublishHeadlessResult,
  { format }: PrintPublishResultOptions,
): void => {
  switch (format) {
    case "json": {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "text": {
      switch (result.kind) {
        case "published": {
          console.log(
            `Published "${result.projectName}" → ${result.stack.account}/${result.stack.slug}@${result.version}`,
          );
          console.log(`  bundle: ${result.bundlePath}`);
          console.log(`  bytes: ${result.bundleBytes}`);
          console.log(`  sha256: ${result.bundleSha256}`);
          console.log(
            `  source: ${result.sourceFileCount} files, ${result.sourceTotalBytes} bytes`,
          );
          console.log(`  version: ${result.versionUrl}`);
          return;
        }
        case "failed": {
          console.error(
            `Publish failed for "${result.projectName}" at ${result.stage}:`,
          );
          console.error(`  ${result.reason}`);
          return;
        }
        default: {
          const _exhaustive: never = result;
          throw new Error(
            `Unhandled publish result: ${JSON.stringify(_exhaustive)}`,
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
