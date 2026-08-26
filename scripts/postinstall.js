#!/usr/bin/env node

// Non-interactive

import { LINT_CMD, getProjectRoot, inspectProject, isSelfInstall, log, setLintScript, writeEslintConfig, writePrettierConfig } from "./setup-lib.js";

const projectRoot = getProjectRoot();

if (isSelfInstall(projectRoot)) process.exit(0);

const state = inspectProject(projectRoot);

const createdEslint = !state.hasEslint;
const createdPrettier = !state.hasPrettier;
const canAddLintScript = state.pkg && !state.hasLintScript;

// Nothing to do silently, exit
if (!createdEslint && !createdPrettier && !canAddLintScript) process.exit(0);

const eslintFile = createdEslint ? writeEslintConfig(projectRoot) : null;
const prettierFile = createdPrettier ? writePrettierConfig(projectRoot) : null;
if (canAddLintScript) setLintScript(state.pkg);

console.log();
console.log("  📦 @wilsoon/eslint-config");
if (createdEslint) log("✅", `Created ${eslintFile}`);
if (createdPrettier) log("✅", `Created ${prettierFile}`);
if (canAddLintScript) log("✅", `Added "lint" script to package.json: '${LINT_CMD}'`);
log("  ", "Run 'npx @wilsoon/eslint-config' to review your setup.");
console.log();
