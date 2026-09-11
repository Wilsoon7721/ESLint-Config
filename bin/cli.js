#!/usr/bin/env node
import { createInterface } from "readline";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ESLINT_CONFIG, LINT_CMD, getProjectRoot, getDprintConfig, inspectProject, log, setLintScript, writeEslintConfig, writeDprintConfig } from "../scripts/setup-lib.js";

const projectRoot = getProjectRoot();
const argv = process.argv.slice(2);
const assumeYes = argv.includes("-y") || argv.includes("--yes");
const interactive = process.stdin.isTTY && process.stdout.isTTY;

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`
  @wilsoon/eslint-config - project setup

  Usage: npx @wilsoon/eslint-config [options]

  Options:
    -y, --yes    Accept every prompt (overwrites conflicting configs)
    -h, --help   Show this message
`);
  process.exit(0);
}

function ask(question, defaultYes = false) {
  if (assumeYes) return Promise.resolve("y");
  if (!interactive) return Promise.resolve(defaultYes ? "y" : "n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(`  ${question}`, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase());
    });
  });
}

const yes = (answer, defaultYes = false) => (answer === "" ? defaultYes : answer === "y" || answer === "yes");

/** True when `file` already holds exactly the template we would write. */
function alreadyOurs(file, template) {
  try {
    return readFileSync(resolve(projectRoot, file), "utf-8") === template;
  } catch {
    return false;
  }
}

async function main() {
  const state = inspectProject(projectRoot);

  console.log();
  console.log("  ┌──────────────────────────────────────────────────────┐");
  console.log("  │  📦 @wilsoon/eslint-config - Project Setup           │");
  console.log("  └──────────────────────────────────────────────────────┘");
  console.log();
  console.log("  This package bundles custom ESLint rules and a dprint");
  console.log("  formatter config that auto-fix your code style. It sets");
  console.log("  up your project so you can directly run 'npm run lint'");
  console.log("  to apply the rules.");
  console.log();

  if (!interactive && !assumeYes) {
    log("⚠️", 'Not running in a terminal - prompts will be answered with "no".');
    log("  ", "Pass --yes to accept every prompt instead.");
    console.log();
  }

  let madeChanges = false;

  // ESLint config
  if (!state.hasEslint) {
    log("✅", `Created ${writeEslintConfig(projectRoot)}`);
    log("  ", "Take note: your own rule overrides in eslint.config.js will always take precedence.");
    madeChanges = true;
  } else if (alreadyOurs(state.eslintFile, ESLINT_CONFIG)) {
    log("✅", `${state.eslintFile} is already using the @wilsoon config.`);
  } else {
    log("⚠️", `${state.eslintFile} already exists.`);
    if (yes(await ask(`Replace it with the @wilsoon config? (y/N) `))) {
      writeEslintConfig(projectRoot, state.eslintFile);
      log("✅", `Replaced ${state.eslintFile}`);
      log("  ", "Take note: your own rule overrides will always take precedence.");
      madeChanges = true;
    } else {
      log("⏭️", `Keeping your existing ${state.eslintFile}.`);
      log("  ", "To use this config, spread it in: import wilsoonConfig from '@wilsoon/eslint-config/eslint';");
    }
  }
  console.log();

  // dprint config
  const dprintTemplate = getDprintConfig();

  if (!state.hasDprint) {
    if (state.hasLegacyPrettier) {
      log("⚠️", `Found legacy Prettier config: ${state.legacyPrettierFile}`);
      log("  ", "This version uses dprint instead of Prettier.");
      log("  ", `You can safely remove ${state.legacyPrettierFile} after setup.`);
      console.log();
    }

    log("✅", `Created ${writeDprintConfig(projectRoot)}`);
    madeChanges = true;
  } else if (alreadyOurs(state.dprintFile, dprintTemplate)) {
    log("✅", `${state.dprintFile} is already using the @wilsoon config.`);
  } else {
    log("⚠️", `${state.dprintFile} already exists.`);
    if (yes(await ask(`Replace it with the @wilsoon config? (y/N) `))) {
      writeDprintConfig(projectRoot, state.dprintFile);
      log("✅", `Replaced ${state.dprintFile}`);
      madeChanges = true;
    } else {
      log("⏭️", `Keeping your existing ${state.dprintFile}.`);
    }
  }
  console.log();

  // Legacy Prettier cleanup hint
  if (state.hasLegacyPrettier && state.hasDprint) {
    log("💡", `Legacy Prettier config detected: ${state.legacyPrettierFile}`);
    log("  ", "This version uses dprint. You can safely delete the Prettier config.");
    console.log();
  }

  // package.json lint script
  if (!state.pkg) {
    log("⏭️", 'No package.json found - skipping the "lint" script.');
    console.log();
  } else if (!state.hasLintScript) {
    setLintScript(state.pkg);
    log("✅", `Added "lint" script to package.json: '${LINT_CMD}'`);
    madeChanges = true;
    console.log();
  } else if (state.lintScriptIsLegacy) {
    log("⚠️", `Your lint script is from an older version: '${state.lintScript}'`);
    log("  ", `It hardcodes '.', so 'npm run lint src/' lints the whole project anyway.`);
    log("  ", `The current script is:  '${LINT_CMD}'`);
    if (yes(await ask("Update it? (Y/n) ", true), true)) {
      setLintScript(state.pkg);
      log("✅", "Updated lint script in package.json");
      madeChanges = true;
    } else {
      log("⏭️", "Keeping existing lint script.");
    }
    console.log();
  } else if (!state.lintScriptMatches) {
    log("⚠️", `Existing lint script: '${state.lintScript}'`);
    log("  ", `This package needs:   '${LINT_CMD}'`);
    if (yes(await ask("Replace it? (y/N) "))) {
      setLintScript(state.pkg);
      log("✅", "Updated lint script in package.json");
      madeChanges = true;
    } else {
      log("⏭️", "Keeping existing lint script.");
    }
    console.log();
  }

  if (madeChanges) {
    console.log("  🎉 All set! Run \x1b[1mnpm run lint\x1b[0m to lint and format your project.");
  } else {
    console.log("  ✨ Nothing to change - your project is already set up.");
  }
  console.log();
}

main().catch((err) => {
  console.error(`\n  ⚠️  @wilsoon/eslint-config setup had an issue: ${err.message}`);
  console.error("     You can set up manually - see the README for instructions.\n");
  process.exitCode = 1;
});
