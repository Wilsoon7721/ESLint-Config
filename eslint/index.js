import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import { rules as local } from "./rules.js";
import { FILES_GLOB } from "./files.js";

export default tseslint.config({
  files: [FILES_GLOB],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { "@stylistic": stylistic, local: { rules: local } },
  rules: {
    "local/short-if-body": "error",
    "local/concise-arrow-body": "error",
    "local/collapse-tagged-template": "error",
    "@stylistic/padding-line-between-statements": ["error", { blankLine: "always", prev: "if", next: "*" }],
  },
});
