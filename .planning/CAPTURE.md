# Capture

## Todos

- [x] (phase 2) debug.md recall-gate cross-references are inverted: the Hypothesize gate at `cadence-core/workflows/debug.md:59` says `memory.backend` was "(read above)" but the read is documented below it in the Consult section (`debug.md:103`), and `debug.md:107` calls the Hypothesize gate "(below)" when it is above. Move the `config.mjs get memory.backend ...` read to method-loop entry (before Hypothesize) and correct both directional pointers. Surfaced by the advisory diff review (medium). Resolved: cebfa41 (during /cad-verify 2).
- [ ] (phase 3) `self-verify.mjs` tools-lint `tools:` parser handles only the inline comma-separated frontmatter form; a YAML block-sequence form (`tools:\n  - Read\n  - Bash`) or a CRLF-saved agent file would mis-parse and could false-positive as `undeclared-tool`. Latent only - all 7 current `agents/*.md` are inline + LF. Surfaced by the advisory diff review (finding 1, medium/low). Harden the parser if a future agent uses block-sequence declarations.

## Seeds

## Notes
