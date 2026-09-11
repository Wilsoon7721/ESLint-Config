#!/usr/bin/env node

// Executed using `wlint`

import { spawnSync } from "child_process";
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ourRequire = createRequire(import.meta.url);
const projectRequire = createRequire(resolve(process.cwd(), "package.json"));
const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`
  wlint - run the @wilsoon/eslint-config fixes

  Usage: npm run lint [--] [targets...]

  Runs 'eslint --fix' and then 'dprint fmt' over the given files or
  directories. With no targets, both run over the whole project ('.').

  Examples:
    npm run lint                     # the entire project
    npm run lint src/                # one directory
    npm run lint src/app.ts utils/   # several targets

  Options:
    --check      Check for issues without modifying files (CI mode)
    --which      Print which ESLint and dprint would run, then exit
    -h, --help   Show this message
`);
  process.exit(0);
}

const CONTROL_FLAGS = new Set(["--which", "--check"]);
const checkMode = argv.includes("--check");
const targets = argv.filter((a) => !CONTROL_FLAGS.has(a));
const resolvedTargets = targets.length ? targets : ["."];

function binOf(pkgName, binName) {
  let manifestPath;

  try {
    manifestPath = projectRequire.resolve(`${pkgName}/package.json`);
  } catch {
    try {
      manifestPath = ourRequire.resolve(`${pkgName}/package.json`);
    } catch {
      throw new Error(`could not find ${pkgName}. Try reinstalling your dependencies.`);
    }
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];

  if (!bin) throw new Error(`${pkgName} does not expose a "${binName}" executable.`);

  return { path: resolve(dirname(manifestPath), bin), version: manifest.version, dir: dirname(manifestPath) };
}

function run(pkgName, binName, args) {
  const { status, error } = spawnSync(process.execPath, [binOf(pkgName, binName).path, ...args], { stdio: "inherit" });

  if (error) throw error;

  // Ctrl + C report a null status
  return status === null ? 1 : status;
}

/**
 * Resolve the dprint config to use.
 *
 * 1. If the project has its own dprint.json / .dprint.json, let dprint auto-discover it (return no extra args).
 * 2. Otherwise fall back to the config shipped with this package.
 */
function dprintConfigArgs() {
  const cwd = process.cwd();
  const candidates = ["dprint.json", ".dprint.json", "dprint.jsonc", ".dprint.jsonc"];

  if (candidates.some((f) => existsSync(resolve(cwd, f)))) return [];

  return ["--config", resolve(__dirname, "..", "formatter", "dprint.json")];
}

try {
  if (argv.includes("--which")) {
    for (const [pkg, name] of [
      ["eslint", "eslint"],
      ["dprint", "dprint"],
    ]) {
      const { version, dir } = binOf(pkg, name);
      console.log(`  ${name} v${version}  ${relative(process.cwd(), dir) || dir}`);
    }

    process.exit(0);
  }

  const configArgs = dprintConfigArgs();

  if (checkMode) {
    // --check: run both tools without modifying files, always exit 0
    run("eslint", "eslint", [...resolvedTargets]);
    run("dprint", "dprint", ["check", ...configArgs, ...resolvedTargets]);
    process.exit(0);
  }

  // Default: fix mode
  const eslintStatus = run("eslint", "eslint", ["--fix", ...resolvedTargets]);

  if (eslintStatus !== 0) process.exit(eslintStatus);

  process.exit(run("dprint", "dprint", ["fmt", ...configArgs, ...resolvedTargets]));
} catch (err) {
  console.error(`\n  ⚠️  wlint could not run: ${err.message}\n`);
  process.exit(1);
}
