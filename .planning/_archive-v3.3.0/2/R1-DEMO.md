# R1 on the live record - the demonstration

Run: 2026-08-14, from `/data/code/cadence`, against the real (gitignored)
`.planning/trace.jsonl`, at commit `9c36dc8` (phase 2, plan 2, task 2).

```
node cadence-core/bin/planning.mjs trace suggest
```

541 events read, scope `all`. This is AC4's demonstration: R1 had never spoken
on this corpus, because one `outcome/rearm` line anywhere in the file muted its
trigger for the life of the file, and the file is never pruned.

## The input lines

Every `outcome` line naming `risk_surface`, quoted verbatim from
`.planning/trace.jsonl` (these are the same literals the regression test
`R1: the live record this repo has been writing for four cycles emits a
suggestion` in `cadence-core/bin/trace-suggest.test.mjs` carries, so the
demonstration keeps a guard behind it without any committed test reading the
gitignored file - D-09):

```
{"corr":"2-b3748a4","phase":"2","ts":"2026-08-10T18:44:28.643Z","family":"outcome","event":"adjudication","detail":"risk_surface: 0 survivors; voices openai/gpt-5.6-terra"}
{"corr":"1-7502567","phase":"1","ts":"2026-08-13T17:36:33.000Z","family":"outcome","event":"adjudication","detail":"risk_surface: 0 survivors; voices openai/gpt-5.6-terra"}
{"corr":"1-7502567","phase":"1","ts":"2026-08-13T17:56:37.028Z","family":"outcome","event":"rearm","detail":"risk_surface"}
{"corr":"1-7502567","phase":"1","ts":"2026-08-13T19:08:23.371Z","family":"outcome","event":"adjudication","detail":"risk_surface re-arm: 0 survivors of 1 raised; voices openai/gpt-5.6-sol"}
{"corr":"3-d558479","phase":"3","ts":"2026-08-14T03:43:42.447Z","family":"outcome","event":"adjudication","detail":"risk_surface: 3 survivors of 4 raised; voices openai"}
{"corr":"3-d558479","phase":"3","ts":"2026-08-14T03:47:22.001Z","family":"outcome","event":"rearm","detail":"risk_surface"}
{"corr":"3-d558479","phase":"3","ts":"2026-08-14T03:49:29.886Z","family":"outcome","event":"adjudication","detail":"risk_surface rearm: 2 survivors of 2 raised; voices openai"}
{"corr":"3-d558479","phase":"3","ts":"2026-08-14T13:39:29.459Z","family":"outcome","event":"adjudication","detail":"risk_surface: 2 survivors; voices openai/gpt-5.6-sol","raised":3}
{"corr":"2-eebba7d","phase":"2","ts":"2026-08-14T21:16:27.190Z","family":"outcome","event":"adjudication","detail":"risk_surface: 1 survivors; voices openai","raised":2}
{"corr":"2-eebba7d","phase":"2","ts":"2026-08-14T21:18:40.635Z","family":"outcome","event":"rearm","detail":"risk_surface"}
```

Two of those seven adjudications were unreadable before this plan: the
`risk_surface rearm:` and `risk_surface re-arm:` rounds, whose trigger token
carries a space. Both now read as the base trigger `risk_surface` with a re-arm
marker (AC5).

## The emitted suggestion

```json
{
  "kind": "suggest",
  "subject": "risk_surface reviewers",
  "evidence": "2 of 7 adjudicated fire(s), 0 survivors of 1 raised - the gate caught work; the reviewer set is what looks miscalibrated",
  "action": "review.reviewers"
}
```

## The arithmetic

7 `risk_surface` fires; the re-arm under `1-7502567` vetoes the empty fire at
17:36:33 before it, the one under `3-d558479` vetoes the three-survivor fire at
03:43:42, and the one under `2-eebba7d` vetoes the one-survivor fire at
21:16:27 - leaving 2 unvetoed zero-survivor fires (`2-b3748a4`, raised
unrecorded and so counted 0, and the `re-arm:` round under `1-7502567`, 1
raised), exactly `MIN_FIRES_FOR_GATE_SUGGESTION`, with 1 raised across them,
which lands the suggestion on the `review.reviewers` arm rather than the
gate-off arm.

`MIN_FIRES_FOR_GATE_SUGGESTION` was NOT moved: it stayed at 2 and the corpus
cleared it. `plan` (10 fires, 0 empty) and `diff` (3 fires, 1 empty) stay
silent, as they should.
