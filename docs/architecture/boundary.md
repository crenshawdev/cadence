# The MCP boundary

The boundary is the only way a skill reaches the binary. It publishes three
tools and nothing else: `cadence_version`, a side-effect-free diagnostic;
`cadence_query`, which selects the next unit of work; and `cadence_apply`,
which submits an executor's patch. `tools/list` declaring exactly three is a
pinned assertion, not an accident of registration.

Validation does not live at the boundary. The handler receives
`CallToolRequestParams.arguments` as a raw optional JSON object and
deserializes inside the named handler, so absent, extra, wrong-typed and
unknown-tagged fields return a typed `Envelope::Refused` that Cadence itself
produced. A macro path that deserialized before the handler would surrender
that answer to rmcp's parameter error, which is a protocol error rather than a
recorded decision. Calls to undeclared tool names and syntactically invalid
JSON-RPC frames stay protocol errors and are deliberately not relabelled as
Cadence refusals; the two layers are distinguishable by test.

Every public answer is one envelope vocabulary: `dispatch`, `complete`,
`refused`, `judgment-stop`, `unknown`, `not-applicable` and `next-plan`. The
adapter maps the resident's typed outcomes onto those without recomputing
selection, patch validity or state, so there is no second state machine at the
boundary. Only `dispatch` carries a prompt body; every other arm is bounded and
carries compact identifiers and reasons. Internal changed-input, lifecycle
conflict, store conflict, Git validation and log-bound outcomes map to stable
public codes rather than leaking localized I/O strings.

A refusal that cannot be persisted is a server failure, not a refusal. Cadence
does not claim a recorded decision it did not record.

## What the skill does with it

`skills/cad-execute/SKILL.md` is twenty-one lines and three allowed tools:
`cadence_query`, `cadence_apply` and `Task`. It has no filesystem, shell or
JavaScript path, and no report, replay, Git, plan-parser or SUMMARY-writing
arm. The loop is: ask `cadence_query` with the user's phase spelling unchanged;
read the envelope; on `dispatch`, hand exactly the returned prompt to the fixed
`cad-executor` with nothing added; submit the executor's one JSON object to
`cadence_apply` field-for-field without interpreting its judgment fields; then
follow the apply envelope, repeating from the first step on `next-plan`.

The binary is the only continuation authority. The skill keeps no local
execution state, inspects no project files, and constructs no alternate
recovery path. Preserving the executor's deviation, blocker and evidence text
verbatim is deliberate: those are the model's judgment, and a skill that
summarized them would be editing the record it exists to carry.

## Two host constraints the schemas must satisfy

Both were found by running a real host, and neither is visible to any
in-process or raw-stdio test. Both cost a blocked live UAT before they were
understood. Neither is a property of MCP itself: the first is enforced by the
host, and the second is an Anthropic API constraint that the host reports on
the API's behalf.

**Every advertised schema needs a root `"type": "object"`.** `schemars` renders
a Rust tagged enum as a root-level `oneOf` with no `type`, which the host
rejects. Four of the six advertised schemas were shaped that way.

**An input schema may not use a top-level `oneOf`, `anyOf` or `allOf`, and
needs real `properties`.** A root type alone is not sufficient. This one is not
the host's own rule - the host's log names its source: `Skipping tool
"cadence_query": its input schema uses top-level oneOf, which the Anthropic API
does not accept`. The tool is dropped silently from the list, so a dropped tool
does not exist for the user, and the server still reports itself connected -
nothing local looks wrong. Expect the same rejection from any host that passes
these schemas to that API.

The consequence for anyone changing these types: the ADVERTISED schema may
become less expressive to satisfy the host, and the VALIDATOR may not become
less strict. Admission is unchanged because it happens inside Cadence after
deserialization. `crates/cadence/tests/mcp.rs` asserts both constraints
generally over the whole returned tool list rather than per tool, so a tool
added later is covered by construction.

Reading a host's registered tools is cheap and worth doing before any live run:
start it with `--output-format stream-json --verbose` and parse the `system`
init event's `tools` array. `--debug` emits nothing under `-p`.

## What is proven, and what is not

Deterministic tests prove the schema shape, the typed refusal path, envelope
distinctness, dispatch identity across process replacement, lossless patch
submission and log-bound terminal replay. They cannot prove that a real host
loads the tools, that a real model honors the executor contract, or that the
guard denies a live write; a green suite is exactly what shipped both host
constraints above. Those clauses belong to the live UAT and are recorded in
`.planning/phases/6/UAT.md` with their actual status, never rounded up.
