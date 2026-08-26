#!/usr/bin/env node

// Executed using `wlint`

import { spawnSync } from "child_process";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { dirname, relative, resolve } from "path";
import { statSync } from "fs";
import { EXTENSIONS } from "../eslint/files.js";

const ourRequire = createRequire(import.meta.url);
const projectRequire = createRequire(resolve(process.cwd(), "package.json"));
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

  Options:
    --which      Print which ESLint and Prettier would run, then exit
    -h, --help   Show this message
`);
  process.exit(0);
}

const targets = argv.filter((a) => a !== "--which");
const resolvedTargets = targets.length ? targets : ["."];

function isDirectory(target) {
  try {
    return statSync(resolve(process.cwd(), target)).isDirectory();
  } catch {
    return false;
  }
}

function prettierTargets() {
  return resolvedTargets.map((target) => {
    if (!isDirectory(target)) return target;

    const normalised = target.split("\\").join("/").replace(/\/+$/, "");
    const prefix = target === "." ? "" : `${normalised}/`;
    return `${prefix}**/*.{${EXTENSIONS.join(",")}}`;
  });
}

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

try {
  if (argv.includes("--which")) {
    for (const name of ["eslint", "prettier"]) {
      const { version, dir } = binOf(name, name);
      console.log(`  ${name} v${version}  ${relative(process.cwd(), dir) || dir}`);
    }

    process.exit(0);
  }

  const eslintStatus = run("eslint", "eslint", ["--fix", ...resolvedTargets]);

  if (eslintStatus !== 0) process.exit(eslintStatus);

  process.exit(run("prettier", "prettier", ["--write", "--no-error-on-unmatched-pattern", ...prettierTargets()]));
} catch (err) {
  console.error(`\n  ⚠️  wlint could not run: ${err.message}\n`);
  process.exit(1);
}
