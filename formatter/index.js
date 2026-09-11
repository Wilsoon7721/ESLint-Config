/**
 * dprint TypeScript/JavaScript formatting rules.
 *
 * Writes into dprint.json as dprint does not read JS modules.
 *
 * @see https://dprint.dev/plugins/typescript/config/
 */
export default {
  lineWidth: 250,
  indentWidth: 2,
  useTabs: false,
  quoteStyle: "preferSingle",
  semiColons: "always",
  trailingCommas: "never",
  "arrowFunction.useParentheses": "force",
  "jsx.bracketPosition": "sameLine",
  "memberExpression.linePerExpression": false,
};
