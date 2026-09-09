# Acceptance criteria: why the rules were retired

The design is `docs/architecture/acceptance.md`, adopted 2026-09-09. This
file is the record of what came before it and what was learned. It is not
read at runtime and carries no rule.

## What the eleven rules were

From 2026-09-08 to 2026-09-09 acceptance criteria were governed by eleven
numbered authoring rules (`git show 998f2187:docs/rationale/acceptance-criteria.md`).
Each criterion was a function-level test specification: one function, one
literal expected value, the stubbed boundaries named. Rules 8 and 9 then
required one further "wiring" criterion for every production call site of
every function the phase touched.

## What they got right, and the design keeps

- **A model's transcript is not an oracle.** The phase-7 live probe asserted
  over a second session's output and passed or failed on the same code
  depending on prose. A test whose result moves without the code moving is
  measuring the prose. The design refuses a truth whose outcome is
  model-generated text.
- **A test may not stub the boundary it asserts about.** Phase 9's AC152
  claimed "no current config is read", listed the commit among its stubbed
  boundaries, and so replaced the very thing it was about - green in test,
  broken in release. The criterion authorized its own bypass. The design
  refuses a check that stubs its own subject.
- **An absence never shown to fail is not evidence.** The design records
  every check red before the code and green after; that is the demonstrated
  failing variant, made routine.
- **What cannot be stated as input to output is not a test.** The design
  keeps it in the evidence map as an observation, visible, capped at
  "concerns".

## What they got wrong, and why the design is shaped as it is

**The unit was the function.** A criterion per function, and then per call
site, makes the count grow with the code rather than with what the phase
promises. Commit `31a93985`, applying the rules, took phase 9 from 14
criteria to 150 and phase 10 from 17 to 208 in one step. Every other phase
in the roadmap carries 5 to 15. The next commit deleted the caller-mirroring
criteria as wrong, leaving 187 with no wiring criteria at all - a set the
plan gate refused by construction. No human reviews 187 of anything. Across
three research passes (`.codex-analysis/ac-*-research.md`, 322 sources), no
tool that shipped requires a criterion per call site, and Google's own
guidance calls a test that only checks helpers were called "hardly
insightful". The design's unit is a truth: something a person can observe,
at most seven per phase.

**Acceptance and unit tests were one list.** The rules made the developer's
test discipline the thing a human reviews. Every comparable tool keeps them
apart: acceptance is few and approved; unit tests are many and are the
project's. The design gives Cadence the first and leaves the second alone.

**The rules were prose the model had to be handed.** They lived in this file,
were pasted into dispatch prompts by hand, and a personal hook existed only
to check the pasting. The design puts every instruction in the binary and
every refusal in code; the hook dies at phase 12.

**Rust facts were written as universal ones.** `#[cfg(test)]` matching and
`cargo-mutants` were the rules' idea of test detection and falsifiability.
Cadence is not a Rust tool. The design reads the project manifest for the
test command and the stub idiom and keeps everything else language-free.

**Rule 6 was backwards.** "Do not write a test for code that does not exist"
tried to stop tests for phantom code. Engineer, TEA and Spec Kit stop it the
other way: write the test first and watch it fail. The design does that.

## The lesson that generalizes

The two real defects of phase 9 - the execution-boundary gap and the false
green - were both found by a verifier reasoning backward from the goal.
The 158 criteria found neither. More criteria is not the fix. Fewer
promises, each with evidence a verifier actually inspects, is.
