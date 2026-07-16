# Capture

## Todos

- [x] (phase 2) debug.md recall-gate cross-references are inverted: the Hypothesize gate at `cadence-core/workflows/debug.md:59` says `memory.backend` was "(read above)" but the read is documented below it in the Consult section (`debug.md:103`), and `debug.md:107` calls the Hypothesize gate "(below)" when it is above. Move the `config.mjs get memory.backend ...` read to method-loop entry (before Hypothesize) and correct both directional pointers. Surfaced by the advisory diff review (medium). Resolved: cebfa41 (during /cad-verify 2).

## Seeds

## Notes
