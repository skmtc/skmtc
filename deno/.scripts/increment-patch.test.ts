import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";

// Import the functions we want to test
import { incrementPatchVersion } from "./increment-patch.ts";

Deno.test("incrementPatchVersion increments patch version correctly", () => {
  assertEquals(incrementPatchVersion("1.0.0"), "1.0.1");
  assertEquals(incrementPatchVersion("0.5.23"), "0.5.24");
  assertEquals(incrementPatchVersion("10.20.99"), "10.20.100");
});

Deno.test("incrementPatchVersion handles version with leading zeros", () => {
  assertEquals(incrementPatchVersion("1.0.09"), "1.0.10");
  assertEquals(incrementPatchVersion("0.0.0"), "0.0.1");
});

Deno.test("incrementPatchVersion throws error for invalid version format", () => {
  assertThrows(
    () => incrementPatchVersion("1.0"),
    Error,
    "Invalid version format: 1.0"
  );
  
  assertThrows(
    () => incrementPatchVersion("1.0.0.0"),
    Error,
    "Invalid version format: 1.0.0.0"
  );
  
  assertThrows(
    () => incrementPatchVersion("invalid"),
    Error,
    "Invalid version format: invalid"
  );
});

Deno.test("incrementPatchVersion throws error for non-numeric patch version", () => {
  assertThrows(
    () => incrementPatchVersion("1.0.abc"),
    Error,
    "Invalid patch version: abc is not a valid number"
  );
  
  assertThrows(
    () => incrementPatchVersion("1.0."),
    Error,
    "Invalid patch version:  is not a valid number"
  );
  
  assertThrows(
    () => incrementPatchVersion("1.0.1.2"),
    Error,
    "Invalid version format: 1.0.1.2"
  );
});

// Integration tests using temporary directories
Deno.test({
  name: "Integration test: full workspace version increment",
  fn: async () => {
    const tempDir = await Deno.makeTempDir({ prefix: "version_test_" });
    
    try {
      // Create mock workspace structure
      await setupMockWorkspace(tempDir);
      
      // Import the main function dynamically to avoid module loading issues
      const { incrementWorkspaceVersions } = await import("./increment-patch.ts");
      
      // Run the version increment
      await incrementWorkspaceVersions(tempDir);
      
      // Verify versions were incremented
      await verifyVersionsIncremented(tempDir);
      
      // Verify import references were updated
      await verifyImportsUpdated(tempDir);
      
    } finally {
      // Clean up
      await Deno.remove(tempDir, { recursive: true });
    }
  },
  sanitizeResources: false,
  sanitizeOps: false
});

async function setupMockWorkspace(tempDir: string) {
  // Create root deno.json
  const rootConfig = {
    workspace: ["./cli", "./core", "./server", "./mcp"]
  };
  await Deno.writeTextFile(
    join(tempDir, "deno.json"), 
    JSON.stringify(rootConfig, null, 2)
  );
  
  // Create CLI package
  await ensureDir(join(tempDir, "cli"));
  const cliConfig = {
    name: "@skmtc/cli",
    version: "0.0.100",
    exports: "./mod.ts",
    imports: {
      "@skmtc/core": "jsr:@skmtc/core@^0.0.200"
    }
  };
  await Deno.writeTextFile(
    join(tempDir, "cli", "deno.json"),
    JSON.stringify(cliConfig, null, 2)
  );
  
  // Create Core package
  await ensureDir(join(tempDir, "core"));
  const coreConfig = {
    name: "@skmtc/core",
    version: "0.0.200",
    exports: "./mod.ts"
  };
  await Deno.writeTextFile(
    join(tempDir, "core", "deno.json"),
    JSON.stringify(coreConfig, null, 2)
  );
  
  // Create Server package
  await ensureDir(join(tempDir, "server"));
  const serverConfig = {
    name: "@skmtc/server",
    version: "0.0.300",
    exports: "./mod.ts",
    imports: {
      "@skmtc/core": "jsr:@skmtc/core@^0.0.200"
    }
  };
  await Deno.writeTextFile(
    join(tempDir, "server", "deno.json"),
    JSON.stringify(serverConfig, null, 2)
  );
  
  // Create MCP package
  await ensureDir(join(tempDir, "mcp"));
  const mcpConfig = {
    name: "@skmtc/mcp",
    version: "0.0.50",
    exports: "./mod.ts",
    imports: {
      "@skmtc/cli": "jsr:@skmtc/cli@^0.0.100"
    }
  };
  await Deno.writeTextFile(
    join(tempDir, "mcp", "deno.json"),
    JSON.stringify(mcpConfig, null, 2)
  );
}

