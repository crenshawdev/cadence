# Phase 2: Findings are a list, not a work order - Context

Gathered: 2026-07-30
Feeds: /cad-plan 2

## Scope boundary

In: TRI-02 and REV-03 in full - an explicit triage gate after adjudication that
presents survivors as a numbered list and defaults to NONE, authored once and
reaching every adjudicated firing site; the reviewer contract's padding clause
deleted while its severity-inflation half stays; `references/review-triggers.md`
step 4 rewritten batch-shaped with step 3 resolving the route once for the set;
a self-verify check that fails a multi-dispatch instruction missing the
one-message phrasing; and a `review.*` prompt-token cap that refuses an over-cap
payload on both `review` and `consult`.

Out: every other v2.1.0 requirement (TOK-02, REL-03, CFG-02, DOC-01, RNG-02,
HST-02) - later phases of this cycle. #88's AC4 (fire() returning a resolved
dispatch manifest instead of a list the coordinator walks): explicitly a design
call in the issue itself, with no stated defect behind it. Any change to
`review.mode`, `review.triggers.*.gate` or the reviewer-set config - the tuning
that already belongs to the user is untouched by this phase (#66's own
argument).

Deferred: #88's closing "also worth deciding" - that `fire()` spends the same on
an advisory gate as on a blocking one, with nothing telling the coordinator to
weigh cost against a gate that cannot halt anything. Left because it is a new
cost heuristic rather than a correction, and it would grow the review subsystem
in the cycle TRI-02 is simplifying it. The `claude-subagent` arm's own payload
stays unbounded, pending whether the host already caps a single subagent prompt
(flagged below).

Plan shape: one plan. The seam work (`review-provider.mjs`, `self-verify.mjs`)
and the prose work (five gate surfaces, the contract subtraction, the
review-triggers rewrite) touch mostly disjoint files, but both terminate at
`self-verify.mjs` and `weight-budgets.json`, so the split is a dependency
rather than a parallel - the same reasoning phase 1 recorded.

## Durable decisions

- D-01 (gate authorship): The triage gate is authored ONCE as the `adjudicated`
  consequence in `cadence-core/references/review-triggers.md`, replacing the
  "hands the survivor list back to the firing workflow to act on" text; the
  firing sites point at it rather than each restating it. The site list is FOUR,
  not the three TRI-02 names: `phase_diff` is `adjudicated` at critical
  (`review-triggers.md:156`) and this repo's own `.planning/config.json` sets
  `review.triggers.diff.gate: "adjudicated"`, making `/cad-execute` a live
  adjudicated site today. Rejected: restating the gate in full at each site
  (three near-duplicate paragraphs drift the way `workflows/verify.md:84-86`
  drifted from the legacy rule in phase 1). Evidence:
  `references/review-triggers.md:1-6`, `:130-142`, `:156`;
  `references/conventions.md:83-86`; `.planning/config.json`;
  `.planning/phases/1/CONTEXT.md` D-13.
- D-02 (ask shape): The gate is an OPEN-ENDED ask - numbered survivor list, the
  question ends the turn - not `AskUserQuestion`. The ask-user seam binds
  structured choice to 2-4 mutually exclusive options, while a survivor set is
  N items answered with a subset; the originating incident had five survivors.
  Rejected: fixed options (none / all / let me name them) with an open
  follow-up, and one `AskUserQuestion` per finding. Evidence:
  `references/seams.md:12-15`; `.planning/CAPTURE.md:11` (v1.4.0 close);
  `skills/cad-plan-review/SKILL.md:49-53`.
- D-03 (NONE is defaulted, deliberately): NONE is the labelled first option, and
  the triage gate is NOT added to `seams.md`'s "deliberate no-default decisions"
  list. TRI-02 states the default explicitly, so a nudge here is the
  requirement rather than a bug. Consequence to hold: `/cad-land` will run a
  defaulted triage ask immediately before the deliberately undefaulted publish
  ask, and the two must read as different kinds of question. Rejected: putting
  the gate on the no-default list and expressing NONE as "no finding is acted on
  unless named". Evidence: `references/seams.md:17-35`;
  `.planning/REQUIREMENTS.md:27`.
