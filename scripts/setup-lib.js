import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

export const LINT_CMD = "wlint";
export const LEGACY_LINT_CMDS = ["eslint --fix . && prettier --write .", "eslint --fix . && prettier --write . ", "npx eslint --fix . && npx prettier --write ."];
export const ESLINT_CONFIG = `import wilsoonConfig from '@wilsoon/eslint-config/eslint';

export default [
  ...wilsoonConfig,
  // Add your own rule overrides here - they take precedence.
];
`;

export const PRETTIER_CONFIG = `export { default } from '@wilsoon/eslint-config/prettier';
`;

export const ESLINT_CONFIG_FILES = ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts", "eslint.config.mts", "eslint.config.cts"];

export const PRETTIER_CONFIG_FILES = ["prettier.config.js", "prettier.config.mjs", "prettier.config.cjs", ".prettierrc", ".prettierrc.json", ".prettierrc.yml", ".prettierrc.yaml", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.mjs", ".prettierrc.toml"];

export function getProjectRoot() {
  return process.env.INIT_CWD || process.cwd();
}

export function log(icon, msg) {
  console.log(`  ${icon}  ${msg}`);
}

export function readPkg(projectRoot) {
  const path = resolve(projectRoot, "package.json");
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    return { path, raw, json: JSON.parse(raw) };
  } catch {
    return null;
  }
}

export function writePkg(pkg) {
  const indent = pkg.raw.match(/^([ \t]+)"/m)?.[1] || "  ";
  const json = JSON.stringify(pkg.json, null, indent) + "\n";

  writeFileSync(pkg.path, pkg.raw.includes("\r\n") ? json.replace(/\n/g, "\r\n") : json);
}

export function isSelfInstall(projectRoot) {
  return readPkg(projectRoot)?.json?.name === "@wilsoon/eslint-config";
}

function findConfig(projectRoot, candidates) {
  return candidates.find((f) => existsSync(resolve(projectRoot, f))) || null;
}

export function inspectProject(projectRoot) {
  const pkg = readPkg(projectRoot);
  const lintScript = pkg?.json?.scripts?.lint;
  const eslintFile = findConfig(projectRoot, ESLINT_CONFIG_FILES);
  const prettierFile = findConfig(projectRoot, PRETTIER_CONFIG_FILES);

  return {
    pkg,
    eslintFile,
    prettierFile,
    hasEslint: Boolean(eslintFile),
    hasPrettier: Boolean(prettierFile),
    lintScript,
    hasLintScript: Boolean(lintScript),
    lintScriptMatches: lintScript === LINT_CMD,
    lintScriptIsLegacy: LEGACY_LINT_CMDS.includes(lintScript?.trim()),
  };
}

function configExtension(projectRoot) {
  return readPkg(projectRoot)?.json?.type === "module" ? "js" : "mjs";
}

export function writeEslintConfig(projectRoot, file = null) {
  const name = file || `eslint.config.${configExtension(projectRoot)}`;
  writeFileSync(resolve(projectRoot, name), ESLINT_CONFIG);
  return name;
}

export function writePrettierConfig(projectRoot, file = null) {
  const name = file || `prettier.config.${configExtension(projectRoot)}`;
  writeFileSync(resolve(projectRoot, name), PRETTIER_CONFIG);
  return name;
}

export function setLintScript(pkg) {
  pkg.json.scripts = pkg.json.scripts || {};
  pkg.json.scripts.lint = LINT_CMD;
  writePkg(pkg);
}
