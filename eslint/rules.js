const SHORT_THRESHOLD = 10;

export const rules = {
  "short-if-body": {
    meta: { type: "layout", fixable: "code", schema: [] },
    create(context) {
      const sourceCode = context.sourceCode;
      return {
        IfStatement(node) {
          const block = node.consequent;
          if (block.type !== "BlockStatement") return;
          if (block.body.length !== 1) return;

          const stmt = block.body[0];
          const stmtText = sourceCode.getText(stmt);
          const hadComments = sourceCode.getCommentsInside(block).length > 0;
          const isShort = stmtText.length < SHORT_THRESHOLD;
          const baseIndent = " ".repeat(node.loc.start.column);
          const replacement = isShort ? ` ${stmtText}` : `\n${baseIndent}  ${stmtText}`;
          context.report({
            node: block,
            message: hadComments ? "Single-statement if: drop braces, drop the blocking comment(s)." : "Single-statement if: drop braces.",
            fix(fixer) {
              const testEnd = node.test.range[1] + 1;
              return fixer.replaceTextRange([testEnd, block.range[1]], replacement);
            },
          });
        },
      };
    },
  },

  "concise-arrow-body": {
    meta: {
      type: "layout",
      fixable: "code",
      schema: [
        {
          type: "object",
          properties: {
            // Extra callee names to treat as return-sensitive, for higher-order
            // helpers this rule cannot know about.
            additionalReturnSensitive: { type: "array", items: { type: "string" } },
            // What to do when the return value IS observed:
            //   'skip'  leave the block body alone (default)
            //   'void'  still collapse it, preserving the undefined return
            sensitiveStrategy: { enum: ["skip", "void"] },
          },
          additionalProperties: false,
        },
      ],
    },
    create(context) {
      const sourceCode = context.sourceCode;
      const opts = context.options[0] || {};
      const strategy = opts.sensitiveStrategy ?? "skip";

      /**
       * Callees that read their callback's return value.
       *
       * Where it does not, the rewrite silently changes behaviour
       * In useEffect it becomes a hard React error, in useMemo it changes the memoised value, in map it changes the array.
       */
      const RETURN_SENSITIVE = new Set(["useEffect", "useLayoutEffect", "useInsertionEffect", "useMemo", "useCallback", "useImperativeHandle", "useState", "useReducer", "useSyncExternalStore", "map", "flatMap", "filter", "find", "findLast", "findIndex", "findLastIndex", "some", "every", "reduce", "reduceRight", "sort", "toSorted", "then", "catch", "finally", "from", "stringify", ...(opts.additionalReturnSensitive ?? [])]);

      const calleeName = (call) => {
        const c = call.callee;
        if (!c) return null;
        if (c.type === "Identifier") return c.name;
        if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier") return c.property.name;
        return null;
      };

      const isReturnSensitive = (node) => {
        const parent = node.parent;
        if (parent?.type !== "CallExpression") return false;
        if (!parent.arguments.includes(node)) return false;
        return RETURN_SENSITIVE.has(calleeName(parent));
      };

      const TIGHT = new Set(["CallExpression", "NewExpression", "MemberExpression", "Identifier", "Literal", "TemplateLiteral", "TaggedTemplateExpression", "ThisExpression", "AwaitExpression", "UnaryExpression", "UpdateExpression"]);

      return {
        ArrowFunctionExpression(node) {
          if (node.body.type !== "BlockStatement") return;
          const block = node.body;
          if (block.body.length !== 1) return;
          const stmt = block.body[0];

          let exprText;

          if (stmt.type === "ReturnStatement" && stmt.argument) {
            exprText = sourceCode.getText(stmt.argument);
            if (exprText.includes("\n")) return;
            if (stmt.argument.type === "ObjectExpression") exprText = `(${exprText})`;
          } else if (stmt.type === "ExpressionStatement") {
            const sensitive = isReturnSensitive(node);

            if (sensitive && (strategy === "skip" || node.async)) return;

            exprText = sourceCode.getText(stmt.expression);
            if (exprText.includes("\n")) return;
            if (stmt.expression.type === "ObjectExpression") exprText = `(${exprText})`;

            if (sensitive) exprText = TIGHT.has(stmt.expression.type) ? `void ${exprText}` : `void (${exprText})`;
          } else return;

          context.report({
            node: block,
            message: "Single-statement arrow body: use a concise body.",
            fix: (fixer) => fixer.replaceText(block, exprText),
          });
        },
      };
    },
  },

  "collapse-tagged-template": {
    meta: {
      type: "layout",
      fixable: "code",
      schema: [
        {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" } },
            maxLines: { type: "number" },
            maxWidth: { type: "number" },
          },
          additionalProperties: false,
        },
      ],
    },
    create(context) {
      const sourceCode = context.sourceCode;
      const opts = context.options[0] || {};
      const allowedTags = new Set(opts.tags || ["sql"]);
      const maxLines = opts.maxLines ?? 5;
      const maxWidth = opts.maxWidth ?? 250;

      return {
        TaggedTemplateExpression(node) {
          if (!allowedTags.has(sourceCode.getText(node.tag))) return;

          const quasi = node.quasi;
          const raw = sourceCode.getText(quasi);
          const lines = raw.slice(1, -1).split("\n");
          if (lines.length <= 1) return;
          if (lines.length > maxLines) return;

          const collapsed = lines
            .map((l) => l.trim())
            .filter(Boolean)
            .join(" ");
          const collapsedFull = "`" + collapsed + "`";
          const projectedWidth = quasi.loc.start.column + collapsedFull.length;
          if (projectedWidth > maxWidth) return;

          context.report({
            node: quasi,
            message: "Collapse short tagged template onto one line.",
            fix(fixer) {
              return fixer.replaceText(quasi, collapsedFull);
            },
          });
        },
      };
    },
  },
};
