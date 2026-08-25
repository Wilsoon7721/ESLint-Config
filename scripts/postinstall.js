#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';

const projectRoot = process.env.INIT_CWD;
if (!projectRoot) process.exit(0);

const consumerPkgPath = resolve(projectRoot, 'package.json');
if (existsSync(consumerPkgPath)) {
  try {
    const consumerPkg = JSON.parse(readFileSync(consumerPkgPath, 'utf-8'));
    if (consumerPkg.name === '@wilsoon/eslint-config') process.exit(0);
  } catch { }
}

const LINT_CMD = 'eslint --fix . && prettier --write .';
const ESLINT_CONFIG = `import wilsoonConfig from '@wilsoon/eslint-config/eslint';

export default [
  ...wilsoonConfig,
  // Add your own rule overrides here - they take precedence.
];
`;

const PRETTIER_CONFIG = `export { default } from '@wilsoon/eslint-config/prettier';
`;

function log(icon, msg) {
  console.log(`  ${icon}  ${msg}`);
}

function ask(question) {
  if (!process.stdin.isTTY) return Promise.resolve('n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase());
    });
  });
}

const ESLINT_CONFIG_FILES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts'];
const PRETTIER_CONFIG_FILES = ['prettier.config.js', 'prettier.config.mjs', 'prettier.config.cjs', '.prettierrc', '.prettierrc.json', '.prettierrc.yml', '.prettierrc.yaml', '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', '.prettierrc.toml'];

async function main() {
  const hasEslint = ESLINT_CONFIG_FILES.some((f) => existsSync(resolve(projectRoot, f)));
  const hasPrettier = PRETTIER_CONFIG_FILES.some((f) => existsSync(resolve(projectRoot, f)));
  const hasPkg = existsSync(consumerPkgPath);

  let hasLintScript = false;
  let lintScriptMatches = false;

  if (hasPkg) {
    try {
      const pkg = JSON.parse(readFileSync(consumerPkgPath, 'utf-8'));
      hasLintScript = Boolean(pkg.scripts?.lint);
      lintScriptMatches = pkg.scripts?.lint === LINT_CMD;
    } catch { }
  }

  // Set up already, time to end
  if (hasEslint && hasPrettier && (lintScriptMatches || !hasPkg)) return;

  console.log();
  console.log('  ┌──────────────────────────────────────────────────────┐');
  console.log('  │  📦 @wilsoon/eslint-config - Automatic Setup        │');
  console.log('  └──────────────────────────────────────────────────────┘');
  console.log();
  console.log('  This package bundles custom ESLint rules and a Prettier');
  console.log('  config that auto-fix your code style. It sets up your');
  console.log('  project so you can directly run \'npm run lint\' to apply');
  console.log('  the rules.');
  console.log();

  let madeChanges = false;

  if (!hasEslint) {
    writeFileSync(resolve(projectRoot, 'eslint.config.js'), ESLINT_CONFIG);
    log('✅', 'Created eslint.config.js');
    log('  ', 'Take note: your own rule overrides in eslint.config.js will always take precedence.');
    console.log();
    madeChanges = true;
  } else {
    log('⏭️', 'ESLint config already exists - skipping.');
  }

  if (!hasPrettier) {
    writeFileSync(resolve(projectRoot, 'prettier.config.js'), PRETTIER_CONFIG);
    log('✅', 'Created prettier.config.js');
    console.log();
    madeChanges = true;
  } else {
    log('⏭️', 'Prettier config already exists - skipping.');
  }

  if (hasPkg && !lintScriptMatches) {
    const raw = readFileSync(consumerPkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    pkg.scripts = pkg.scripts || {};

    if (!hasLintScript) {
      // No lint script yet
      pkg.scripts.lint = LINT_CMD;
      const indent = raw.match(/^(\s+)"/m)?.[1] || '  ';
      writeFileSync(consumerPkgPath, JSON.stringify(pkg, null, indent) + '\n');
      log('✅', `Added "lint" script to package.json: '${LINT_CMD}'`);
      console.log();
      madeChanges = true;
    } else {
      console.log();
      log('⚠️', `Existing lint script: '${pkg.scripts.lint}'`);
      log('  ', `This package needs:   '${LINT_CMD}'`);
      console.log();

      const answer = await ask('Replace it? (y/N) ');

      if (answer === 'y' || answer === 'yes') {
        pkg.scripts.lint = LINT_CMD;
        const indent = raw.match(/^(\s+)"/m)?.[1] || '  ';
        writeFileSync(consumerPkgPath, JSON.stringify(pkg, null, indent) + '\n');
        log('✅', 'Updated lint script in package.json');
        madeChanges = true;
      } else {
        log('⏭️', 'Keeping existing lint script.');
        log('  ', 'You can still run \'npx eslint --fix . && npx prettier --write .\' to apply the rules.');
      }
      console.log();
    }
  }

  if (madeChanges) {
    console.log();
    console.log('  🎉 All set! Run \x1b[1mnpm run lint\x1b[0m to lint and format your project.');
    console.log();
  }
}

main().catch((err) => {
  console.error(`\n  ⚠️  @wilsoon/eslint-config setup had an issue: ${err.message}`);
  console.error('     You can set up manually - see the README for instructions.\n');
});
