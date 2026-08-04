# Phase 1 / PLAN-1 — `diff` trigger findings (ADJUDICATED)

Fired at plan-1 completion over `git diff d714d09..a249232`.
Gate: `adjudicated` (config wins over the critical level's `blocking`).
Reviewers: `cad-reviewer-xhigh` (opus), openai `gpt-5.6-terra`, gemini
`gemini-3.6-flash`, deepseek `deepseek-v4-flash`. Tier `balanced`, effort `high`
(cross-model only; the subagent ran its rung's `xhigh`).

**Status: adjudicated 2026-08-01** against the code at `a249232` (unchanged
since; `52f995a` touches only `.claude-plugin/plugin.json`). Every finding was
run as its own repro, not read for plausibility. Suites green at adjudication
time: `node --test cadence-core/bin/config.test.mjs
cadence-core/bin/route.test.mjs` → 138 pass, 0 fail. The raw returns below are
kept verbatim; the rulings are in the adjudication section that follows them.

## Adjudication

**8 survive, 1 refuted, 1 converged.** None of the survivors is covered by
PLAN-2, which touches `config-seams.test.mjs` alone.

| # | Ruling | Sev (was) | What the repro showed |
|---|---|---|---|
| CS#1 + OA#3 | **survives** | high | Confirmed. Global layer `{"athu":true,"auth":"yes"}`: `get` emits the move-it remediation twice; `route.mjs resolve` on the same input says "names no declared risk surface" and "is not true or false". Two read faces, contradictory diagnostics, and `get`'s remediation names a write `set` refuses. OA#3 is the same defect from the other model — one fix. |
| CS#2 | **survives** | medium | Confirmed, and it is a divergence from PLAN-1's own D-02 amendment (`PLAN-1.md:116-127`), which required `source` to name `'global'` for "the `--global` path AND the aliased-env path" and required `globalScopeWarnings` to key off that identity. Shipped code keys off the `asGlobal` caller flag (`config-merge.mjs:172`, `config.mjs:296`), so `get --file <G>` with `CADENCE_GLOBAL_CONFIG=<G>` reports `source:"repo"` and no `warnings`, while `get --global` on the identical file reports `source:"global"` plus the warning. |
| CS#3 | **survives** | medium | Confirmed. `get --file "" stakes` → `ok:true`, `source:"global"` — a full effective read of the user-global layer alone. The guard at `config.mjs:350` tests `undefined` only. |
| CS#4 | **survives** | low | Confirmed. `route.mjs resolve --role cad-executor --file` → `{"ok":false,"reason":"internal","detail":"The \"path\" argument must be of type string. Received undefined"}`. `parseArgs` does `o.file = a[++i]` unguarded; the CS#3 fix landed in `config.mjs` only. |
| OA#1 | **survives** | low (was high) | Confirmed but overstated. A hard link between the two layer paths reports `source:"global+repo"` and diagnoses the one file twice. `realpathSync` cannot see it. Downgraded: a hard-linked config is rare, and the consequence is duplicated provenance, not a leaked waiver — `route.mjs` reads `risk.override.*` from `layers.repo` alone. |
| OA#2 | **survives** | medium (was high) | Confirmed and the more serious half. `set --file .planning/hard.json risk.override.auth=true`, with the global env pointed at the hard link's twin, **succeeded** — a repo-scoped waiver written through the physical user-global file, past a guard whose whole promise is that it cannot be. Downgraded from high only because the machine-wide waiver does not follow: every other repo reads its own repo layer. One shared identity helper (dev+ino via `statSync`, `realpath` fallback) fixes OA#1 and OA#2 together. |
| CS#5 | **survives** | low | Confirmed. All eight `risk.override.*` purposes in `config.schema.json` and all eight rows in `references/config-reach.md:108-115` end "a waiver written to the user-global layer is ignored and named in the resolver's warnings" — unconditionally. The collapse makes that false for an aliased file, which the repo's own `route.test.mjs:963` row asserts ("waiver honoured, nothing IGNORED"). Doc fix: qualify the clause in 16 places. |
| CS#6 | **survives** | low | Confirmed. With `CADENCE_GLOBAL_CONFIG` aliased at the repo config, `set --file <that file> risk.override.auth=true` is refused with "set it with `--file <repo config>` instead" — which is exactly what was passed. Same root as CS#2: identity on one face, caller flag on the other. Folds into that fix. |
| DS#1 | **REFUTED** | blocker | False positive, as the reviewer's own note anticipated. `route.mjs:311` sets `riskOverrides: riskOverridesIn(layers.repo)` and `riskFloor` (`:252`) iterates that map alone — the merged config is never consulted for waivers. `route.test.mjs:882` pins it: a global-layer-only waiver leaves `stakes === 'critical'`, floor standing. |

**Correction to a cited remedy.** CS#1 says "`route.mjs` already exports
`overrideShapeWarning`". It does not — `route.mjs:117` declares it module-local
and `route.mjs` has no `export` at all. The fix has to move it to a shared lib
(`bin/lib/`) or add the export; it cannot just be imported as written.

**Survivor grouping for execution** (three coherent edits, not eight):
1. Shape-aware global warning — CS#1/OA#3. Shared `overrideShapeWarning`, and
   the move-it remediation gated on a declared surface with a strict `true`.
2. Filesystem identity, both faces — CS#2, CS#6, OA#1, OA#2, plus the `source`
   label the D-02 amendment specified. One helper, both read and write faces.
3. Argument guards and docs — CS#3, CS#4, CS#5.

Do NOT re-fire the review — the sections below are the raw returns.

## claude-subagent (cad-reviewer-xhigh)

1. **high** — `cadence-core/bin/config.mjs:300` — `globalScopeWarnings` warns on
   any truthy `risk.override.*` in the global layer with the fixed remediation
   "write it to this repo's own .planning/config.json for it to waive anything",
   so `get` hands out exactly the remediation the write face rejects (the
   CAPTURE:166 defect task 4 removed from `route.mjs`), and the two read faces
   emit contradictory diagnostics for the same input.
   *Repro:* global layer `{"risk":{"override":{"athu":true,"auth":"yes"}}}`.
   `get` emits two "write it to this repo's own config" warnings; the write face
   refuses both (`"athu" is not a risk surface`, `expected true or false`), while
   `route.mjs resolve` says "names no declared risk surface / is not true or
   false". `route.mjs` already exports `overrideShapeWarning`; `config.mjs` does
   not call it.

2. **medium** — `cadence-core/bin/config.mjs:296` — `globalScopeWarnings` picks
   the layer slot from the caller flag `asGlobal` rather than filesystem
   identity, so every non-`--global` spelling of the user-global file collapses
   into `layers.repo`, reports `source:"repo"`, and emits no repo-scoped warning.
   PLAN-1's D-02 amendment required the opposite.
   *Repro:* with `CADENCE_GLOBAL_CONFIG=<G>` holding `risk.override.auth:true`,
   `get --file <G> risk.override.auth` → `source:"repo"`, no `warnings` key;
   `get --file <repo cfg> …` → `source:"global+repo"` plus the warning.

3. **medium** — `cadence-core/bin/config.mjs:350` — the valueless-`--file` guard
   tests `tokens[i+1] === undefined` only, so it closes `--file $VAR` but misses
   `--file "$VAR"` (empty string).
   *Repro:* `get --file "" stakes risk.override.auth` → `ok:true`, full effective
   read of the user-global layer alone, `source:"global"`.

4. **low** — `cadence-core/bin/route.mjs:480` — the valueless-`--file` fix landed
   in `config.mjs`'s `optFile` only; `route.mjs`'s `parseArgs` still does
   `o.file = a[++i]` unguarded.
   *Repro:* `route.mjs resolve --role cad-executor --file` → `reason:"internal"`,
   `The "path" argument must be of type string. Received undefined` (from
   `dirname(opts.file)` at `route.mjs:224`).

5. **low** — `cadence-core/config.schema.json:19` — all eight `risk.override.*`
   purposes (and `references/config-reach.md:108-115`) now assert
   unconditionally that a global-layer waiver "is ignored and named in the
   resolver's warnings", which the collapse added by this same diff makes false
   when the two layer paths resolve to one file.
   *Repro:* `CADENCE_GLOBAL_CONFIG` → the repo config holding
   `risk.override.auth:true`; `route.mjs resolve` on an auth phase returns the
   waived stakes with no warning (the diff's own route.test.mjs row asserts this).

6. **low** — `cadence-core/bin/lib/config-merge.mjs:174` — the collapse makes the
   read face classify an aliased file as the REPO layer while the v2.0.0 write
   face still classifies the identical path as user-global, so the write face
   refuses with an unfollowable remediation.
   *Repro:* `CADENCE_GLOBAL_CONFIG=<R>` (R = repo config);
   `set --file <R> risk.override.auth=true` → refused with "set it with
   `--file <repo config>` instead", which is what was passed.

## openai (gpt-5.6-terra)

1. **high** — `cadence-core/bin/lib/config-merge.mjs:124` — `layerIdentity` uses
   `realpathSync`, which canonicalizes symlinks but does not identify hard links,
   so two hard-linked names read the same inode twice and provenance stays
   `global+repo`.

2. **high** — `cadence-core/bin/config.mjs:238` — the write-face global-target
   guard has the same hard-link bypass, so `set --file repo.json` (hard-linked to
   the global config) writes a repo-scoped waiver through the user-global file.

3. **medium** — `cadence-core/bin/config.mjs:302` — `globalScopeWarnings` treats
   every truthy override as a waiver though `route` accepts only strict `true`,
   producing a misleading remediation for `"yes"` or an unknown surface.
   (Converges with claude-subagent #1.)

## gemini (gemini-3.6-flash)

No findings.

## deepseek (deepseek-v4-flash)

1. **blocker** — `cadence-core/bin/route.mjs:140` — claims `readConfig` warns a
   global-layer `risk.override.auth` is ignored while `riskFloor` still honours
   it from the merged config.
   *Note for adjudication:* likely a false positive — `route.mjs` reads
   `risk.override.*` from the repo layer alone by design; verify against
   `route.mjs:124` before accepting.
