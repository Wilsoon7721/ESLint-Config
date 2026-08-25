const SHORT_THRESHOLD = 10;

export const rules = {
  'short-if-body': {
    meta: { type: 'layout', fixable: 'code', schema: [] },
    create(context) {
      const sourceCode = context.sourceCode;
      return {
        IfStatement(node) {
          const block = node.consequent;
          if (block.type !== 'BlockStatement') return;
          if (block.body.length !== 1) return;

          const stmt = block.body[0];
          const stmtText = sourceCode.getText(stmt);
          const hadComments = sourceCode.getCommentsInside(block).length > 0;
          const isShort = stmtText.length < SHORT_THRESHOLD;
          const baseIndent = ' '.repeat(node.loc.start.column);
          const replacement = isShort ? ` ${stmtText}` : `\n${baseIndent}  ${stmtText}`;
          context.report({
            node: block,
            message: hadComments ? 'Single-statement if: drop braces, drop the blocking comment(s).' : 'Single-statement if: drop braces.',
            fix(fixer) {
              const testEnd = node.test.range[1] + 1;
              return fixer.replaceTextRange([testEnd, block.range[1]], replacement);
            },
          });
        },
      };
    },
  },

  'concise-arrow-body': {
    meta: { type: 'layout', fixable: 'code', schema: [] },
    create(context) {
      const sourceCode = context.sourceCode;
      return {
        ArrowFunctionExpression(node) {
          if (node.body.type !== 'BlockStatement') return;
          const block = node.body;
          if (block.body.length !== 1) return;
          const stmt = block.body[0];

          let exprNode;
          if (stmt.type === 'ExpressionStatement') exprNode = stmt.expression;
          else if (stmt.type === 'ReturnStatement' && stmt.argument) exprNode = stmt.argument;
          else return;

          let exprText = sourceCode.getText(exprNode);
          if (exprText.includes('\n')) return;

          if (exprNode.type === 'ObjectExpression') exprText = `(${exprText})`;

          context.report({
            node: block,
            message: 'Single-statement arrow body: use a concise body.',
            fix(fixer) {
              return fixer.replaceText(block, exprText);
            },
          });
        },
      };
    },
  },

  'collapse-tagged-template': {
    meta: {
      type: 'layout',
      fixable: 'code',
      schema: [
        {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' } },
            maxLines: { type: 'number' },
            maxWidth: { type: 'number' },
          },
          additionalProperties: false,
        },
      ],
    },
    create(context) {
      const sourceCode = context.sourceCode;
      const opts = context.options[0] || {};
      const allowedTags = new Set(opts.tags || ['sql']);
      const maxLines = opts.maxLines ?? 5;
      const maxWidth = opts.maxWidth ?? 250;

      return {
        TaggedTemplateExpression(node) {
          if (!allowedTags.has(sourceCode.getText(node.tag))) return;

          const quasi = node.quasi;
          const raw = sourceCode.getText(quasi);
          const lines = raw.slice(1, -1).split('\n');
          if (lines.length <= 1) return;
          if (lines.length > maxLines) return;

          const collapsed = lines.map((l) => l.trim()).filter(Boolean).join(' ');
          const collapsedFull = '`' + collapsed + '`';
          const projectedWidth = quasi.loc.start.column + collapsedFull.length;
          if (projectedWidth > maxWidth) return;

          context.report({
            node: quasi,
            message: 'Collapse short tagged template onto one line.',
            fix(fixer) {
              return fixer.replaceText(quasi, collapsedFull);
            },
          });
        },
      };
    },
  },
};
