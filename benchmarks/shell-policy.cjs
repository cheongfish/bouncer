'use strict';

// Commands the evaluator never lets an agent run: anything that publishes outside the sandbox or reads the
// benchmark credential. The ACP responder and the print-mode shell hook share this list.
const denied = [
  { pattern: /\b(?:git\s+push|gh\s+pr\s+create|gh\s+repo\s+create|npm\s+publish)\b/i, reason: 'external publish' },
  { pattern: /(?:\/run\/secrets\/|CURSOR_API_KEY|cursor-api-key)/i, reason: 'benchmark credential' },
];

function deniedShellReason(command) {
  return denied.find((rule) => rule.pattern.test(String(command ?? '')))?.reason ?? null;
}

module.exports = { deniedShellReason };
