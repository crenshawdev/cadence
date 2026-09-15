# Filed: issues this repository's gates opened

Written by `issue-filing.mjs file` when a gate's finding is ACCEPTED and filed
on the tracker, read by `planning.mjs recall` beside CAPTURE.md. One `- ` row
per filed issue: the date, the provider, the repository slug, the finding's
(file, claim) fingerprint and the issue's title. No finding body - a row is a
pointer to an issue, not a copy of it, and NOTHING here is a queue. A declined
finding is never written here; its only record is the decline label on the
forge. A line that is not a row is skipped, so a note added here mints no
recall entry.

- 2026-08-25 github crenshawdev/cadence e7cfd661a15c38fa: [cadence e7cfd661a15c38fa] Task 6 classifies `risk-check.mjs:70` and `:326` as exempt and makes that exemption part of the new census, despite CONTEXT D-06 identifying the corresponding `risk-check.mj
- 2026-08-25 github crenshawdev/cadence b9ae737ae1a77a4f: [cadence b9ae737ae1a77a4f] The proposed terminal dedup treats any close that finds a pending dispatch for the same `(corr, phase, plan)` as that pending dispatch's first close, so it cannot distinguis
- 2026-08-26 github crenshawdev/cadence 55d0841ac5ee9c94: [cadence 55d0841ac5ee9c94] The hook trusts parsed stdin `cwd` and `agent_type` without validating that they describe the hook invocation's actual project or a host-authentic Cadence subagent.
- 2026-08-26 github crenshawdev/cadence c0f0e0bbab361ba4: [cadence c0f0e0bbab361ba4] Task 2's verification does not prove AC1's required failure mode through the suite entrypoint.
- 2026-08-26 github crenshawdev/cadence 1cbc5bf7c15b27c6: [cadence 1cbc5bf7c15b27c6] Task 4 has no falsifiable verification of the required CADENCE-CENSUS prose content.
- 2026-08-26 github crenshawdev/cadence f8ee8e823dcf8db3: [cadence f8ee8e823dcf8db3] Task 3's checks only prove removal of old wording, not that either replacement header accurately states the required disposition.
- 2026-08-26 github crenshawdev/cadence 94ba51e30b566c38: [cadence 94ba51e30b566c38] The new cache-fact join key concatenates unescaped untrusted `corr` and `agent_id` fields with a NUL delimiter, so distinct pairs can collide and cache figures can be folded
- 2026-08-29 github crenshawdev/cadence f03187889ee62204: [cadence f03187889ee62204] The rotation admission check reserves only the pending record, not the mandatory rotation-marker line written into the fresh record.
- 2026-08-29 github crenshawdev/cadence ca1fbd834199dfcb: [cadence ca1fbd834199dfcb] `overridden: true` is an unverifiable self-assertion that discharges the module's strongest refusal, and nothing anywhere requires the corresponding `override` trace receipt
- 2026-08-29 github crenshawdev/cadence dd09d6a6113e9112: [cadence dd09d6a6113e9112] The rewritten fix_commit VALUE check is still scoped inside the `ruling === 'survived'` branch, so a `downgraded` or `refuted` ruling stores an arbitrary unspendable string
- 2026-08-29 github crenshawdev/cadence eb3c4bdae2b8fb82: [cadence eb3c4bdae2b8fb82] `unfixedFromEntries` classifies every survived blocker/high with `overridden: true` as a `haltingSurvivor` without considering whether that otherwise-valid entry also carrie
- 2026-08-29 github crenshawdev/cadence 35057ee7993d82dc: [cadence 35057ee7993d82dc] The instruction to change no assertion text conflicts with migrating the named byte-exact receipt tests.
- 2026-08-29 github crenshawdev/cadence b9d6e61dcffadc72: [cadence b9d6e61dcffadc72] The presence check inspects every raw `--event` occurrence rather than the effective event that `planning.mjs` dispatches with.
- 2026-08-29 github crenshawdev/cadence ca31319a4c232c0c: [cadence ca31319a4c232c0c] The new agreement tests do not exercise the claimed prerequisite that a Too big task has no matching roadmap phase, nor the fact that the displayed number must remain correc
- 2026-08-30 github crenshawdev/cadence 36eb95f4b5063d1d: [cadence 36eb95f4b5063d1d] The new untrusted-input rendering is not actually bounded: limiting the list to five members leaves each rendered string unlimited in length.
- 2026-08-30 github crenshawdev/cadence 5d4fc16e6f0f6125: [cadence 5d4fc16e6f0f6125] The newly added source-directory `lstatSync` probes are outside error handling and turn some untrusted filesystem states into uncaught exceptions instead of structured refus
- 2026-08-30 github crenshawdev/cadence 85d539c48c7683ef: [cadence 85d539c48c7683ef] Task 3's measured reserve is explicitly allowed to differ from the marker actually written, so it does not establish the bounded-first-write success criterion.
- 2026-08-30 github crenshawdev/cadence 45965eea50b28c91: [cadence 45965eea50b28c91] Task 2 deduplicates rescued lines by their serialized content, which cannot distinguish the duplicate copy of one carried event from two distinct events with identical seria
- 2026-08-30 github crenshawdev/cadence e4fe3c263302897b: [cadence e4fe3c263302897b] Task 4 does not make its promised restoration safe when another writer claims the sibling path between eviction and confirmation.
- 2026-09-01 github crenshawdev/cadence 0d0678aa8a8fca4a: [cadence 0d0678aa8a8fca4a] Gemini normalization treats a malformed component as zero and emits an apparently complete but incorrect output count.
- 2026-09-01 github crenshawdev/cadence ad7a68b976d96c3b: [cadence ad7a68b976d96c3b] Token counts are accepted as any finite non-negative number rather than safe integers, allowing malformed or rounded usage to be recorded as exact.
- 2026-09-01 github crenshawdev/cadence 2b77b26e6776abd5: [cadence 2b77b26e6776abd5] Usage extraction occurs only after the non-2xx exit, so HTTP error responses that include provider-reported usage lose their cost data.
- 2026-09-01 github crenshawdev/cadence 622312b1f66a11d3: [cadence 622312b1f66a11d3] `tokenCount` accepts finite non-negative JavaScript numbers without requiring a safe integer, so malformed oversized provider token counts are silently rounded and persisted
- 2026-09-02 github crenshawdev/cadence 084c9ce03c072e0b: [cadence 084c9ce03c072e0b] The new string guard accepts whitespace-only effort and rung values despite documenting that blank values must contribute nothing.
- 2026-09-02 github crenshawdev/cadence 09e6a40edd174f78: [cadence 09e6a40edd174f78] Task 4 departs from the locked OQ-1 decision to support staged `risk-check status`: it leaves receipts ref-only and knowingly makes every matched staged record remain `unfir
- 2026-09-03 github crenshawdev/cadence 11a4240bdf45ae04: [cadence 11a4240bdf45ae04] Refusing on an unreadable FILED.md before attempting the lookup contradicts D-04's locked rule that FILED.md is only a fallback when the tracker lookup could not run.
- 2026-09-03 github crenshawdev/cadence c37a2c3c67644418: [cadence c37a2c3c67644418] The plan knowingly leaves the Forgejo and GitLab lookup semantics unproved even though failure of the assumption removes duplicate protection entirely on those providers.
- 2026-09-05 github crenshawdev/cadence 979d0aee70f2e4c1: [cadence 979d0aee70f2e4c1] Explicit `null` for `roles.<role>.effort` is treated as absence and allows the legacy `model.effort.<role>` key to win, contradicting the new schema contract that null unpin
