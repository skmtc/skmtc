import { assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";

import {
  discoverWorkspace,
  hashPackageSources,
  incrementPatchVersion,
  planRelease,
} from "./increment-patch.ts";

Deno.test("incrementPatchVersion increments patch version correctly", () => {
  assertEquals(incrementPatchVersion("1.0.0"), "1.0.1");
  assertEquals(incrementPatchVersion("0.5.23"), "0.5.24");
  assertEquals(incrementPatchVersion("10.20.99"), "10.20.100");
});

Deno.test("incrementPatchVersion throws on invalid version format", () => {
  assertThrows(
    () => incrementPatchVersion("1.0"),
    Error,
    "Invalid version format: 1.0",
  );
  assertThrows(
    () => incrementPatchVersion("1.0.0.0"),
    Error,
    "Invalid version format: 1.0.0.0",
  );
  assertThrows(
    () => incrementPatchVersion("invalid"),
    Error,
    "Invalid version format: invalid",
  );
});

Deno.test("incrementPatchVersion throws on non-numeric patch", () => {
  assertThrows(
    () => incrementPatchVersion("1.0.abc"),
    Error,
    "Invalid patch version: abc is not a valid number",
  );
});

Deno.test("hashPackageSources is deterministic for unchanged source", async () => {
  const dir = await Deno.makeTempDir({ prefix: "hash_stable_" });
  try {
    await Deno.writeTextFile(join(dir, "mod.ts"), "export const x = 1;\n");
    await Deno.writeTextFile(
      join(dir, "deno.json"),
      JSON.stringify({ name: "@x/y", version: "0.1.0" }),
    );
    const first = await hashPackageSources(dir, []);
    const second = await hashPackageSources(dir, []);
    assertEquals(first, second);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("hashPackageSources ignores version field changes", async () => {
  const dir = await Deno.makeTempDir({ prefix: "hash_version_" });
  try {
    await Deno.writeTextFile(join(dir, "mod.ts"), "export const x = 1;\n");
    await Deno.writeTextFile(
      join(dir, "deno.json"),
      JSON.stringify({ name: "@x/y", version: "0.1.0" }),
    );
    const before = await hashPackageSources(dir, []);

    await Deno.writeTextFile(
      join(dir, "deno.json"),
      JSON.stringify({ name: "@x/y", version: "0.1.99" }),
    );
    const after = await hashPackageSources(dir, []);

    assertEquals(before, after);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("hashPackageSources detects content changes", async () => {
  const dir = await Deno.makeTempDir({ prefix: "hash_content_" });
  try {
    await Deno.writeTextFile(join(dir, "mod.ts"), "export const x = 1;\n");
    await Deno.writeTextFile(
      join(dir, "deno.json"),
      JSON.stringify({ name: "@x/y", version: "0.1.0" }),
    );
    const before = await hashPackageSources(dir, []);

    await Deno.writeTextFile(join(dir, "mod.ts"), "export const x = 2;\n");
    const after = await hashPackageSources(dir, []);

    if (before === after) throw new Error("Expected hashes to differ");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("hashPackageSources honors publish.exclude", async () => {
  const dir = await Deno.makeTempDir({ prefix: "hash_exclude_" });
  try {
    await Deno.writeTextFile(join(dir, "mod.ts"), "export const x = 1;\n");
    await Deno.writeTextFile(
      join(dir, "deno.json"),
      JSON.stringify({ name: "@x/y", version: "0.1.0" }),
    );
    await ensureDir(join(dir, "test"));
    await Deno.writeTextFile(join(dir, "test", "a.ts"), "// initial\n");
    const before = await hashPackageSources(dir, ["test/"]);

    await Deno.writeTextFile(join(dir, "test", "a.ts"), "// modified\n");
    const after = await hashPackageSources(dir, ["test/"]);

    assertEquals(before, after);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

async function setupWorkspace(tempDir: string) {
  await Deno.writeTextFile(
    join(tempDir, "deno.json"),
    JSON.stringify({ workspace: ["./core", "./worker", "./cli"] }, null, 2),
  );

  await ensureDir(join(tempDir, "core"));
  await Deno.writeTextFile(
    join(tempDir, "core", "mod.ts"),
    "export const core = 1;\n",
  );
  await Deno.writeTextFile(
    join(tempDir, "core", "deno.json"),
    JSON.stringify({ name: "@skmtc/core", version: "0.4.4" }, null, 2),
  );

  await ensureDir(join(tempDir, "worker"));
  await Deno.writeTextFile(
    join(tempDir, "worker", "mod.ts"),
    "export const worker = 1;\n",
  );
  await Deno.writeTextFile(
    join(tempDir, "worker", "deno.json"),
    JSON.stringify(
      {
        name: "@skmtc/worker",
        version: "0.2.3",
        imports: { "@skmtc/core": "jsr:@skmtc/core@0.4.4" },
      },
      null,
      2,
    ),
  );

  await ensureDir(join(tempDir, "cli"));
  await Deno.writeTextFile(
    join(tempDir, "cli", "mod.ts"),
    "export const cli = 1;\n",
  );
  await Deno.writeTextFile(
    join(tempDir, "cli", "deno.json"),
    JSON.stringify(
      {
        name: "@skmtc/cli",
        version: "0.2.3",
        imports: {
          "@skmtc/core": "jsr:@skmtc/core@0.4.4",
          "@skmtc/worker": "jsr:@skmtc/worker@0.2.3",
          "@skmtc/worker/types": "jsr:@skmtc/worker@0.2.3/types",
        },
      },
      null,
      2,
    ),
  );
}

async function snapshotState(rootPath: string) {
  const packages = await discoverWorkspace(rootPath);
  const state = {
    packages: {} as Record<string, { version: string; hash: string }>,
  };
  for (const pkg of packages) {
    const hash = await hashPackageSources(pkg.dir, pkg.publishExclude);
    state.packages[pkg.name] = { version: pkg.version, hash };
  }
  return state;
}

Deno.test("planRelease: no state, no bumps, all packages flagged for publish", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "plan_initial_" });
  try {
    await setupWorkspace(tempDir);
    const packages = await discoverWorkspace(tempDir);
    const plan = await planRelease(packages, { packages: {} });

    assertEquals(plan.bumps.size, 0);
    assertEquals(plan.imports.size, 0);
    assertEquals(plan.publishOrder, [
      "@skmtc/core",
      "@skmtc/worker",
      "@skmtc/cli",
    ]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("planRelease: clean state, no changes, nothing to publish", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "plan_clean_" });
  try {
    await setupWorkspace(tempDir);
    const state = await snapshotState(tempDir);
    const packages = await discoverWorkspace(tempDir);
    const plan = await planRelease(packages, state);
    assertEquals(plan.publishOrder, []);
    assertEquals(plan.bumps.size, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("planRelease: leaf change bumps dependents transitively with exact versions", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "plan_transitive_" });
  try {
    await setupWorkspace(tempDir);
    const state = await snapshotState(tempDir);

    await Deno.writeTextFile(
      join(tempDir, "core", "mod.ts"),
      "export const core = 2;\n",
    );
    const packages = await discoverWorkspace(tempDir);
    const plan = await planRelease(packages, state);

    assertEquals(plan.publishOrder, [
      "@skmtc/core",
      "@skmtc/worker",
      "@skmtc/cli",
    ]);
    assertEquals(plan.bumps.get("@skmtc/core"), "0.4.5");
    assertEquals(plan.bumps.get("@skmtc/worker"), "0.2.4");
    assertEquals(plan.bumps.get("@skmtc/cli"), "0.2.4");

    const workerImports = plan.imports.get("@skmtc/worker");
    if (!workerImports) throw new Error("Expected worker imports rewritten");
    assertEquals(workerImports["@skmtc/core"], "jsr:@skmtc/core@0.4.5");

    const cliImports = plan.imports.get("@skmtc/cli");
    if (!cliImports) throw new Error("Expected cli imports rewritten");
    assertEquals(cliImports["@skmtc/core"], "jsr:@skmtc/core@0.4.5");
    assertEquals(cliImports["@skmtc/worker"], "jsr:@skmtc/worker@0.2.4");
    assertEquals(
      cliImports["@skmtc/worker/types"],
      "jsr:@skmtc/worker@0.2.4/types",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("planRelease: caret in input is rewritten to exact pin", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "plan_caret_" });
  try {
    await setupWorkspace(tempDir);
    await Deno.writeTextFile(
      join(tempDir, "worker", "deno.json"),
      JSON.stringify(
        {
          name: "@skmtc/worker",
          version: "0.2.3",
          imports: { "@skmtc/core": "jsr:@skmtc/core@^0.4.4" },
        },
        null,
        2,
      ),
    );
    const state = await snapshotState(tempDir);

    await Deno.writeTextFile(
      join(tempDir, "core", "mod.ts"),
      "export const core = 99;\n",
    );
    const packages = await discoverWorkspace(tempDir);
    const plan = await planRelease(packages, state);

    const workerImports = plan.imports.get("@skmtc/worker");
    if (!workerImports) throw new Error("Expected worker imports rewritten");
    assertEquals(workerImports["@skmtc/core"], "jsr:@skmtc/core@0.4.5");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("planRelease: manual version edit triggers publish without further bump", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "plan_manual_" });
  try {
    await setupWorkspace(tempDir);
    const state = await snapshotState(tempDir);

    await Deno.writeTextFile(
      join(tempDir, "core", "deno.json"),
      JSON.stringify({ name: "@skmtc/core", version: "0.5.0" }, null, 2),
    );

    const packages = await discoverWorkspace(tempDir);
    const plan = await planRelease(packages, state);

    assertEquals(plan.bumps.has("@skmtc/core"), false);
    assertEquals(plan.publishOrder.includes("@skmtc/core"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
