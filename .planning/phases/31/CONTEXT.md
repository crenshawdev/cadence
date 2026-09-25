# Phase 31: The read layer

## Scope boundary

Three calls on the binary's tool surface, search, read and document, so that the model and every worker read the project through the binary and never open a file. search and read are ported from the excerpt crate as the template and cut to Cadence; document is Cadence's own and reads process records by identity. The cycle's purpose truth is authored here and inherited by every later phase. Design: docs/architecture/read-layer.md, on docs/architecture/boundary-fix.md.

## Durable decisions

- D-145. The read layer is three calls: search, read and document. read and document stay separate calls; read serves the tree at a location, document serves a process record by identity.
- D-146. Excerpt is the template, not the product: its behaviour is cut to what Cadence needs, never fitted in as is.
- D-147. The model never originates a location. It reads only at a location the binary handed back first: a search hit, a refusal, a lease, an outline row. A path the model invents is refused.
- D-148. Process records are reached by identity, never by path. The binary decides where CONTEXT.md, PLAN.md and the roadmap live and renders the slice for the identity asked.
- D-149. One surface for every caller. The main thread, a Claude worker and a Codex worker reach the same three calls over the one MCP server; there is no second way to read.
- D-151. The cycle's purpose is a truth from this phase on: the model never opens a project document whole, and every phase closes with a token number against the 3.7 baseline. Every later phase inherits it.

## Decisions

- D-150. The outline threshold of 24KB and the unit grammars for Rust, JavaScript, Markdown, JSON and C are kept from excerpt unchanged; they were measured on this tree already.

## Truths

- T1. When the model searches a pattern in a scope, the model gets one unit per hit with its location.
- T2. When the model reads at a location the binary handed back, the model gets exactly that slice, with where to continue when it was cut.
- T3. When the model reads at a location the binary never handed back, the model is refused with the rule named.
- T4. When the model asks for a process record by identity, the model gets the slice the binary renders for it and never a path.
- T5. When a file too big to serve whole is read, the model gets an outline of its units with their line ranges.
- T6. When a worker calls the read layer from its own host, the worker gets the same answer the main thread gets.
- T7. When phase 31 closes, the owner sees the planner round's read count, its whole-file reads at zero, and its token total against the 3.7 median.

## Flagged assumptions

