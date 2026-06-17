import { Command, EnumType } from "@cliffy/command";
import {
  assertJsrReachable,
  JsrRegistryUnreachableError,
} from "@/lib/jsr-registry.ts";
import { getCommandDescriptor } from "@/lib/cli-schema.ts";

// Sentry.init({
//   dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
// })

// Commands that never touch JSR can be allow-listed here so they keep
// working offline. Adding new commands defaults to "requires registry"
// — make it an explicit decision when something can skip the check.
const COMMANDS_THAT_SKIP_REGISTRY_CHECK = new Set<string>([
  "generate",
  "dev",
  "doctor",
  "agent-context",
  "clean",
  // login/logout talk to the hub (or just the local filesystem), not
  // the JSR registry.
  "login",
  "logout",
  // push uploads client.json to the hub; it never touches JSR.
  "push",
]);

const shouldSkipRegistryCheck = (args: readonly string[]): boolean => {
  const firstArg = args.find((arg) => !arg.startsWith("-"));
  if (!firstArg) return false;
  return COMMANDS_THAT_SKIP_REGISTRY_CHECK.has(firstArg);
};

// Strings reused on every agent-mode command. The descriptions are
// also exported via {@link AGENT_MODE_FLAGS} in `cli-schema.ts` so
// `agent-context` reports the same text — keep these in sync.
const NO_INPUT_DESC = "Disable interactive prompts; fail on missing args.";
const JSON_DESC = "Emit structured JSON output (implies --no-input).";
const FORCE_DESC =
  "Bypass the pre-flight @skmtc/core peer-pin check. Cloning over a mismatched pin produces a generator that won't bundle — only use this when you know the skew is safe.";

