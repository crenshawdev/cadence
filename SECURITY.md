# Security

## Reporting a vulnerability

Report it privately through GitHub: open the repository's Security tab and choose "Report a vulnerability", or go straight to https://github.com/crenshawdev/cadence/security/advisories/new. Please don't open a public issue for it. Say which version you ran (the `version` in `.claude-plugin/plugin.json`, or the commit), what you did, and what happened.

## What runs on every pull request and every push to main

The `test` workflow runs on every pull request and every push to main: the test suite, the prose-to-code drift check, the typecheck and plugin validation.
