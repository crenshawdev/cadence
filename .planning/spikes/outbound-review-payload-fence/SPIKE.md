# Spike: outbound-review-payload-fence

**Status:** open. Verdict: pending.

Filed from `GH-167`, split out of the v3.7.8 cycle deliberately: it is opt-in
only, it cites no defect in a code path, and what a remote reviewer may receive
is a design decision rather than a repair.

## The question

When a cross-model review provider is enabled, Cadence sends the plan, the diff
and the cited files to OpenAI, Gemini or DeepSeek. What may leave the machine,
and can that boundary be made deterministic - able to refuse or explicitly
exclude likely-secret material AND tell the user what it withheld - without
becoming a keyword filter that is wrong in both directions?

The default `claude-subagent` path does not leave the machine and is not in
scope. The known incident is an external-project run in which a secret reached a
reviewer transcript.

## The decision that hinges on it

Whether cross-model review keeps its current shape, grows a mandatory fence
before the provider cutover, or narrows to an explicit opt-in scope the user
states per project. The answer also decides whether `review-provider.mjs` gains
a refusal it can raise, or whether the boundary lives one layer up in whatever
assembles the payload.

The rail is the one the rest of Cadence already holds: a check that did not run
did not pass. A fence that silently drops material is worse than none, because
the reviewer then judges an artifact the user believes it saw.

## Criteria, risk-first

1. **The regex answer is disqualified first.** Measure a `token|password|secret|
   key|api|bearer` pass over this repository's own review payloads and record
   both error directions. The v3.5.0 measurement of a keyword scan on this repo
   false-positived `auth` on sixteen hits of the word `session`; if the same
   shape holds here, a keyword fence is refuted before anything is built.
2. **Establish what actually goes out.** Instrument one real cross-model review
   and record the exact bytes the provider receives, by category: plan text,
   diff hunks, whole cited files, config values, environment. Until this is
   measured the blast radius is assumed rather than known.
3. **Determine whether refusal is representable.** A fence that cannot say what
   it withheld is not acceptable. Establish whether the payload assembler can
   name an exclusion to the user and to the run record before the request is
   made, and whether the reviewer's finding schema survives a payload with a
   stated hole in it.
4. **Establish the failure mode under uncertainty.** Decide, and prove against a
   fixture, whether an unclassifiable file blocks the request or is excluded
   with a notice. Both are defensible; silently sending it is not.

## Out of scope

The default subagent path. Provider API differences already covered by
`references/provider-api.md`. Any change to the finding schema itself.