async function verifyVersionsIncremented(tempDir: string) {
  // Check CLI version
  const cliConfig = JSON.parse(
    await Deno.readTextFile(join(tempDir, "cli", "deno.json"))
  );
  assertEquals(cliConfig.version, "0.0.101");
  
  // Check Core version
  const coreConfig = JSON.parse(
    await Deno.readTextFile(join(tempDir, "core", "deno.json"))
  );
  assertEquals(coreConfig.version, "0.0.201");
  
  // Check Server version
  const serverConfig = JSON.parse(
    await Deno.readTextFile(join(tempDir, "server", "deno.json"))
  );
  assertEquals(serverConfig.version, "0.0.301");
  
  // Check MCP version
  const mcpConfig = JSON.parse(
    await Deno.readTextFile(join(tempDir, "mcp", "deno.json"))
  );
  assertEquals(mcpConfig.version, "0.0.51");
}

async function verifyImportsUpdated(tempDir: string) {
  // Check CLI imports core with new version
  const cliConfig = JSON.parse(
    await Deno.readTextFile(join(tempDir, "cli", "deno.json"))
  );
  assertEquals(cliConfig.imports["@skmtc/core"], "jsr:@skmtc/core@^0.0.201");
  
  // Check Server imports core with new version
  const serverConfig = JSON.parse(
    await Deno.readTextFile(join(tempDir, "server", "deno.json"))
  );
  assertEquals(serverConfig.imports["@skmtc/core"], "jsr:@skmtc/core@^0.0.201");
  
  // Check MCP imports CLI with new version
  const mcpConfig = JSON.parse(
    await Deno.readTextFile(join(tempDir, "mcp", "deno.json"))
  );
  assertEquals(mcpConfig.imports["@skmtc/cli"], "jsr:@skmtc/cli@^0.0.101");
}

Deno.test("Edge case: package without imports", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "version_test_no_imports_" });
  
  try {
    // Create root deno.json
    const rootConfig = {
      workspace: ["./standalone"]
    };
    await Deno.writeTextFile(
      join(tempDir, "deno.json"), 
      JSON.stringify(rootConfig, null, 2)
    );
    
    // Create standalone package without imports
    await ensureDir(join(tempDir, "standalone"));
    const standaloneConfig = {
      name: "@skmtc/standalone",
      version: "1.0.0",
      exports: "./mod.ts"
    };
    await Deno.writeTextFile(
      join(tempDir, "standalone", "deno.json"),
      JSON.stringify(standaloneConfig, null, 2)
    );
    
    const { incrementWorkspaceVersions } = await import("./increment-patch.ts");
    await incrementWorkspaceVersions(tempDir);
    
    // Verify version was incremented
    const updatedConfig = JSON.parse(
      await Deno.readTextFile(join(tempDir, "standalone", "deno.json"))
    );
    assertEquals(updatedConfig.version, "1.0.1");
    
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Edge case: package with non-JSR imports", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "version_test_npm_imports_" });
  
  try {
    // Create root deno.json
    const rootConfig = {
      workspace: ["./with-npm"]
    };
    await Deno.writeTextFile(
      join(tempDir, "deno.json"), 
      JSON.stringify(rootConfig, null, 2)
    );
    
    // Create package with npm imports
    await ensureDir(join(tempDir, "with-npm"));
    const npmConfig = {
      name: "@skmtc/with-npm",
      version: "2.0.0",
      exports: "./mod.ts",
      imports: {
        "lodash": "npm:lodash@^4.17.21",
        "@std/assert": "jsr:@std/assert@^1.0.0"
      }
    };
    await Deno.writeTextFile(
      join(tempDir, "with-npm", "deno.json"),
      JSON.stringify(npmConfig, null, 2)
    );
    
    const { incrementWorkspaceVersions } = await import("./increment-patch.ts");
    await incrementWorkspaceVersions(tempDir);
    
    // Verify version was incremented but npm imports unchanged
    const updatedConfig = JSON.parse(
      await Deno.readTextFile(join(tempDir, "with-npm", "deno.json"))
    );
    assertEquals(updatedConfig.version, "2.0.1");
    assertEquals(updatedConfig.imports["lodash"], "npm:lodash@^4.17.21");
    assertEquals(updatedConfig.imports["@std/assert"], "jsr:@std/assert@^1.0.0");
    
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});