const run = async () => {
  if (!shouldSkipRegistryCheck(Deno.args)) {
    try {
      await assertJsrReachable();
    } catch (error) {
      if (error instanceof JsrRegistryUnreachableError) {
        console.error(error.message);
        Deno.exit(1);
      }
      throw error;
    }
  }

  const generatorType = new EnumType(["operation", "model"]);

  // The descriptors in `lib/cli-schema.ts` are the source of truth for
  // each command's `description` and the human-readable args pattern
  // (which `agent-context` also reads). The `.arguments(...)` strings
  // below carry Cliffy's type annotations (`:string`, `:string[]`,
  // …) which don't belong in the descriptor — those stay inline.
  // The `--json` / `--no-input` option pair is repeated on every
  // `full`-agent-mode command because Cliffy's chain types don't
  // round-trip through a generic helper without losing precision.

  const initCommand = new Command()
    .description(getCommandDescriptor("init").description)
    .arguments("[projectName:string] [basePath:string]")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .action(async ({ json, input }, projectName, basePath) => {
      const { renderInit } = await import("@/commands/init.tsx");
      await renderInit({
        projectName,
        basePath,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const createCommand = new Command()
    .description(getCommandDescriptor("create").description)
    .type("generatorType", generatorType)
    .arguments("<project:string> <generator:string> <type:generatorType>")
    .action(async (_options, projectName, generator, type) => {
      const { renderCreate } = await import("@/commands/create.tsx");
      await renderCreate({ projectName, generator, type });
    });

  const cloneCommand = new Command()
    .description(getCommandDescriptor("clone").description)
    .arguments("[project:string]")
    .option(
      "-g, --generator <id:string>",
      "Generator id (JSR specifier) to clone. Repeat for multiple.",
      { collect: true },
    )
    .option("--force", FORCE_DESC)
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .action(async ({ json, input, generator, force }, projectName) => {
      const { renderClone } = await import("@/commands/clone.tsx");
      await renderClone({
        projectName,
        generators: generator,
        force,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const installCommand = new Command()
    .description(getCommandDescriptor("install").description)
    .arguments("[generators:string[]] [project:string]")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .action(async ({ json, input }, generators, projectName) => {
      const { renderInstall } = await import("@/commands/install.tsx");
      await renderInstall({
        generators,
        projectName,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const listCommand = new Command()
    .description(getCommandDescriptor("list").description)
    .arguments("[project:string]")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .action(async ({ json, input }, projectName) => {
      // Cliffy negates `--no-input` to `input: boolean`. `input === false`
      // means the user passed `--no-input`; default is `true`.
      const { renderList } = await import("@/commands/list.tsx");
      await renderList({
        projectName,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const removeCommand = new Command()
    .description(getCommandDescriptor("remove").description)
    .arguments("[project:string] [generator:string]")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .action(async ({ json, input }, projectName, generator) => {
      const { renderRemove } = await import("@/commands/remove.tsx");
      await renderRemove({
        projectName,
        generator,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const generateCommand = new Command()
    .description(getCommandDescriptor("generate").description)
    .arguments("<project:string> [schema:string]")
    .option("-w, --watch", "Watch for changes to schema and generate artifacts")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC + " Incompatible with --watch.")
    .option(
      "--typecheck",
      "After generating, run `tsc --noEmit` against the consumer tsconfig and surface " +
        "diagnostics scoped to this run's files. Exit 1 on any type error.",
    )
    .option(
      "--tsconfig <path:string>",
      "Override the tsconfig used by --typecheck. Defaults to the nearest tsconfig.json " +
        "walking up from basePath.",
    )
    .option(
      "--tsc-cmd <cmd:string>",
      "Override the tsc command used by --typecheck. Defaults to `npx tsc`; useful for " +
        'pnpm/bun setups (e.g. `--tsc-cmd "pnpm exec tsc"`).',
    )
    .option(
      "--anchors",
      "Force gen-maps (attribution) output ON, regardless of " +
        "`client.json#settings.anchors.enabled`. Emits sidecars + a " +
        "generation map under `.skmtc/<project>/.maps/`.",
    )
    .option(
      "--no-anchors",
      "Force gen-maps (attribution) output OFF, regardless of config.",
    )
    .action(
      async (
        { watch, json, input, typecheck, tsconfig, tscCmd, anchors },
        projectName,
        schemaSourceString,
      ) => {
        const { generateSwitch } = await import(
          "@/commands/generate-switch.ts"
        );
        await generateSwitch({
          projectName,
          schemaSourceString,
          watch,
          jsonFlag: json,
          noInputFlag: input === false,
          typecheck,
          tsconfig,
          tscCmd,
          // Cliffy maps `--anchors` / `--no-anchors` to a `boolean |
          // undefined` field — undefined when neither was passed.
          anchorsFlag: anchors,
        });
      },
    );

  const bundleCommand = new Command()
    .description(getCommandDescriptor("bundle").description)
    .arguments("[project:string]")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .action(async ({ json, input }, projectName) => {
      const { renderBundle } = await import("@/commands/bundle.tsx");
      await renderBundle({
        projectName,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const cleanCommand = new Command()
    .description(getCommandDescriptor("clean").description)
    // Optional in Cliffy so a missing project routes to the recipe
    // error (with the `ls .skmtc/` discovery hint) instead of Cliffy's
    // terse "Missing argument(s)" — matches `remove` / `list`.
    .arguments("[project:string]")
    .option("--json", "Emit structured JSON output.")
    .option(
      "--dry-run",
      "List the files and directories that would be deleted without touching disk.",
    )
    .option(
      "--verbose",
      "List every deleted file and pruned directory in text output.",
    )
    .action(async ({ json, dryRun, verbose }, projectName) => {
      const { renderClean } = await import("@/commands/clean.ts");
      await renderClean({
        projectName,
        jsonFlag: json,
        dryRunFlag: dryRun,
        verboseFlag: verbose,
      });
    });

  const devCommand = new Command()
    .description(getCommandDescriptor("dev").description)
    .arguments("<project:string> [schema:string]")
    .action(async (_options, projectName, schemaSourceString) => {
      const { dev } = await import("@/commands/dev.ts");
      await dev({ projectName, schemaSourceString });
    });

  const publishCommand = new Command()
    .description(getCommandDescriptor("publish").description)
    .arguments("<project:string>")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .option(
      "--token <token:string>",
      "Personal access token. Defaults to $SKMTC_HUB_TOKEN.",
    )
    .option(
      "--origin <url:string>",
      "Hub origin (base URL). Defaults to $SKMTC_ORIGIN or https://api.skmtc.dev.",
    )
    .option(
      "--version <version:string>",
      "Version to publish. Defaults to the project root deno.json's `version`.",
    )
    .action(async ({ json, input, token, origin, version }, projectName) => {
      const { renderPublish } = await import("@/commands/publish.tsx");
      await renderPublish({
        projectName,
        token,
        origin,
        version,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const pushCommand = new Command()
    .description(getCommandDescriptor("push").description)
    .arguments("<project:string>")
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .option(
      "--token <token:string>",
      "Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.",
    )
    .option(
      "--origin <url:string>",
      "Hub origin (base URL). Defaults to $SKMTC_ORIGIN or https://api.skmtc.dev.",
    )
    .option(
      "--project <ref:string>",
      "Hub destination as @account/slug. Defaults to the `project` field in client.json.",
    )
    .option(
      "--force",
      "Overwrite existing config without the confirmation prompt.",
    )
    .action(
      async ({ json, input, token, origin, project, force }, projectName) => {
        const { renderPush } = await import("@/commands/push.ts");
        await renderPush({
          projectName,
          token,
          origin,
          project,
          force,
          jsonFlag: json,
          noInputFlag: input === false,
        });
      },
    );

  const loginCommand = new Command()
    .description(getCommandDescriptor("login").description)
    .option("--no-input", NO_INPUT_DESC)
    .option("--json", JSON_DESC)
    .option("--with-token", "Read the token from stdin instead of prompting.")
    .option(
      "--origin <url:string>",
      "Hub origin (base URL) to validate against. Defaults to $SKMTC_ORIGIN or https://api.skmtc.dev.",
    )
    .action(async ({ json, input, withToken, origin }) => {
      const { renderLogin } = await import("@/commands/login.tsx");
      await renderLogin({
        origin,
        withToken,
        jsonFlag: json,
        noInputFlag: input === false,
      });
    });

  const logoutCommand = new Command()
    .description(getCommandDescriptor("logout").description)
    .option("--json", "Emit structured JSON output.")
    .action(async ({ json }) => {
      const { renderLogout } = await import("@/commands/logout.ts");
      renderLogout({ jsonFlag: json });
    });

  const doctorCommand = new Command()
    .description(getCommandDescriptor("doctor").description)
    .option("--json", "Emit structured JSON output.")
    .action(async ({ json }) => {
      const { renderDoctor } = await import("@/commands/doctor.ts");
      await renderDoctor({ jsonFlag: json });
    });

  const agentContextCommand = new Command()
    .description(getCommandDescriptor("agent-context").description)
    .option("--json", "Emit structured JSON output.")
    .action(async ({ json }) => {
      const { renderAgentContext } = await import(
        "@/commands/agent-context.ts"
      );
      renderAgentContext({ jsonFlag: json });
    });

  const migrateVariantsCommand = new Command()
    .description(
      "Migrate a project's client.json to the variant-aware shape introduced in @skmtc/core@0.5.0. " +
        "Idempotent — safe to re-run.",
    )
    .arguments("<project:string>")
    .option("--json", "Emit structured JSON output.")
    .action(async ({ json }, projectName) => {
      const { renderMigrateVariants } = await import(
        "@/commands/migrate-variants.ts"
      );
      await renderMigrateVariants({ projectName, jsonFlag: json });
    });

  const migrateCommand = new Command()
    .description(
      "Apply one-shot migrations to a project. Currently supports `variants` " +
        "(wrap operation enrichments + reshape skip/include for the variant axis).",
    )
    .action(() => {
      console.error("Usage: skmtc migrate <subcommand>");
      console.error("Subcommands:");
      console.error(
        "  variants <project>   Migrate to the variant-aware shape.",
      );
      Deno.exit(2);
    })
    .command("variants", migrateVariantsCommand);

  await new Command()
    .description("Generate code from an OpenAPI or GraphQL schema")
    .action(async (_flags) => {
      const { runPrompt } = await import("@/prompt/run-prompt.tsx");
      await runPrompt();
    })
    .command("init", initCommand)
    .command("create", createCommand)
    .command("clone", cloneCommand)
    .command("install", installCommand)
    .command("list", listCommand)
    .command("remove", removeCommand)
    .command("generate", generateCommand)
    .command("bundle", bundleCommand)
    .command("clean", cleanCommand)
    .command("publish", publishCommand)
    .command("push", pushCommand)
    .command("login", loginCommand)
    .command("logout", logoutCommand)
    .command("dev", devCommand)
    .command("doctor", doctorCommand)
    .command("agent-context", agentContextCommand)
    .command("migrate", migrateCommand)
    .parse(Deno.args);
};

run();
