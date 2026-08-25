#!/usr/bin/env node

/**
 * Interactive setup: `npx @wilsoon/eslint-config`.
 *
 * The postinstall script only ever creates missing files, because npm lifecycle
 * scripts run without a usable stdin. Everything that needs a decision - and
 * every change that would overwrite something - lives here instead.
 */

import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ESLINT_CONFIG,
  PRETTIER_CONFIG,
  LINT_CMD,
  getProjectRoot,
  inspectProject,
  log,
  setLintScript,
  writeEslintConfig,
  writePrettierConfig
} from '../scripts/setup-lib.js';

const projectRoot = getProjectRoot();
const argv = process.argv.slice(2);
const assumeYes = argv.includes('-y') || argv.includes('--yes');
const interactive = process.stdin.isTTY && process.stdout.isTTY;

if (argv.includes('-h') || argv.includes('--help')) {
  console.log(`
  @wilsoon/eslint-config - project setup

  Usage: npx @wilsoon/eslint-config [options]

  Options:
    -y, --yes    Accept every prompt (overwrites conflicting configs)
    -h, --help   Show this message
`);
  process.exit(0);
}

/** JS-style config files we can safely rewrite with an ESM template. */
const REWRITABLE = /\.(js|mjs|cjs|ts|mts|cts)$/;

function ask(question) {
  if (assumeYes) return Promise.resolve('y');
  if (!interactive) return Promise.resolve('n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(`  ${question}`, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase());
    });
  });
}

const yes = (answer) => answer === 'y' || answer === 'yes';

/** True when `file` already holds exactly the template we would write. */
function alreadyOurs(file, template) {
  try {
    return readFileSync(resolve(projectRoot, file), 'utf-8') === template;
  } catch {
    return false;
  }
}

async function main() {
  const state = inspectProject(projectRoot);

  console.log();
  console.log('  ┌──────────────────────────────────────────────────────┐');
  console.log('  │  📦 @wilsoon/eslint-config - Project Setup           │');
  console.log('  └──────────────────────────────────────────────────────┘');
  console.log();
  console.log('  This package bundles custom ESLint rules and a Prettier');
  console.log('  config that auto-fix your code style. It sets up your');
  console.log('  project so you can directly run \'npm run lint\' to apply');
  console.log('  the rules.');
  console.log();

  if (!interactive && !assumeYes) {
    log('⚠️', 'Not running in a terminal - prompts will be answered with "no".');
    log('  ', 'Pass --yes to accept every prompt instead.');
    console.log();
  }

  let madeChanges = false;

  // ESLint config
  if (!state.hasEslint) {
    writeEslintConfig(projectRoot);
    log('✅', 'Created eslint.config.js');
    log('  ', 'Take note: your own rule overrides in eslint.config.js will always take precedence.');
    madeChanges = true;
  } else if (alreadyOurs(state.eslintFile, ESLINT_CONFIG)) {
    log('✅', `${state.eslintFile} is already using the @wilsoon config.`);
  } else if (REWRITABLE.test(state.eslintFile)) {
    log('⚠️', `${state.eslintFile} already exists.`);
    if (yes(await ask(`Replace it with the @wilsoon config? (y/N) `))) {
      writeEslintConfig(projectRoot, state.eslintFile);
      log('✅', `Replaced ${state.eslintFile}`);
      log('  ', 'Take note: your own rule overrides will always take precedence.');
      madeChanges = true;
    } else {
      log('⏭️', `Keeping your existing ${state.eslintFile}.`);
      log('  ', 'To use this config, spread it in: import wilsoonConfig from \'@wilsoon/eslint-config/eslint\';');
    }
  } else {
    log('⏭️', `${state.eslintFile} already exists - leaving it alone.`);
  }
  console.log();

  // Prettier config
  if (!state.hasPrettier) {
    writePrettierConfig(projectRoot);
    log('✅', 'Created prettier.config.js');
    madeChanges = true;
  } else if (alreadyOurs(state.prettierFile, PRETTIER_CONFIG)) {
    log('✅', `${state.prettierFile} is already using the @wilsoon config.`);
  } else if (REWRITABLE.test(state.prettierFile)) {
    log('⚠️', `${state.prettierFile} already exists.`);
    if (yes(await ask(`Replace it with the @wilsoon config? (y/N) `))) {
      writePrettierConfig(projectRoot, state.prettierFile);
      log('✅', `Replaced ${state.prettierFile}`);
      madeChanges = true;
    } else {
      log('⏭️', `Keeping your existing ${state.prettierFile}.`);
    }
  } else {
    log('⏭️', `${state.prettierFile} already exists - leaving it alone.`);
    log('  ', 'Delete it and re-run this command to use the @wilsoon Prettier config.');
  }
  console.log();

  // package.json lint script
  if (!state.pkg) {
    log('⏭️', 'No package.json found - skipping the "lint" script.');
    console.log();
  } else if (!state.hasLintScript) {
    setLintScript(state.pkg);
    log('✅', `Added "lint" script to package.json: '${LINT_CMD}'`);
    madeChanges = true;
    console.log();
  } else if (!state.lintScriptMatches) {
    log('⚠️', `Existing lint script: '${state.lintScript}'`);
    log('  ', `This package needs:   '${LINT_CMD}'`);
    if (yes(await ask('Replace it? (y/N) '))) {
      setLintScript(state.pkg);
      log('✅', 'Updated lint script in package.json');
      madeChanges = true;
    } else {
      log('⏭️', 'Keeping existing lint script.');
      log('  ', 'You can still run \'npx eslint --fix . && npx prettier --write .\' to apply the rules.');
    }
    console.log();
  }

  if (madeChanges) {
    console.log('  🎉 All set! Run \x1b[1mnpm run lint\x1b[0m to lint and format your project.');
  } else {
    console.log('  ✨ Nothing to change - your project is already set up.');
  }
  console.log();
}

main().catch((err) => {
  console.error(`\n  ⚠️  @wilsoon/eslint-config setup had an issue: ${err.message}`);
  console.error('     You can set up manually - see the README for instructions.\n');
  process.exitCode = 1;
});
