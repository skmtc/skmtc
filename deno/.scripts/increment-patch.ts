#!/usr/bin/env -S deno run --allow-read --allow-write

import { join } from "@std/path";

interface DenoJson {
  name?: string;
  version?: string;
  imports?: Record<string, string>;
  [key: string]: unknown;
}

interface PackageInfo {
  name: string;
  path: string;
  currentVersion: string;
  newVersion: string;
}

/**
 * Increments patch version (x.y.z -> x.y.z+1)
 */
export function incrementPatchVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  const [major, minor, patch] = parts;
  const patchNumber = parseInt(patch, 10);
  
  // Check if patch is a valid number (allow leading zeros)
  if (isNaN(patchNumber) || !/^\d+$/.test(patch)) {
    throw new Error(`Invalid patch version: ${patch} is not a valid number`);
  }
  
  const newPatch = patchNumber + 1;
  return `${major}.${minor}.${newPatch}`;
}

/**
 * Reads and parses a deno.json file
 */
async function readDenoJson(filePath: string): Promise<DenoJson> {
  try {
    const content = await Deno.readTextFile(filePath);
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Writes a deno.json file with proper formatting
 */
async function writeDenoJson(filePath: string, data: DenoJson): Promise<void> {
  try {
    const content = JSON.stringify(data, null, 2) + '\n';
    await Deno.writeTextFile(filePath, content);
  } catch (error) {
    throw new Error(`Failed to write ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Discovers all packages in the workspace by reading the root deno.json
 */
async function discoverPackages(rootPath: string): Promise<string[]> {
  const rootDenoJsonPath = join(rootPath, "deno.json");
  const rootConfig = await readDenoJson(rootDenoJsonPath);
  
  if (!rootConfig.workspace || !Array.isArray(rootConfig.workspace)) {
    throw new Error("No workspace configuration found in root deno.json");
  }
  
  return rootConfig.workspace.map((workspace: string) => 
    workspace.startsWith('./') ? workspace.slice(2) : workspace
  );
}

/**
 * Gets current version information for all packages
 */
async function getPackageVersions(rootPath: string, workspacePaths: string[]): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];
  
  for (const workspacePath of workspacePaths) {
    const packagePath = join(rootPath, workspacePath);
    const denoJsonPath = join(packagePath, "deno.json");
    
    try {
      const config = await readDenoJson(denoJsonPath);
      
      if (!config.name || !config.version) {
        console.warn(`Skipping ${workspacePath}: missing name or version`);
        continue;
      }
      
      packages.push({
        name: config.name,
        path: workspacePath,
        currentVersion: config.version,
        newVersion: incrementPatchVersion(config.version)
      });
    } catch (error) {
      console.warn(`Skipping ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return packages;
}

/**
 * Updates version in a package's deno.json
 */
async function updatePackageVersion(rootPath: string, packageInfo: PackageInfo): Promise<void> {
  const denoJsonPath = join(rootPath, packageInfo.path, "deno.json");
  const config = await readDenoJson(denoJsonPath);
  
  config.version = packageInfo.newVersion;
  
  await writeDenoJson(denoJsonPath, config);
  console.log(`Updated ${packageInfo.name}: ${packageInfo.currentVersion} → ${packageInfo.newVersion}`);
}

/**
 * Updates import references to workspace packages
 */
async function updateImportReferences(rootPath: string, packagePath: string, packages: PackageInfo[]): Promise<void> {
  const denoJsonPath = join(rootPath, packagePath, "deno.json");
  const config = await readDenoJson(denoJsonPath);
  
  if (!config.imports) {
    return;
  }
  
  let hasUpdates = false;
  
  for (const pkg of packages) {
    const importKey = pkg.name;
    const currentImport = config.imports[importKey];
    
    if (currentImport && currentImport.startsWith('jsr:')) {
      // Update JSR import: "jsr:@skmtc/core@^0.0.718" -> "jsr:@skmtc/core@^0.0.719"
      const newImport = currentImport.replace(
        new RegExp(`@\\^?${pkg.currentVersion.replace(/\./g, '\\.')}`),
        `@^${pkg.newVersion}`
      );
      
      if (newImport !== currentImport) {
        config.imports[importKey] = newImport;
        hasUpdates = true;
        console.log(`  Updated import ${importKey}: ${currentImport} → ${newImport}`);
      }
    }
  }
  
  if (hasUpdates) {
    await writeDenoJson(denoJsonPath, config);
  }
}

/**
 * Main function to increment all package versions
 */
export async function incrementWorkspaceVersions(rootPath: string = Deno.cwd()): Promise<void> {
  try {
    console.log("🔍 Discovering workspace packages...");
    const workspacePaths = await discoverPackages(rootPath);
    console.log(`Found workspace paths: ${workspacePaths.join(', ')}`);
    
    console.log("\n📋 Getting current package versions...");
    const packages = await getPackageVersions(rootPath, workspacePaths);
    
    if (packages.length === 0) {
      console.log("No packages found with valid name and version");
      return;
    }
    
    console.log(`Found ${packages.length} packages:`);
    for (const pkg of packages) {
      console.log(`  ${pkg.name}: ${pkg.currentVersion} → ${pkg.newVersion}`);
    }
    
    console.log("\n⬆️  Updating package versions...");
    for (const pkg of packages) {
      await updatePackageVersion(rootPath, pkg);
    }
    
    console.log("\n🔗 Updating import references...");
    for (const workspacePath of workspacePaths) {
      console.log(`Checking imports in ${workspacePath}...`);
      await updateImportReferences(rootPath, workspacePath, packages);
    }
    
    console.log("\n✅ All versions incremented successfully!");
    
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.main) {
  await incrementWorkspaceVersions();
}