- D-04 (the unattended arm): Under `git.auto_close: true` the triage gate does
  not prompt - the unattended close's triage is NONE by construction, with
  `land-cleanup.mjs gate`'s existing blocker/high halt as its only consequence.
  Without this carve-out the one documented unattended close blocks forever on a
  prompt, breaking the GIT-03 capability shipped in v1.1.0-rc.2. Rejected:
  firing the gate regardless and letting `auto_close` fail loudly. Evidence:
  `skills/cad-land/SKILL.md:56-57`, `:72-74`, `:124-133`;
  `cadence-core/bin/lib/close-decision.mjs:84-95`.
- D-05 (what the subtraction removes): ONLY the padding half of
  `skills/cad-reviewer-contract/SKILL.md:67` is deleted; "No severity inflation"
  STAYS. #66 is explicit that severity accuracy is load-bearing - the blocking
  gate keys off the blocker/high threshold, so a reviewer that inflates severity
  can hard-stop a phase on a nit - and that the kept half must be called out in
  the diff review as deliberate. `skills/cad-plan-checker-contract`'s sibling
  clause is inspected and left byte-unchanged: it defines a severity floor
  rather than instructing suppression, and #66 lists it only so the pass covers
  both files. Rejected: deleting the whole line (the analyzer's reading; loses
  the anti-inflation guardrail #66 names as what must not be lost) and replacing
  it with a positive "report everything" instruction. Evidence: issue #66 ("What
  must not be lost", "the divergence is deliberate rather than accidental");
  `skills/cad-reviewer-contract/SKILL.md:25`, `:67`; `METHOD.md:327`.
- D-06 (the mechanical guard on phrasing): self-verify gains a check over
  `cadence-core/workflows/*.md` and `cadence-core/references/*.md` that FAILS
  when a multi-dispatch instruction lacks the mandated one-message phrasing.
  This is #88's own AC3 and it goes beyond the roadmap's SC3, which asks only
  for the prose fix; without it SC3 is UAT-walk-only and the loop-shaped
  restatement can return on the next edit. Same species as v2.0.0's
  `agent-behaviour` and `rung-effort` checks. Accepted cost: a heuristic over
  prose, which can false-positive. Rejected: prose-only. Evidence: issue #88
  AC3; `cadence-core/bin/self-verify.mjs:778` (the enumerated check list);
  `cadence-core/bin/lib/surface-weight.mjs:8-13` (`references/` is outside the
  weighed walk, so no existing check reaches it).
- D-07 (what the cap bounds): The prompt-token cap bounds BOTH `cmdReview` and
  `cmdConsult` - the two paid cross-model commands in `review-provider.mjs` -
  and the free `claude-subagent` arm is exempt, with that exemption stated
  rather than left implied. REV-03's "per-reviewer" reads as `review` alone, but
  `consult` is the same script hitting the same paid provider, and bounding one
  leaves the identical defect one function away for the next sweep to refile.
  Rejected: `review` only; bounding the subagent arm too (costs no money and
  shrinks the one reviewer with repo access). Evidence:
  `cadence-core/bin/review-provider.mjs:501-515`, `:517-537`;
  `references/seams.md:223-225`; issue #16.
- D-08 (cap units): The cap is denominated in ESTIMATED tokens using the repo's
  existing deterministic `chars/4` proxy, reusing `lib/surface-weight.mjs`'s
  `measure()`. Zero runtime deps forbids a real tokenizer, and #16 and REV-03
  both say "token cap", so a bytes key would need the requirement reworded.
  Accepted cost: the user cannot reconcile the number against a provider's own
  count. Rejected: bytes (`review.max_prompt_bytes`), exactly reproducible but
  renames what the requirement asked for; a per-provider tokenizer dependency.
  Evidence: `cadence-core/bin/lib/surface-weight.mjs:88-93` ("deliberately NOT a
  real tokenizer - a deterministic estimate"); `.planning/PROJECT.md`
  zero-runtime-deps constraint.
- D-09 (over-cap is a refusal): An over-cap payload is a structured refusal
  BEFORE any request - `{ok:false, reason, detail}` with no HTTPS call issued -
  not truncate-and-send and not warn-and-send. Truncate-and-send still pays the
  provider and returns findings on a fragment while reporting as though it saw
  the whole artifact, which is worse than the unbounded bill; warn-and-send
  changes no outcome at all, the exact additive shape phase 1's D-02 rejected
  when it reversed additive `unseeded`. The refusal needs no new caller
  machinery: `review-triggers.md:108-115` already defines handling for any
  `ok:false` (name the reason, drop the reviewer, fall back to
  `claude-subagent` if the set empties). Rejected: truncate with an injected
  notice (the GSD original); auto-falling back inside the seam. Evidence:
  `.planning/phases/1/CONTEXT.md` D-02;
  `cadence-core/bin/review-provider.mjs:24-27`, `:64-65`;
  `references/review-triggers.md:108-115`.

## Decisions

- D-10 (pointer is not enough at two sites): `/cad-plan` and `/cad-verify` must
  carry the gate text or an explicit re-read, because neither `@`-preloads
  `references/review-triggers.md` the way `/cad-land` and `/cad-plan-review` do.
  A pointer alone there leaves the gate out of context and preserves the current
  behaviour, which is precisely AC1's failure. Evidence:
  `skills/cad-land/SKILL.md:19-22`, `skills/cad-plan-review/SKILL.md:27-29`
  (both carry the preload); `skills/cad-plan/SKILL.md:26`,
  `skills/cad-verify/SKILL.md:28-29`, `skills/cad-execute/SKILL.md:25` (none do).
- D-11 (which ask in /cad-verify is the gate): The gated site is the fix LIST
  that `fire()` returns, not the existing per-item apply / re-plan / leave ask
  at `route_failures`, which already triages a UAT item. Getting this wrong
  edits an ask that is already correct and leaves the fire()-produced fix list
  flowing straight into "Apply now - make the change as an atomic conventional
  commit". Evidence: `references/review-triggers.md:144`;
  `cadence-core/workflows/verify.md:175-198`.
- D-12 (neighbouring filters stay): `<what_to_look_for>`'s "approach differences
  are NOT findings" and `<stance>`'s own lines are out of scope. TRI-02 and #66
  name only the anti-padding clause, and `METHOD.md:324-326` documents the
  approach-differences rule as deliberate ("This kills the most common way code
  review degrades into taste"). Evidence: `.planning/REQUIREMENTS.md:27`;
  `skills/cad-reviewer-contract/SKILL.md:24-25`, `:37-38`; `METHOD.md:324-326`.
- D-13 (no rung file changes): The clause is single-sourced through the
  preloaded contract skill, so deleting it in the skill deletes it in all four
  rungs; a rung file carrying behaviour already fails self-verify check 7.
  Evidence: `agents/cad-reviewer.md`, `-medium`, `-xhigh`, `-max` (each carries
  only `skills: - cad-reviewer-contract` plus a rung line);
  `cadence-core/bin/self-verify.mjs:467-487`; `cadence-core/bin/lib/rung-agent.mjs`.
- D-14 (public docs move with the change): `METHOD.md:314-340` and
  `README.md:25` describe adjudication ending at "the main model grounds and
  owns the verdict", with no triage gate; both are in scope. Project memory
  records README updates as an execution task per user-facing phase, because
  `/cad-docs-verify` catches drift, not omissions. Evidence: `METHOD.md:314-340`;
  `README.md:25`; `.planning/phases/1/CONTEXT.md` D-13.
- D-15 (the prose rewrite moves two files): `references/review-triggers.md:68`
  is rewritten into an imperative batch instruction citing `seams.md` Concurrent
  dispatch, with the "where the host allows" hedge gone; and
  `workflows/decision-review.md:69-70`, which quotes the old phrase verbatim,
  moves in the SAME change. Otherwise `decision-review.md` cites a sentence that
  no longer exists in the file it names - drift no self-verify check detects
  (it checks config tokens, invocations and paths, not quoted prose). Evidence:
  `references/review-triggers.md:68`; `cadence-core/workflows/decision-review.md:66-70`;
  `references/seams.md:163-169`; `cadence-core/workflows/execute.md:190-193`.
- D-16 (route resolved once): `fire()` step 3 resolves the route ONCE for the
  whole reviewer set rather than per reviewer - #88's AC2, a one-line fix in the
  step already being rewritten. `seams.md:122` already requires it and step 4
  does not say it. #88's AC4 (fire() handing back a resolved dispatch manifest)
  is explicitly a design call in the issue and stays out. Evidence: issue #88
  AC2/AC4; `references/seams.md:122`.
- D-17 (how the key is read): The cap key is read the way
  `review.request_timeout_ms` is - a lazy memoized `mergeLayers` read inside the
  script with a pure exported resolver - and takes NO new CLI flag, so
  `CONTRACTS['review-provider.mjs']` in `self-verify.mjs` is unchanged and phase
  1's D-14 obligation does not fire. Evidence:
  `cadence-core/bin/review-provider.mjs:162-197`;
  `cadence-core/bin/review-provider.test.mjs:52-95`;
  `cadence-core/bin/self-verify.mjs:124-129`.
- D-18 (four surfaces or CI goes red): Adding the key requires
  `config.schema.json`, a reach row in `references/config-reach.md`, a catalog
  row in `workflows/config.md`, and at least one prose mention - and the key's
  non-`universal` reach must appear VERBATIM in its own `purpose` string or
  `config-reach` reports `unstated-reach`. The `review.request_timeout_ms` rows
  are the four-surface precedent. Evidence:
  `cadence-core/bin/self-verify.mjs:39-44`, `:430-434`;
  `cadence-core/bin/lib/config-reach.mjs:118-142`;
  `cadence-core/references/config-reach.md:124`, `:135-136`;
  `cadence-core/workflows/config.md:113`.
- D-19 (the template is not a fifth surface): `cadence-core/templates/config.json`
  does NOT need the new key - it carries no `request_timeout_ms` either, and
  nothing in `self-verify.mjs` cross-checks the template against the schema.
  Evidence: `cadence-core/templates/config.json`.
- D-20 (budgets are regenerated, not fitted): `cadence-core/bin/weight-budgets.json`
  is regenerated in this phase; AC7's "no budget overrun" is met by accepting the
  growth. Measured at HEAD, every candidate surface sits at exactly its budget
  with zero headroom: `skills/cad-land/SKILL.md` 7898/7898,
  `skills/cad-plan-review/SKILL.md` 2484/2484,
  `skills/cad-reviewer-contract/SKILL.md` 3296/3296,
  `workflows/verify.md` 12106/12106, `workflows/plan.md` 14328/14328,
  `workflows/decision-review.md` 9741/9741, `workflows/config.md` 17878/17878.
  Under-budget is fine, so the contract shrink needs no action. Evidence: those
  measurements; `weight-budgets.json` `_comment`;
  `cadence-core/bin/self-verify.mjs:452-461`; phase 1's `380c4c6` (budgets
  changed in the same commit as the prose).
- D-21 (an unbudgeted surface is not a free one): `references/review-triggers.md`
  is outside the weighed walk, but it is `@`-preloaded into `/cad-land` and
  `/cad-plan-review` on every invocation, so gate text written at reference-doc
  length silently costs both skills that many bytes per run with no check to
  catch it. Currently 11982 bytes. Evidence:
  `cadence-core/bin/lib/surface-weight.mjs:8-13`, `:53-80`;
  `skills/cad-land/SKILL.md:20`; `skills/cad-plan-review/SKILL.md:28`.
- D-22 (green baseline): `node cadence-core/bin/self-verify.mjs` at HEAD returns
  `ok:true` with `problems: []`, so any red in this phase is this phase's own.
  Phase 1's D-15 situation (a red baseline inherited as in-scope repair) does not
  repeat. Evidence: that run; `.planning/phases/1/CONTEXT.md` D-15.

## Acceptance criteria

- [ ] AC1: Every adjudicated firing site reaches a triage step that presents
      surviving findings as a numbered list and asks which to act on with NONE
      first, and no site's prose proceeds to act on a survivor the user did not
      pick. The sites are `/cad-land`'s publish decision, `/cad-verify`'s fix
      routing, `/cad-plan`'s plan-review application, and `/cad-execute`'s diff
      site. `/cad-plan` and `/cad-verify` carry the gate text or an explicit
      re-read, since neither `@`-preloads `review-triggers.md`.
- [ ] AC2: `/cad-land` states that under `git.auto_close: true` the triage gate
      does not prompt, and the unattended close still halts only through
      `land-cleanup.mjs gate`'s existing blocker/high halt.
- [ ] AC3: `skills/cad-reviewer-contract/SKILL.md` still contains "No severity
      inflation" and contains no clause instructing the reviewer to withhold
      low-severity or style findings; `skills/cad-plan-checker-contract/SKILL.md`'s
      severity-floor clause is byte-unchanged; no rung file under `agents/`
      gained reviewer behaviour.
- [ ] AC4: `cadence-core/references/review-triggers.md` step 4 issues the whole
      reviewer set in ONE message with no "for each" and no "where the host
      allows", cites `seams.md` Concurrent dispatch, step 3 resolves the route
      once for the set rather than per reviewer, and
      `cadence-core/workflows/decision-review.md` no longer quotes the removed
      phrase.
- [ ] AC5: `node cadence-core/bin/self-verify.mjs` reports a named problem when a
      file under `cadence-core/workflows/` or `cadence-core/references/` states a
      multi-dispatch instruction without the mandated one-message phrasing,
      proven by a fixture that trips it, and reports no such problem on the repo
      at HEAD.
- [ ] AC6: `review-provider.mjs` refuses an over-cap payload on BOTH `review` and
      `consult` with `{ok:false}` and a named reason, issuing no HTTPS request;
      the cap is a single `review.*` config key measured in `chars/4` estimated
      tokens, and `node cadence-core/bin/config.mjs get <key>` returns its
      default.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p
      tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs`
      reports `ok:true` with no `budget-overrun` on any surface this phase edits.

## Flagged assumptions

- Whether the Claude Code host imposes its own ceiling on a single subagent
  prompt - Unclear; nothing in this codebase can settle it. If wrong in the
  permissive direction, D-07's exemption leaves the `claude-subagent` arm as the
  one genuinely unbounded payload in the subsystem.
- Whether the `chars/4` proxy over- or under-estimates against each provider's
  own max-input ceiling (OpenAI Responses, Gemini `generateContent`, DeepSeek
  chat completions) - Unclear; `references/provider-api.md` pins wire shape, not
  size limits. If it under-estimates, a payload passes the cap and is still
  rejected by the provider.
- The self-verify phrasing check of D-06 is a heuristic over prose - Likely to
  false-positive on a legitimate sentence that describes dispatch without
  issuing it. If wrong, a correct surface fails CI until the pattern is
  narrowed.
- #66's own stated measurement (findings-per-pass and adjudicator rejection
  rate, before and after, on the same diffs) does not exist and the sample size
  from one developer's phases may never support it - the subtraction stays a
  judgment call rather than a measured one, by the issue's own admission.
