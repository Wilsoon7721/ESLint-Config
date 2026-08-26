#!/usr/bin/env node

// Executed using `wlint`

import { spawnSync } from "child_process";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";

const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`
  wlint - run the @wilsoon/eslint-config fixes

  Usage: npm run lint [--] [targets...]

  Runs 'eslint --fix' and then 'prettier --write' over the given files or
  directories. With no targets, both run over the whole project ('.').

  Examples:
    npm run lint                     # the entire project
    npm run lint src/                # one directory
    npm run lint src/app.ts utils/   # several targets
`);
  process.exit(0);
}

const targets = argv.length ? argv : ["."];

function binOf(pkgName, binName) {
  const manifestPath = require.resolve(`${pkgName}/package.json`);
  const { bin } = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const relative = typeof bin === "string" ? bin : bin[binName];

  if (!relative) throw new Error(`${pkgName} does not expose a "${binName}" executable.`);

  return resolve(dirname(manifestPath), relative);
}

function run(pkgName, binName, args) {
  const { status, error } = spawnSync(process.execPath, [binOf(pkgName, binName), ...args], { stdio: "inherit" });

  if (error) throw error;
  return status === null ? 1 : status;
}

try {
  const eslintStatus = run("eslint", "eslint", ["--fix", ...targets]);
  process.exit(eslintStatus !== 0 ? eslintStatus : run("prettier", "prettier", ["--write", ...targets]));
} catch (err) {
  console.error(`\n  ⚠️  wlint could not run: ${err.message}\n`);
  process.exit(1);
}
