---
name: cad-spike
description: "Record risk-ordered spike criteria before experimenting, then retain observations and a bounded verdict."
argument-hint: "<the question or hypothesis to resolve>"
allowed-tools:
  - mcp__cadence__cadence_apply
  - mcp__cadence__cadence_query
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<role>
Resolve one unknown with a throwaway experiment. The binary owns the durable
spike record and its SPIKE.md projection. Criteria precede material, experiments
run risk-first, and the caller chooses an evidence-backed verdict. The binary
retains observations; it does not adjudicate experimental truth.
</role>

<protocol>
Use cadence_query schema with tool apply and for set to spike-open,
spike-observation, spike-verdict or spike-close for the exact request shape.
Each cadence_apply operation carries request with request_id, slug and
expected_version. Open uses expected_version 0; later mutations copy the last
returned answer field `record.version`. Use distinct request IDs for new mutations. Retry an
uncertain delivery with the identical request_id and inputs; changed-input
replay is refused. A replay returns its original answer, not a newer record.

Choose a slug of 1..80 lowercase letters, digits or hyphens, starting with a
letter and ending without a hyphen. There is no spike query operation. Readback
comes from the operation answer, which carries record and projection, and the
binary-rendered SPIKE.md. Never reconstruct authority from historical Markdown.
Existing historical spike directories are not imported or overwritten.

Read project code with the host's own tools.
The entire .planning/spikes subtree is protected, including nested files other
than SPIKE.md. Never use Write, Edit or Bash to change it, stage it or commit it.
</protocol>

<method>
1. Interview for the question and decision. Refine $ARGUMENTS into one precise
   unknown and the downstream decision its answer will change. Use
   AskUserQuestion only for missing information. If no decision depends on the
   answer, explain that and stop before opening a spike.

2. Before creating experiment material, write falsifiable Given/When/Then
   criteria with an explicit failure outcome. Each criterion has a distinct id,
   given, when, then and failure. Use an observable output, behavior or number,
   not "feels fast enough". Order criteria risk-first: test the assumption most
   likely to kill the approach first, then the next cheapest disproof. Preserve
   that order in the criteria array.

3. Call spike-open with question, decision and the ordered criteria. Read and
   show the returned record and projection before creating any experiment
   material. Confirm the exact question, decision, criterion identities and
   Given/When/Then/failure values are present, observations is empty and verdict
   is null. The initial projection has no Results section. If open is refused
   or readback differs, stop; do not build the experiment.
   Question, decision and criteria are immutable after open, including after
   verdict. A changed-input open on the same slug is refused. A revised
   question requires a distinct new spike, never a rewrite of the old one.

4. Only after the successful open/readback, create the minimum throwaway
   experiment in an external temporary directory outside the project. Use an
   absolute location; never put experiment code inside .planning/spikes or
   project production source. Write/Edit may create this external material and
   Bash may run it. Run criteria in their recorded risk-first order. Stop
   experimenting when a criterion invalidates the approach; do not polish a
   dead idea or soften failure to rescue it.

5. Record one observed result per criterion using spike-observation with
   observation {criterion, result}. Keep literal measured results and failures.
   If later criteria were not run because an earlier criterion failed, record
   that fact and reason for each; never invent a successful measurement.
   Foreign criterion identities and duplicate observations are refused.
   Read each answer and retain its answer field `record.version` for the next mutation.

6. Call spike-verdict with verdict and criteria containing every recorded
   criterion id in its original order. All criteria need one recorded result.
   The three-word verdict vocabulary is validated, invalidated, inconclusive:
   - validated: the caller's evidence satisfies the criteria.
   - invalidated: a criterion failed; state what failed and what the decision
     should now avoid.
   - inconclusive: evidence could not decide; state what would decide it.
   confirmed and every other word are refused. Do not use inconclusive to hide
   an invalidated result. Observations are frozen once the verdict is recorded.
   Show the acknowledged verdict, observed results and decision recommendation.

7. Call spike-close with throwaway_location set to the absolute external
   location. The binary refuses a location inside the project, including
   .planning/spikes and production source. Read the closed record and projection
   and confirm the external location is retained. Discard only the throwaway
   material created for this spike, or tell the owner its retained location.
   The binary records closure; it neither copies experiment code into the
   project nor deletes external files. No phase completion or production change
   follows from a spike verdict.
</method>
