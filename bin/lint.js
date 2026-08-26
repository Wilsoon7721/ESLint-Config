#!/usr/bin/env node

// Executed using `wlint`

import { spawnSync } from "child_process";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { dirname, relative, resolve } from "path";

// Two resolution roots, tried in this order:
//   1. the consuming project, so we run the exact ESLint/Prettier it installed -
//      the same ones node_modules/.bin/eslint would have run, and the ones its
//      config and plugins were installed against;
//   2. this package, as a fallback for projects that installed neither directly.
// Preferring our bundled copy would run a second, different major of ESLint over
// a config written for the project's, which fails deep inside ESLint (e.g. a
// hoisted eslint-scope with no addGlobals).
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

  // Signals (e.g. Ctrl-C) report a null status.
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

  // Matches the old '&&' behaviour: if ESLint reports unfixable problems, stop
  // there rather than reformatting on top of a failing lint.
  const eslintStatus = run("eslint", "eslint", ["--fix", ...(targets.length ? targets : ["."])]);
  process.exit(eslintStatus !== 0 ? eslintStatus : run("prettier", "prettier", ["--write", ...(targets.length ? targets : ["."])]));
} catch (err) {
  console.error(`\n  ⚠️  wlint could not run: ${err.message}\n`);
  process.exit(1);
}
