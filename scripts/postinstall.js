#!/usr/bin/env node

// Non-interactive

import { LINT_CMD, getProjectRoot, inspectProject, isSelfInstall, log, setLintScript, writeEslintConfig, writePrettierConfig } from './setup-lib.js';

const projectRoot = getProjectRoot();

if (isSelfInstall(projectRoot)) process.exit(0);

const state = inspectProject(projectRoot);

const createdEslint = !state.hasEslint;
const createdPrettier = !state.hasPrettier;
const canAddLintScript = state.pkg && !state.hasLintScript;

// Nothing to do without touching something that already exists - exit quietly.
if (!createdEslint && !createdPrettier && !canAddLintScript) process.exit(0);

if (createdEslint) writeEslintConfig(projectRoot);
if (createdPrettier) writePrettierConfig(projectRoot);
if (canAddLintScript) setLintScript(state.pkg);

console.log();
console.log('  📦 @wilsoon/eslint-config');
if (createdEslint) log('✅', 'Created eslint.config.js');
if (createdPrettier) log('✅', 'Created prettier.config.js');
if (canAddLintScript) log('✅', `Added "lint" script to package.json: '${LINT_CMD}'`);
log('  ', 'Run \'npx @wilsoon/eslint-config\' to review your setup.');
console.log();
