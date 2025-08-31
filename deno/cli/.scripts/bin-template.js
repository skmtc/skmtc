#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Minimum Node.js version required
const MIN_NODE_VERSION = "18.0.0";

/**
 * Compare semantic version strings
 */
function semver(version) {
  const parts = version.split('.').map(Number);
  return {
    compare: (other) => {
      const otherParts = other.split('.').map(Number);
      for (let i = 0; i < Math.max(parts.length, otherParts.length); i++) {
        const a = parts[i] || 0;
        const b = otherParts[i] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
      }
      return 0;
    }
  };
}

/**
 * Check if current Node.js version meets minimum requirements
 */
function checkNodeVersion() {
  const currentVersion = process.version.slice(1); // Remove 'v' prefix
  const versionCheck = semver(currentVersion);
  
  if (versionCheck.compare(MIN_NODE_VERSION) < 0) {
    console.error(`Error: SKMTC requires Node.js ${MIN_NODE_VERSION} or higher. You are using ${process.version}.`);
    process.exit(1);
  }
}

/**
 * Run the SKMTC CLI
 */
function runSkmtc() {
  // Path to the main CLI module
  const cliPath = path.join(__dirname, "../esm/cli/mod.js");
  
  // Check if the CLI file exists
  if (!fs.existsSync(cliPath)) {
    console.error(`Error: SKMTC CLI not found at ${cliPath}`);
    console.error("Please ensure the package is properly installed.");
    process.exit(1);
  }
  
  // Spawn the CLI process
  const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
  
  // Handle child process events
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code || 0);
    }
  });
  
  child.on("error", (error) => {
    console.error("Error running SKMTC:", error.message);
    process.exit(1);
  });
  
  return child;
}

// Main execution
if (module === require.main) {
  checkNodeVersion();
  
  let skmtcProcess = runSkmtc();
  
  // Handle process termination signals
  process.on("SIGINT", () => {
    if (skmtcProcess) {
      skmtcProcess.kill("SIGINT");
    }
  });
  
  process.on("SIGTERM", () => {
    if (skmtcProcess) {
      skmtcProcess.kill("SIGTERM");
    }
  });
}