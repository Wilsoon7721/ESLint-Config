const SHORT_THRESHOLD = 10;

export const rules = {
  // Historically only handled `if`; the name is kept so existing overrides and
  // disable comments keep working.
  "short-if-body": {
    meta: { type: "layout", fixable: "code", schema: [] },
    create(context) {
      const sourceCode = context.sourceCode;

      // Statements that own a block of their own. Inlining one of these leaves
      // `if (a) if (b) foo();`, and where the outer statement has an `else` it
      // silently rebinds that `else` to the inner `if`.
      const NESTED_BLOCK = new Set(["IfStatement", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "SwitchStatement", "TryStatement"]);

      // Indentation comes from the line the clause starts on, not the column of a
      // token: in `} else if (b) {` the inner `if` sits at column 9, and using
      // that would indent its body to match.
      const lineIndent = (nodeOrToken) => (sourceCode.lines[nodeOrToken.loc.start.line - 1] ?? "").match(/^[ 	]*/)[0];

      // `if (a) const x = 1;` is a SyntaxError - lexical declarations, classes
      // and function declarations all require a block.
      const needsBlock = (stmt) => stmt.type === "FunctionDeclaration" || stmt.type === "ClassDeclaration" || (stmt.type === "VariableDeclaration" && stmt.kind !== "var");

      // When a collapsed consequent is followed by `else`, the replacement has to
      // reach up to that keyword: the range otherwise stops at the closing brace
      // and leaves `doThing(); else` stranded on one line.
      function check(block, label, anchor, elseToken = null) {
        if (!block || block.type !== "BlockStatement") return;
        if (block.body.length !== 1) return;

        const stmt = block.body[0];
        if (NESTED_BLOCK.has(stmt.type)) return;
        if (needsBlock(stmt)) return;

        const stmtText = sourceCode.getText(stmt);
        const hadComments = sourceCode.getCommentsInside(block).length > 0;
        const isShort = stmtText.length < SHORT_THRESHOLD;
        const baseIndent = lineIndent(anchor);
        const replacement = isShort ? ` ${stmtText}` : `
${baseIndent}  ${stmtText}`;

        // Everything from the token before the block (`)`, `else`, `do`) to the
        // closing brace is replaced, so extra spacing does not shift the range.
        const before = sourceCode.getTokenBefore(block, { includeComments: true });
        const end = elseToken ? elseToken.range[0] : block.range[1];
        const separator = elseToken ? (isShort ? " " : `
${baseIndent}`) : "";

        context.report({
          node: block,
          message: hadComments ? `Single-statement ${label}: drop braces, drop the blocking comment(s).` : `Single-statement ${label}: drop braces.`,
          fix: (fixer) => fixer.replaceTextRange([before.range[1], end], replacement + separator)
        });
      }

      return {
        IfStatement(node) {
          check(node.consequent, "if", node, node.alternate ? sourceCode.getTokenAfter(node.consequent) : null);

          // `else if` parses as an IfStatement alternate, not a block, so it is
          // skipped here and handled when that inner statement is visited.
          if (node.alternate?.type === "BlockStatement") check(node.alternate, "else", node);
        },
        ForStatement: (node) => check(node.body, "for", node),
        ForInStatement: (node) => check(node.body, "for-in", node),
        ForOfStatement: (node) => check(node.body, "for-of", node),
        WhileStatement: (node) => check(node.body, "while", node),
        DoWhileStatement: (node) => check(node.body, "do-while", node)
      };
    }
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
