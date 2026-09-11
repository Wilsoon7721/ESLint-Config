#!/usr/bin/env node

// Non-interactive

import { LINT_CMD, getProjectRoot, inspectProject, isSelfInstall, log, setLintScript, writeEslintConfig, writeDprintConfig } from "./setup-lib.js";

const projectRoot = getProjectRoot();

if (isSelfInstall(projectRoot)) process.exit(0);

const state = inspectProject(projectRoot);

const createdEslint = !state.hasEslint;
const createdDprint = !state.hasDprint;
const canAddLintScript = state.pkg && !state.hasLintScript;

// Nothing to do silently, exit
if (!createdEslint && !createdDprint && !canAddLintScript) process.exit(0);

const eslintFile = createdEslint ? writeEslintConfig(projectRoot) : null;
const dprintFile = createdDprint ? writeDprintConfig(projectRoot) : null;
if (canAddLintScript) setLintScript(state.pkg);

console.log();
console.log("  📦 @wilsoon/eslint-config");
if (createdEslint) log("✅", `Created ${eslintFile}`);
if (createdDprint) log("✅", `Created ${dprintFile}`);
if (canAddLintScript) log("✅", `Added "lint" script to package.json: '${LINT_CMD}'`);
log("  ", "Run 'npx @wilsoon/eslint-config' to review your setup.");
console.log();
