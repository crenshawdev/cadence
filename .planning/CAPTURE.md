# Capture

## Todos

- [ ] (backlog) `self-verify.mjs` tools-lint `tools:` parser handles only the inline comma-separated frontmatter form; a YAML block-sequence form (`tools:\n  - Read\n  - Bash`) or a CRLF-saved agent file would mis-parse and could false-positive as `undeclared-tool`. Latent only - all 7 current `agents/*.md` are inline + LF. Surfaced by the advisory diff review (finding 1, medium/low) during v1.1.0 Phase 3. Harden the parser if a future agent uses block-sequence declarations.

## Seeds

## Notes
