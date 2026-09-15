# Phase 29 O1 — live-host observation record


Observer: **Codex (GPT-6) as live host, at the orchestrator's direction; owner review pending**.


Date: 2026-09-10 (America/Indiana/Indianapolis; event timestamps below are UTC).


Checkout: `/code/cadence`; branch `cadence/binary-owns-process`; HEAD `9c3df4c2d18bc4ce29816cd7b0295a1f21983f9e`.


Binary: `/code/cadence/target/debug/cadence`; SHA-256 `e2b75a3fd2fa9411a41158c4b3d5af95a015c92bf5b90c1b796fbd7f457a8e3b`. The digest was the same immediately after the build and after server exit.


Pilot project: `/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project`. Driver, rendered instructions, raw events, response captures and snapshots: `/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29`.


This records the host conduct requested for P29-O1. It assigns no verdict or truth status. The pilot owner role is explicitly played by Codex, as the orchestrator requested; the identity and approvals below are not represented as a human John Crenshaw approval. John Crenshaw <john@jcrenshaw.dev> is the requested author of the seed Git commit.


## What O1 names, and what was seen


| What O1 names | Seen | Evidence line |
|---|---|---|
| A check with a blank expected output returned a typed refusal naming the item | seen | MCP 9 response, event 55: `check-expected`, `P2-T1-C`, `submission.plans[0].content.evidence_map.items[0].spec.expected.value`. |
| A link naming a value its truth does not use returned a typed refusal naming the item | seen | MCP 10 response, event 61: `link-value-not-named`, `P2-T1-L`, `submission.plans[0].content.evidence_map.items[5].spec.value`; `package` is absent from T1 version 1. |
| The corrected plan landed with its map attached and readable back | seen | MCP 12 response, event 73: `persisted: true`; MCP 13 response, event 76: six items, ten associations, `parcel` link; post-exit PLAN-1.md and state.json reproduced below. |


Published identity: phase **2**, plan **1**, occurrence `active-cycle:phase:2`. Publication revision `a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73`. Map revision `f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89`.


## Build and preparation


Ran exactly once from `/code/cadence`: `RUSTC_WRAPPER= cargo build -p cadence`. Exit status 0. Output:


`````text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.06s
`````


No cargo lock wait was reported. Rendered `target/debug/cadence context-instructions` and `target/debug/cadence plan-instructions` into `cad-context.md` and `cad-plan.md` under the pilot directory, with the explicit empty global-config override. Both commands exited zero. Those rendered texts, including their compiled schemas, were read and used as the skill instructions; they are reproduced at the end. The frozen `cadence-core/workflows/plan.md` was not read. No CLAUDE.md was used.


Read phase 29 CONTEXT.md, including Observations/O1, T1–T4 and D-99–D-106, followed by PLAN.md P29-O1 and task 5. Read the phase 28 pilot report for preparation, using its corrected `## Phases` list and `## Phase Details` roadmap shape and minimal disabled-memory config. The pilot was initialized with one committed main.py. Git mutating commands ran only with the pilot project as cwd.


The context interview precedes plan intake. Each of three truths received separate observable and fixed-oracle answers, followed by a complete draft, explicit exact-set approval with the acting owner identity and observed time, and a `context-submit` acknowledgment with `persisted: true` (MCP 4). T1 names `parcel` in its trigger. Authoritative `evidence-read` returned T1, T2 and T3 at version 1 before map authoring. All owner answers below are verbatim Codex-authored role answers.


## Instruction sufficiency and source consultations


The rendered context and plan prose plus their compiled schemas were sufficient for the context interview, typed map, complete preview, located corrections, exact approval, publication and public readback. No production Rust was consulted to proceed. The only Rust file read was `crates/cadence/tests/mcp.rs`: initially the `CADENCE_GLOBAL_CONFIG` match with surrounding lines, then lines 1–85. This was the orchestrator-requested isolation reference and also exposed the integration client's newline-delimited JSON-RPC transport shape. The explicit empty override was used by the server; no environment dump was produced and no ~/.claude write was requested.


Project preparation still relied on the phase 28 report: the rendered skills assume a usable project and do not supply the roadmap parser's required heading/list shape. No Context7 or web documentation was used for this observation. A preliminary memory registry keyword scan yielded historical material; no memory-derived product or pilot facts were used.


## Requests, responses and host behavior that stood out


1. MCP initialization advertised `serverInfo: {"name":"cadence","version":"3.7.12"}` (event 8), although the task names the 4.0.0 Rust rewrite. This is the returned version, not an inferred release judgment.
2. The first candidate contained both deliberate defects. The binary returned only the blank expectation refusal. Correcting that field alone exposed the link refusal in the next complete preview. Both arrived as successful MCP tool results with `isError: false`, containing `status: refused` and `code: invalid-plan`.
3. The first refusal clearly says the named item needs nonblank expected.value. The second names the value, the associated truth/version, and the exact individual-slot lexical rule. Together with the rendered correction guidance and the approved trigger, it was clear to change `package` to `parcel`; no Rust lookup was needed.
4. The successful preview inserted the canonical Evidence map section and the default `directories: []`. Its exact final submission and full document were shown before approval; the final approval copied that submission unchanged.
5. Publication and readback remained `provisional-authoring`. The planned checks were authored, not executed, and the pilot source still contains its seed behavior. No conclusion about check adequacy or the handoff implementation is made.
6. The Python 3.14 interactive driver tried to save its command history to `/home/john/.python_history`; the sandbox refused with `[Errno 30] Read-only file system`. This was a host harness warning, not a Cadence response. No such write succeeded. Attempting to change the history destination during that already-running interpreter did not redirect its cached path. Server stderr was empty; its shutdown was stdin EOF followed by wait, exit 0, with no signal or process kill.


## Tree snapshots and observed comparisons


The baseline was captured before the first plan authoring/allocation call, after native context publication. Each snapshot lists `find .planning -print` results and the SHA-256 of every regular file under .planning. Both refused complete previews left file/directory membership and every captured file byte-identical to that baseline. This is a comparison at the sampled boundaries, not a claim about transient syscalls.


### initial


`````text
# find .planning -print (sorted)
.planning
.planning/ROADMAP.md
.planning/config.json
# sha256 of every regular file
568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md
18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json
`````


### before-plan


`````text
# find .planning -print (sorted)
.planning
.planning/ROADMAP.md
.planning/config.json
.planning/config.v4.json
.planning/decisions.jsonl
.planning/items.jsonl
.planning/phases
.planning/phases/2
.planning/phases/2/CONTEXT.md
.planning/state.json
# sha256 of every regular file
568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md
18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json
a54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl
9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md
775f2225962d83430b1fc6c45078b08b87667036c64c2ad9378799b22261d5c2  .planning/state.json
`````


### after-first-refusal


`````text
# find .planning -print (sorted)
.planning
.planning/ROADMAP.md
.planning/config.json
.planning/config.v4.json
.planning/decisions.jsonl
.planning/items.jsonl
.planning/phases
.planning/phases/2
.planning/phases/2/CONTEXT.md
.planning/state.json
# sha256 of every regular file
568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md
18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json
a54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl
9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md
775f2225962d83430b1fc6c45078b08b87667036c64c2ad9378799b22261d5c2  .planning/state.json
`````


### after-second-refusal


`````text
# find .planning -print (sorted)
.planning
.planning/ROADMAP.md
.planning/config.json
.planning/config.v4.json
.planning/decisions.jsonl
.planning/items.jsonl
.planning/phases
.planning/phases/2
.planning/phases/2/CONTEXT.md
.planning/state.json
# sha256 of every regular file
568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md
18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json
a54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl
9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md
775f2225962d83430b1fc6c45078b08b87667036c64c2ad9378799b22261d5c2  .planning/state.json
`````


### after-server-exit


`````text
# find .planning -print (sorted)
.planning
.planning/ROADMAP.md
.planning/config.json
.planning/config.v4.json
.planning/decisions.jsonl
.planning/items.jsonl
.planning/phases
.planning/phases/2
.planning/phases/2/CONTEXT.md
.planning/phases/2/PLAN-1.md
.planning/state.json
# sha256 of every regular file
568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md
18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json
a54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl
9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md
a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73  .planning/phases/2/PLAN-1.md
7fcc9dd12f08a43c73a9d6891ab8f57974202f2c7633188608143354123ec4e0  .planning/state.json
`````


### first-refusal diff


Unified diff output: empty, 0 bytes.


`````diff

`````


### second-refusal diff


Unified diff output: empty, 0 bytes.


`````diff

`````


### Post-capture comparisons


`````json
{
  "wire_request_ids": [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14
  ],
  "wire_response_ids": [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14
  ],
  "first_correction_changes": [
    {
      "path": "/plans/0/content/evidence_map/items/0/spec/expected/value",
      "before": " \t\n ",
      "after": "stdout is exactly b\"delivered box-17\\n\"."
    }
  ],
  "second_correction_changes": [
    {
      "path": "/plans/0/content/evidence_map/items/5/spec/value",
      "before": "package",
      "after": "parcel"
    }
  ],
  "first_refusal_snapshot_byte_identical": true,
  "second_refusal_snapshot_byte_identical": true,
  "approved_submission_equals_preview": true,
  "published_bytes_equal_preview": true,
  "published_bytes_equal_plan_readback": true,
  "published_sha256_equals_returned_revision": true,
  "stored_publication_revision": "a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73",
  "stored_map_revision": "f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89",
  "stored_items_equal_approved_items": true,
  "readback_item_count": 6,
  "readback_association_count": 10,
  "stored_map_item_ids": [
    "P2-T1-C",
    "P2-T2-C",
    "P2-T3-C",
    "P2-A-CLI",
    "P2-A-TEST",
    "P2-T1-L"
  ],
  "readback_link": [
    {
      "kind": "link",
      "id": "P2-T1-L",
      "spec": {
        "caller": "main.py::sender",
        "callee": "main.py::receiver",
        "value": "parcel"
      },
      "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.",
      "item_revision": "760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402"
    }
  ],
  "server_exit": [
    {
      "method": "stdin EOF then wait; no signal",
      "exit": 0,
      "stderr": ""
    }
  ]
}
`````


## Full ordered host and MCP transcript


Each MCP block is the exact JSON line sent or received, including its newline. No request, response, error, nested approval, schema or map payload has been omitted. The initialized notification has no response. Event numbers correspond to line numbers in pilot29/events.jsonl. Console summaries were shortened during operation; the raw event capture and the blocks here were not shortened. Post-exit file contents are rendered directly at their event positions.


### Event 1 — command — 2026-09-10T18:59:47.973099+00:00


`````json
{
  "argv": [
    "git",
    "init"
  ],
  "cwd": "/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project",
  "exit": 0,
  "stdout": "Initialized empty Git repository in /tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.git/\n",
  "stderr": "hint: Using 'master' as the name for the initial branch. This default branch name\nhint: will change to \"main\" in Git 3.0. To configure the initial branch name\nhint: to use in all of your new repositories, which will suppress this warning,\nhint: call:\nhint:\nhint: \tgit config --global init.defaultBranch <name>\nhint:\nhint: Names commonly chosen instead of 'master' are 'main', 'trunk' and\nhint: 'development'. The just-created branch can be renamed via this command:\nhint:\nhint: \tgit branch -m <name>\nhint:\nhint: Disable this message with \"git config set advice.defaultBranchName false\"\n"
}
`````


### Event 2 — command — 2026-09-10T18:59:47.973929+00:00


`````json
{
  "argv": [
    "git",
    "add",
    "main.py"
  ],
  "cwd": "/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project",
  "exit": 0,
  "stdout": "",
  "stderr": ""
}
`````


### Event 3 — command — 2026-09-10T18:59:47.975483+00:00


`````json
{
  "argv": [
    "git",
    "-c",
    "user.name=John Crenshaw",
    "-c",
    "user.email=john@jcrenshaw.dev",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "Seed parcel CLI"
  ],
  "cwd": "/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project",
  "exit": 0,
  "stdout": "[master (root-commit) 7a727fd] Seed parcel CLI\n 1 file changed, 1 insertion(+)\n create mode 100644 main.py\n",
  "stderr": ""
}
`````


### Event 4 — pilot-setup — 2026-09-10T18:59:47.975557+00:00


`````json
{
  "source": "print(\"ready\")\n",
  "roadmap": "# Pilot parcel project\n\n## Phases\n\n- [x] **Phase 1: Seed CLI** - Print ready with no arguments.\n- [ ] **Phase 2: Parcel delivery** - Deliver a parcel, reject blank input, and retain the ready output.\n\n## Phase Details\n\n### Phase 1: Seed CLI\n**Goal:** A Python CLI prints ready with no arguments.\n\n### Phase 2: Parcel delivery\n**Goal:** Deliver a parcel, reject blank input, and retain the ready output.\n**Depends on:** Phase 1\n",
  "config": {
    "memory": {
      "backend": "none"
    }
  }
}
`````


### Event 5 — snapshot — 2026-09-10T18:59:47.976176+00:00


`````json
{
  "name": "initial",
  "text": "# find .planning -print (sorted)\n.planning\n.planning/ROADMAP.md\n.planning/config.json\n# sha256 of every regular file\n568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md\n18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json\n"
}
`````


### Event 6 — server-start — 2026-09-10T18:59:47.976432+00:00


`````json
{
  "argv": [
    "/code/cadence/target/debug/cadence",
    "serve",
    "--project-root",
    "/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project"
  ],
  "global_config": "empty explicit override as in integration client; no environment dump"
}
`````


### Event 7 — mcp-request — 2026-09-10T18:59:47.976481+00:00


`````json
{"jsonrpc": "2.0", "method": "initialize", "id": 1, "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "Codex live phase 29 O1 host", "version": "1"}}}
`````


### Event 8 — mcp-response — 2026-09-10T18:59:47.979408+00:00


`````json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"cadence","version":"3.7.12"}}}
`````


### Event 9 — mcp-request — 2026-09-10T18:59:47.979492+00:00


`````json
{"jsonrpc": "2.0", "method": "notifications/initialized"}
`````


### Event 10 — mcp-request — 2026-09-10T18:59:47.979511+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 2, "params": {"name": "cadence_query", "arguments": {"operation": "context-intake", "phase": 2}}}
`````


### Event 11 — mcp-response — 2026-09-10T18:59:47.981996+00:00


`````json
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"context-intake\",\"phase\":2,\"context\":null,\"roadmap\":\"# Pilot parcel project\\n\\n## Phases\\n\\n- [x] **Phase 1: Seed CLI** - Print ready with no arguments.\\n- [ ] **Phase 2: Parcel delivery** - Deliver a parcel, reject blank input, and retain the ready output.\\n\\n## Phase Details\\n\\n### Phase 1: Seed CLI\\n**Goal:** A Python CLI prints ready with no arguments.\\n\\n### Phase 2: Parcel delivery\\n**Goal:** Deliver a parcel, reject blank input, and retain the ready output.\\n**Depends on:** Phase 1\\n\",\"contract\":{\"$schema\":\"https://json-schema.org/draft/2020-12/schema\",\"title\":\"Apply\",\"oneOf\":[{\"type\":\"object\",\"properties\":{\"submission\":{\"$ref\":\"#/$defs/Submission\"},\"approval\":{\"anyOf\":[{\"$ref\":\"#/$defs/Approval\"},{\"type\":\"null\"}]},\"operation\":{\"type\":\"string\",\"const\":\"context-submit\"}},\"additionalProperties\":false,\"required\":[\"operation\",\"submission\"]}],\"$defs\":{\"Submission\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"title\":{\"type\":\"string\"},\"scope\":{\"type\":\"string\"},\"durable_decisions\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Decision\"}},\"decisions\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Decision\"}},\"assumptions\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"truths\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/TruthSlots\"}}},\"additionalProperties\":false,\"required\":[\"phase\",\"title\",\"scope\",\"durable_decisions\",\"decisions\",\"assumptions\",\"truths\"]},\"Decision\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"text\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"id\",\"text\"]},\"TruthSlots\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"trigger\":{\"type\":\"string\"},\"observer\":{\"description\":\"One party: the literal separators \\\" and \\\", \\\" & \\\", comma and semicolon are refused.\",\"type\":\"string\"},\"verb\":{\"$ref\":\"#/$defs/Verb\"},\"outcome\":{\"type\":\"string\"},\"kind\":{\"$ref\":\"#/$defs/Kind\"},\"observable\":{\"description\":\"Owner attestation, never an internal-name classifier.\",\"type\":\"boolean\"},\"fixed_oracle\":{\"description\":\"Separate owner attestation; approval or observability cannot imply it.\",\"type\":\"boolean\"}},\"additionalProperties\":false,\"required\":[\"id\",\"trigger\",\"observer\",\"verb\",\"outcome\",\"kind\",\"observable\",\"fixed_oracle\"]},\"Verb\":{\"type\":\"string\",\"enum\":[\"sees\",\"gets\",\"is refused\"]},\"Kind\":{\"type\":\"string\",\"enum\":[\"literal\",\"property\"]},\"Approval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"submission\":{\"anyOf\":[{\"$ref\":\"#/$defs/Submission\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"approved\"]}}},\"persisted\":false}"}],"structuredContent":{"status":"ok","operation":"context-intake","phase":2,"context":null,"roadmap":"# Pilot parcel project\n\n## Phases\n\n- [x] **Phase 1: Seed CLI** - Print ready with no arguments.\n- [ ] **Phase 2: Parcel delivery** - Deliver a parcel, reject blank input, and retain the ready output.\n\n## Phase Details\n\n### Phase 1: Seed CLI\n**Goal:** A Python CLI prints ready with no arguments.\n\n### Phase 2: Parcel delivery\n**Goal:** Deliver a parcel, reject blank input, and retain the ready output.\n**Depends on:** Phase 1\n","contract":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"Apply","oneOf":[{"type":"object","properties":{"submission":{"$ref":"#/$defs/Submission"},"approval":{"anyOf":[{"$ref":"#/$defs/Approval"},{"type":"null"}]},"operation":{"type":"string","const":"context-submit"}},"additionalProperties":false,"required":["operation","submission"]}],"$defs":{"Submission":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"title":{"type":"string"},"scope":{"type":"string"},"durable_decisions":{"type":"array","items":{"$ref":"#/$defs/Decision"}},"decisions":{"type":"array","items":{"$ref":"#/$defs/Decision"}},"assumptions":{"type":"array","items":{"type":"string"}},"truths":{"type":"array","items":{"$ref":"#/$defs/TruthSlots"}}},"additionalProperties":false,"required":["phase","title","scope","durable_decisions","decisions","assumptions","truths"]},"Decision":{"type":"object","properties":{"id":{"type":"string"},"text":{"type":"string"}},"additionalProperties":false,"required":["id","text"]},"TruthSlots":{"type":"object","properties":{"id":{"type":"string"},"trigger":{"type":"string"},"observer":{"description":"One party: the literal separators \" and \", \" & \", comma and semicolon are refused.","type":"string"},"verb":{"$ref":"#/$defs/Verb"},"outcome":{"type":"string"},"kind":{"$ref":"#/$defs/Kind"},"observable":{"description":"Owner attestation, never an internal-name classifier.","type":"boolean"},"fixed_oracle":{"description":"Separate owner attestation; approval or observability cannot imply it.","type":"boolean"}},"additionalProperties":false,"required":["id","trigger","observer","verb","outcome","kind","observable","fixed_oracle"]},"Verb":{"type":"string","enum":["sees","gets","is refused"]},"Kind":{"type":"string","enum":["literal","property"]},"Approval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"submission":{"anyOf":[{"$ref":"#/$defs/Submission"},{"type":"null"}]}},"additionalProperties":false,"required":["approved"]}}},"persisted":false},"isError":false}}
`````


### Event 12 — model — 2026-09-10T19:00:06.487861+00:00


`````text
Phase 2 delivers a parcel, rejects blank input, and preserves ready output. What exact interface and decisions should carry forward?
`````


### Event 13 — owner — 2026-09-10T19:00:06.487963+00:00


`````text
Use Python 3 and one CLI argument. The sender passes it unchanged to the receiver. No argument still prints ready.
`````


### Event 14 — model — 2026-09-10T19:00:06.488003+00:00


`````text
For delivery and blank input, what fixed output and blank rule should phase 2 use?
`````


### Event 15 — owner — 2026-09-10T19:00:06.488020+00:00


`````text
box-17 prints delivered box-17 followed by a newline. A blank argument means strip() is empty; print parcel must not be blank followed by a newline on stderr.
`````


### Event 16 — model — 2026-09-10T19:00:06.488036+00:00


`````text
T1: When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline. Is this outcome observable from outside?
`````


### Event 17 — owner — 2026-09-10T19:00:06.488048+00:00


`````text
Yes, observable: true. The caller can capture that output stream.
`````


### Event 18 — model — 2026-09-10T19:00:06.488059+00:00


`````text
T1: Is its expected answer fixed independently of model prose and not from a model call?
`````


### Event 19 — owner — 2026-09-10T19:00:06.488070+00:00


`````text
Yes, fixed_oracle: true. Use the exact bytes I specified; no model call determines the answer.
`````


### Event 20 — model — 2026-09-10T19:00:06.488081+00:00


`````text
T2: When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline. Is this outcome observable from outside?
`````


### Event 21 — owner — 2026-09-10T19:00:06.488091+00:00


`````text
Yes, observable: true. The caller can capture that output stream.
`````


### Event 22 — model — 2026-09-10T19:00:06.488101+00:00


`````text
T2: Is its expected answer fixed independently of model prose and not from a model call?
`````


### Event 23 — owner — 2026-09-10T19:00:06.488110+00:00


`````text
Yes, fixed_oracle: true. Use the exact bytes I specified; no model call determines the answer.
`````


### Event 24 — model — 2026-09-10T19:00:06.488120+00:00


`````text
T3: When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline. Is this outcome observable from outside?
`````


### Event 25 — owner — 2026-09-10T19:00:06.488129+00:00


`````text
Yes, observable: true. The caller can capture that output stream.
`````


### Event 26 — model — 2026-09-10T19:00:06.488138+00:00


`````text
T3: Is its expected answer fixed independently of model prose and not from a model call?
`````


### Event 27 — owner — 2026-09-10T19:00:06.488148+00:00


`````text
Yes, fixed_oracle: true. Use the exact bytes I specified; no model call determines the answer.
`````


### Event 28 — mcp-request — 2026-09-10T19:00:06.488173+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 3, "params": {"name": "cadence_apply", "arguments": {"operation": "context-submit", "submission": {"phase": 2, "title": "Parcel delivery", "scope": "Deliver one parcel argument, reject blank input, and preserve the no-argument ready output.", "durable_decisions": [{"id": "D-01", "text": "Use Python 3 and keep the CLI output byte-stable."}], "decisions": [{"id": "D-02", "text": "The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline."}], "assumptions": ["One supplied argument is in scope; multiple arguments are outside this phase."], "truths": [{"id": "T1", "trigger": "the sender hands the receiver a parcel through the CLI argument box-17", "observer": "the CLI caller", "verb": "sees", "outcome": "stdout exactly delivered box-17 followed by a newline", "kind": "literal", "observable": true, "fixed_oracle": true}, {"id": "T2", "trigger": "the CLI caller supplies an argument whose Python strip() result is empty", "observer": "the CLI caller", "verb": "sees", "outcome": "stderr exactly parcel must not be blank followed by a newline", "kind": "property", "observable": true, "fixed_oracle": true}, {"id": "T3", "trigger": "the CLI caller supplies no arguments", "observer": "the CLI caller", "verb": "sees", "outcome": "stdout exactly ready followed by a newline", "kind": "literal", "observable": true, "fixed_oracle": true}]}}}}
`````


### Event 29 — mcp-response — 2026-09-10T19:00:06.495238+00:00


`````json
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"context-submit\",\"phase\":2,\"persisted\":false,\"validation\":\"draft\"}"}],"structuredContent":{"status":"ok","operation":"context-submit","phase":2,"persisted":false,"validation":"draft"},"isError":false}}
`````


### Event 30 — model — 2026-09-10T19:00:06.495342+00:00


`````text
Exact complete context proposal, including decisions in order, assumptions, truth slots, kinds and both attestations:
{
  "phase": 2,
  "title": "Parcel delivery",
  "scope": "Deliver one parcel argument, reject blank input, and preserve the no-argument ready output.",
  "durable_decisions": [
    {
      "id": "D-01",
      "text": "Use Python 3 and keep the CLI output byte-stable."
    }
  ],
  "decisions": [
    {
      "id": "D-02",
      "text": "The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline."
    }
  ],
  "assumptions": [
    "One supplied argument is in scope; multiple arguments are outside this phase."
  ],
  "truths": [
    {
      "id": "T1",
      "trigger": "the sender hands the receiver a parcel through the CLI argument box-17",
      "observer": "the CLI caller",
      "verb": "sees",
      "outcome": "stdout exactly delivered box-17 followed by a newline",
      "kind": "literal",
      "observable": true,
      "fixed_oracle": true
    },
    {
      "id": "T2",
      "trigger": "the CLI caller supplies an argument whose Python strip() result is empty",
      "observer": "the CLI caller",
      "verb": "sees",
      "outcome": "stderr exactly parcel must not be blank followed by a newline",
      "kind": "property",
      "observable": true,
      "fixed_oracle": true
    },
    {
      "id": "T3",
      "trigger": "the CLI caller supplies no arguments",
      "observer": "the CLI caller",
      "verb": "sees",
      "outcome": "stdout exactly ready followed by a newline",
      "kind": "literal",
      "observable": true,
      "fixed_oracle": true
    }
  ]
}
`````


### Event 31 — model — 2026-09-10T19:00:06.495383+00:00


`````text
T1 (literal; observable=true; fixed_oracle=true): When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.
`````


### Event 32 — model — 2026-09-10T19:00:06.495397+00:00


`````text
T2 (property; observable=true; fixed_oracle=true): When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.
`````


### Event 33 — model — 2026-09-10T19:00:06.495408+00:00


`````text
T3 (literal; observable=true; fixed_oracle=true): When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.
`````


### Event 34 — model — 2026-09-10T19:00:06.495418+00:00


`````text
Approve this exact complete context set?
`````


### Event 35 — owner — 2026-09-10T19:00:06.495429+00:00


`````text
I approve this exact complete context set. Owner: Codex (GPT-6), acting pilot owner at the orchestrator's direction. Time: 2026-09-10T19:00:06.495423+00:00.
`````


### Event 36 — mcp-request — 2026-09-10T19:00:06.495486+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 4, "params": {"name": "cadence_apply", "arguments": {"operation": "context-submit", "submission": {"phase": 2, "title": "Parcel delivery", "scope": "Deliver one parcel argument, reject blank input, and preserve the no-argument ready output.", "durable_decisions": [{"id": "D-01", "text": "Use Python 3 and keep the CLI output byte-stable."}], "decisions": [{"id": "D-02", "text": "The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline."}], "assumptions": ["One supplied argument is in scope; multiple arguments are outside this phase."], "truths": [{"id": "T1", "trigger": "the sender hands the receiver a parcel through the CLI argument box-17", "observer": "the CLI caller", "verb": "sees", "outcome": "stdout exactly delivered box-17 followed by a newline", "kind": "literal", "observable": true, "fixed_oracle": true}, {"id": "T2", "trigger": "the CLI caller supplies an argument whose Python strip() result is empty", "observer": "the CLI caller", "verb": "sees", "outcome": "stderr exactly parcel must not be blank followed by a newline", "kind": "property", "observable": true, "fixed_oracle": true}, {"id": "T3", "trigger": "the CLI caller supplies no arguments", "observer": "the CLI caller", "verb": "sees", "outcome": "stdout exactly ready followed by a newline", "kind": "literal", "observable": true, "fixed_oracle": true}]}, "approval": {"approved": true, "owner": "Codex (GPT-6), acting pilot owner at the orchestrator's direction", "at": "2026-09-10T19:00:06.495423+00:00", "submission": {"phase": 2, "title": "Parcel delivery", "scope": "Deliver one parcel argument, reject blank input, and preserve the no-argument ready output.", "durable_decisions": [{"id": "D-01", "text": "Use Python 3 and keep the CLI output byte-stable."}], "decisions": [{"id": "D-02", "text": "The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline."}], "assumptions": ["One supplied argument is in scope; multiple arguments are outside this phase."], "truths": [{"id": "T1", "trigger": "the sender hands the receiver a parcel through the CLI argument box-17", "observer": "the CLI caller", "verb": "sees", "outcome": "stdout exactly delivered box-17 followed by a newline", "kind": "literal", "observable": true, "fixed_oracle": true}, {"id": "T2", "trigger": "the CLI caller supplies an argument whose Python strip() result is empty", "observer": "the CLI caller", "verb": "sees", "outcome": "stderr exactly parcel must not be blank followed by a newline", "kind": "property", "observable": true, "fixed_oracle": true}, {"id": "T3", "trigger": "the CLI caller supplies no arguments", "observer": "the CLI caller", "verb": "sees", "outcome": "stdout exactly ready followed by a newline", "kind": "literal", "observable": true, "fixed_oracle": true}]}}}}}
`````


### Event 37 — mcp-response — 2026-09-10T19:00:06.525042+00:00


`````json
{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"context-submit\",\"phase\":2,\"persisted\":true}"}],"structuredContent":{"status":"ok","operation":"context-submit","phase":2,"persisted":true},"isError":false}}
`````


### Event 38 — model — 2026-09-10T19:00:12.949115+00:00


`````text
The context publication was acknowledged with persisted true. Starting /cad-plan 2.
`````


### Event 39 — mcp-request — 2026-09-10T19:00:12.949195+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 5, "params": {"name": "cadence_query", "arguments": {"operation": "context-intake", "phase": 2}}}
`````


### Event 40 — mcp-response — 2026-09-10T19:00:12.951160+00:00


`````json
{"jsonrpc":"2.0","id":5,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"context-intake\",\"phase\":2,\"context\":\"# Phase 2: Parcel delivery\\n\\n## Scope boundary\\n\\nDeliver one parcel argument, reject blank input, and preserve the no-argument ready output.\\n\\n## Durable decisions\\n\\n- D-01. Use Python 3 and keep the CLI output byte-stable.\\n\\n## Decisions\\n\\n- D-02. The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline.\\n\\n## Truths\\n\\n- T1. When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.\\n- T2. When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.\\n- T3. When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.\\n\\n## Flagged assumptions\\n\\n- One supplied argument is in scope; multiple arguments are outside this phase.\\n\",\"roadmap\":\"# Pilot parcel project\\n\\n## Phases\\n\\n- [x] **Phase 1: Seed CLI** - Print ready with no arguments.\\n- [ ] **Phase 2: Parcel delivery** - Deliver a parcel, reject blank input, and retain the ready output.\\n\\n## Phase Details\\n\\n### Phase 1: Seed CLI\\n**Goal:** A Python CLI prints ready with no arguments.\\n\\n### Phase 2: Parcel delivery\\n**Goal:** Deliver a parcel, reject blank input, and retain the ready output.\\n**Depends on:** Phase 1\\n\",\"contract\":{\"$schema\":\"https://json-schema.org/draft/2020-12/schema\",\"title\":\"Apply\",\"oneOf\":[{\"type\":\"object\",\"properties\":{\"submission\":{\"$ref\":\"#/$defs/Submission\"},\"approval\":{\"anyOf\":[{\"$ref\":\"#/$defs/Approval\"},{\"type\":\"null\"}]},\"operation\":{\"type\":\"string\",\"const\":\"context-submit\"}},\"additionalProperties\":false,\"required\":[\"operation\",\"submission\"]}],\"$defs\":{\"Submission\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"title\":{\"type\":\"string\"},\"scope\":{\"type\":\"string\"},\"durable_decisions\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Decision\"}},\"decisions\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Decision\"}},\"assumptions\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"truths\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/TruthSlots\"}}},\"additionalProperties\":false,\"required\":[\"phase\",\"title\",\"scope\",\"durable_decisions\",\"decisions\",\"assumptions\",\"truths\"]},\"Decision\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"text\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"id\",\"text\"]},\"TruthSlots\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"trigger\":{\"type\":\"string\"},\"observer\":{\"description\":\"One party: the literal separators \\\" and \\\", \\\" & \\\", comma and semicolon are refused.\",\"type\":\"string\"},\"verb\":{\"$ref\":\"#/$defs/Verb\"},\"outcome\":{\"type\":\"string\"},\"kind\":{\"$ref\":\"#/$defs/Kind\"},\"observable\":{\"description\":\"Owner attestation, never an internal-name classifier.\",\"type\":\"boolean\"},\"fixed_oracle\":{\"description\":\"Separate owner attestation; approval or observability cannot imply it.\",\"type\":\"boolean\"}},\"additionalProperties\":false,\"required\":[\"id\",\"trigger\",\"observer\",\"verb\",\"outcome\",\"kind\",\"observable\",\"fixed_oracle\"]},\"Verb\":{\"type\":\"string\",\"enum\":[\"sees\",\"gets\",\"is refused\"]},\"Kind\":{\"type\":\"string\",\"enum\":[\"literal\",\"property\"]},\"Approval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"submission\":{\"anyOf\":[{\"$ref\":\"#/$defs/Submission\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"approved\"]}}},\"persisted\":false}"}],"structuredContent":{"status":"ok","operation":"context-intake","phase":2,"context":"# Phase 2: Parcel delivery\n\n## Scope boundary\n\nDeliver one parcel argument, reject blank input, and preserve the no-argument ready output.\n\n## Durable decisions\n\n- D-01. Use Python 3 and keep the CLI output byte-stable.\n\n## Decisions\n\n- D-02. The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline.\n\n## Truths\n\n- T1. When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.\n- T2. When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.\n- T3. When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.\n\n## Flagged assumptions\n\n- One supplied argument is in scope; multiple arguments are outside this phase.\n","roadmap":"# Pilot parcel project\n\n## Phases\n\n- [x] **Phase 1: Seed CLI** - Print ready with no arguments.\n- [ ] **Phase 2: Parcel delivery** - Deliver a parcel, reject blank input, and retain the ready output.\n\n## Phase Details\n\n### Phase 1: Seed CLI\n**Goal:** A Python CLI prints ready with no arguments.\n\n### Phase 2: Parcel delivery\n**Goal:** Deliver a parcel, reject blank input, and retain the ready output.\n**Depends on:** Phase 1\n","contract":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"Apply","oneOf":[{"type":"object","properties":{"submission":{"$ref":"#/$defs/Submission"},"approval":{"anyOf":[{"$ref":"#/$defs/Approval"},{"type":"null"}]},"operation":{"type":"string","const":"context-submit"}},"additionalProperties":false,"required":["operation","submission"]}],"$defs":{"Submission":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"title":{"type":"string"},"scope":{"type":"string"},"durable_decisions":{"type":"array","items":{"$ref":"#/$defs/Decision"}},"decisions":{"type":"array","items":{"$ref":"#/$defs/Decision"}},"assumptions":{"type":"array","items":{"type":"string"}},"truths":{"type":"array","items":{"$ref":"#/$defs/TruthSlots"}}},"additionalProperties":false,"required":["phase","title","scope","durable_decisions","decisions","assumptions","truths"]},"Decision":{"type":"object","properties":{"id":{"type":"string"},"text":{"type":"string"}},"additionalProperties":false,"required":["id","text"]},"TruthSlots":{"type":"object","properties":{"id":{"type":"string"},"trigger":{"type":"string"},"observer":{"description":"One party: the literal separators \" and \", \" & \", comma and semicolon are refused.","type":"string"},"verb":{"$ref":"#/$defs/Verb"},"outcome":{"type":"string"},"kind":{"$ref":"#/$defs/Kind"},"observable":{"description":"Owner attestation, never an internal-name classifier.","type":"boolean"},"fixed_oracle":{"description":"Separate owner attestation; approval or observability cannot imply it.","type":"boolean"}},"additionalProperties":false,"required":["id","trigger","observer","verb","outcome","kind","observable","fixed_oracle"]},"Verb":{"type":"string","enum":["sees","gets","is refused"]},"Kind":{"type":"string","enum":["literal","property"]},"Approval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"submission":{"anyOf":[{"$ref":"#/$defs/Submission"},{"type":"null"}]}},"additionalProperties":false,"required":["approved"]}}},"persisted":false},"isError":false}}
`````


### Event 41 — mcp-request — 2026-09-10T19:00:12.951419+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 6, "params": {"name": "cadence_query", "arguments": {"operation": "plan-read", "phase_address": "2"}}}
`````


### Event 42 — mcp-response — 2026-09-10T19:00:12.955174+00:00


`````json
{"jsonrpc":"2.0","id":6,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"plan-read\",\"phase\":\"2\",\"persisted\":false,\"plans\":[],\"inventory\":{\"occupied\":[],\"high_water\":0,\"basis\":\"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8\",\"documents\":{},\"provenance\":{}},\"targets\":[],\"occurrence\":\"active-cycle:phase:2\",\"native_truths_approved\":true,\"next\":\"plan-submit\",\"native\":null,\"map_history\":[],\"legacy_readiness\":\"legacy-input\",\"readiness\":\"provisional-authoring\",\"contract\":{\"$schema\":\"https://json-schema.org/draft/2020-12/schema\",\"title\":\"Apply\",\"oneOf\":[{\"type\":\"object\",\"properties\":{\"submission\":{\"$ref\":\"#/$defs/Submission\"},\"approval\":{\"anyOf\":[{\"$ref\":\"#/$defs/Approval\"},{\"type\":\"null\"}]},\"operation\":{\"type\":\"string\",\"const\":\"plan-submit\"}},\"additionalProperties\":false,\"required\":[\"operation\",\"submission\"]}],\"$defs\":{\"Submission\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"occurrence\":{\"description\":\"Explicit active-cycle lifetime, established only by approved publication.\",\"type\":\"string\"},\"request_id\":{\"type\":\"string\"},\"inventory_basis\":{\"type\":\"string\"},\"plans\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Entry\"}}},\"additionalProperties\":false,\"required\":[\"phase\",\"occurrence\",\"request_id\",\"inventory_basis\",\"plans\"]},\"Entry\":{\"type\":\"object\",\"properties\":{\"target\":{\"$ref\":\"#/$defs/Identity\"},\"content\":{\"$ref\":\"#/$defs/Content\"},\"replacement\":{\"anyOf\":[{\"$ref\":\"#/$defs/ReplacementApproval\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"target\",\"content\"]},\"Identity\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"plan\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1}},\"additionalProperties\":false,\"required\":[\"phase\",\"plan\"]},\"Content\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"plan\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"requirements\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"files\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"directories\":{\"type\":\"array\",\"items\":{\"type\":\"string\"},\"default\":[]},\"execution\":{\"$ref\":\"#/$defs/Execution\"},\"body\":{\"description\":\"UTF-8 Markdown, including its original line endings and final newline.\",\"type\":\"string\"},\"evidence_map\":{\"description\":\"Absence is retained only for historical phase-27 publications.\",\"anyOf\":[{\"$ref\":\"#/$defs/Map\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"phase\",\"plan\",\"requirements\",\"files\",\"execution\",\"body\"]},\"Execution\":{\"type\":\"object\",\"properties\":{\"schema\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":0},\"suite\":{\"type\":\"string\"},\"tasks\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/TaskSpec\"}}},\"additionalProperties\":false,\"required\":[\"schema\",\"suite\",\"tasks\"]},\"TaskSpec\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"verify\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}},\"additionalProperties\":false,\"required\":[\"id\",\"verify\"]},\"Map\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Item\"}},\"mode\":{\"type\":\"string\",\"const\":\"attached\"}},\"additionalProperties\":false,\"required\":[\"mode\",\"items\"]},{\"type\":\"object\",\"properties\":{\"mode\":{\"type\":\"string\",\"const\":\"provisional\"}},\"required\":[\"mode\"],\"additionalProperties\":false}]},\"Item\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Check\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"check\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Artifact\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"artifact\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Link\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"link\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Observation\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"observation\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]}]},\"Check\":{\"type\":\"object\",\"properties\":{\"command\":{\"type\":\"string\"},\"expected\":{\"$ref\":\"#/$defs/Expected\"},\"test\":{\"$ref\":\"#/$defs/Test\"},\"setup\":{\"type\":\"string\"},\"call\":{\"type\":\"string\"},\"boundary\":{\"type\":\"string\"},\"fakes\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}},\"additionalProperties\":false,\"required\":[\"command\",\"expected\",\"test\",\"setup\",\"call\",\"boundary\",\"fakes\"]},\"Expected\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"kind\":{\"type\":\"string\",\"const\":\"literal\"},\"value\":{\"type\":\"string\"}},\"required\":[\"kind\",\"value\"],\"additionalProperties\":false},{\"type\":\"object\",\"properties\":{\"kind\":{\"type\":\"string\",\"const\":\"property\"},\"value\":{\"type\":\"string\"}},\"required\":[\"kind\",\"value\"],\"additionalProperties\":false}]},\"Test\":{\"type\":\"object\",\"properties\":{\"file\":{\"type\":\"string\"},\"function\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"file\",\"function\"]},\"Association\":{\"type\":\"object\",\"properties\":{\"truth_id\":{\"type\":\"string\"},\"truth_version\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":0},\"reason\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"truth_id\",\"truth_version\",\"reason\"]},\"Artifact\":{\"type\":\"object\",\"properties\":{\"locators\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"substance\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"locators\",\"substance\"]},\"Link\":{\"type\":\"object\",\"properties\":{\"caller\":{\"type\":\"string\"},\"callee\":{\"type\":\"string\"},\"value\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"caller\",\"callee\",\"value\"]},\"Observation\":{\"type\":\"object\",\"properties\":{\"episode\":{\"type\":\"string\"},\"specification\":{\"$ref\":\"#/$defs/Specification\"},\"status\":{\"$ref\":\"#/$defs/Pending\"}},\"additionalProperties\":false,\"required\":[\"episode\",\"specification\",\"status\"]},\"Specification\":{\"type\":\"object\",\"properties\":{\"source\":{\"type\":\"string\"},\"document\":{\"type\":\"string\"},\"approved_by\":{\"type\":\"string\"},\"approved_at\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"source\",\"document\",\"approved_by\",\"approved_at\"]},\"Pending\":{\"type\":\"string\",\"enum\":[\"pending\"]},\"ReplacementApproval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"target\":{\"$ref\":\"#/$defs/Identity\"},\"old_revision\":{\"type\":\"string\"},\"old_document\":{\"type\":\"string\"},\"content\":{\"$ref\":\"#/$defs/Content\"}},\"additionalProperties\":false,\"required\":[\"approved\",\"target\",\"old_revision\",\"old_document\",\"content\"]},\"Approval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"submission\":{\"anyOf\":[{\"$ref\":\"#/$defs/Submission\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"approved\"]}}}}"}],"structuredContent":{"status":"ok","operation":"plan-read","phase":"2","persisted":false,"plans":[],"inventory":{"occupied":[],"high_water":0,"basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","documents":{},"provenance":{}},"targets":[],"occurrence":"active-cycle:phase:2","native_truths_approved":true,"next":"plan-submit","native":null,"map_history":[],"legacy_readiness":"legacy-input","readiness":"provisional-authoring","contract":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"Apply","oneOf":[{"type":"object","properties":{"submission":{"$ref":"#/$defs/Submission"},"approval":{"anyOf":[{"$ref":"#/$defs/Approval"},{"type":"null"}]},"operation":{"type":"string","const":"plan-submit"}},"additionalProperties":false,"required":["operation","submission"]}],"$defs":{"Submission":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"occurrence":{"description":"Explicit active-cycle lifetime, established only by approved publication.","type":"string"},"request_id":{"type":"string"},"inventory_basis":{"type":"string"},"plans":{"type":"array","items":{"$ref":"#/$defs/Entry"}}},"additionalProperties":false,"required":["phase","occurrence","request_id","inventory_basis","plans"]},"Entry":{"type":"object","properties":{"target":{"$ref":"#/$defs/Identity"},"content":{"$ref":"#/$defs/Content"},"replacement":{"anyOf":[{"$ref":"#/$defs/ReplacementApproval"},{"type":"null"}]}},"additionalProperties":false,"required":["target","content"]},"Identity":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"plan":{"type":"integer","format":"uint32","minimum":1}},"additionalProperties":false,"required":["phase","plan"]},"Content":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"plan":{"type":"integer","format":"uint32","minimum":1},"requirements":{"type":"array","items":{"type":"string"}},"files":{"type":"array","items":{"type":"string"}},"directories":{"type":"array","items":{"type":"string"},"default":[]},"execution":{"$ref":"#/$defs/Execution"},"body":{"description":"UTF-8 Markdown, including its original line endings and final newline.","type":"string"},"evidence_map":{"description":"Absence is retained only for historical phase-27 publications.","anyOf":[{"$ref":"#/$defs/Map"},{"type":"null"}]}},"additionalProperties":false,"required":["phase","plan","requirements","files","execution","body"]},"Execution":{"type":"object","properties":{"schema":{"type":"integer","format":"uint32","minimum":0},"suite":{"type":"string"},"tasks":{"type":"array","items":{"$ref":"#/$defs/TaskSpec"}}},"additionalProperties":false,"required":["schema","suite","tasks"]},"TaskSpec":{"type":"object","properties":{"id":{"type":"string"},"verify":{"type":"array","items":{"type":"string"}}},"additionalProperties":false,"required":["id","verify"]},"Map":{"oneOf":[{"type":"object","properties":{"items":{"type":"array","items":{"$ref":"#/$defs/Item"}},"mode":{"type":"string","const":"attached"}},"additionalProperties":false,"required":["mode","items"]},{"type":"object","properties":{"mode":{"type":"string","const":"provisional"}},"required":["mode"],"additionalProperties":false}]},"Item":{"oneOf":[{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Check"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"check"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Artifact"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"artifact"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Link"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"link"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Observation"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"observation"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]}]},"Check":{"type":"object","properties":{"command":{"type":"string"},"expected":{"$ref":"#/$defs/Expected"},"test":{"$ref":"#/$defs/Test"},"setup":{"type":"string"},"call":{"type":"string"},"boundary":{"type":"string"},"fakes":{"type":"array","items":{"type":"string"}}},"additionalProperties":false,"required":["command","expected","test","setup","call","boundary","fakes"]},"Expected":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"literal"},"value":{"type":"string"}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"property"},"value":{"type":"string"}},"required":["kind","value"],"additionalProperties":false}]},"Test":{"type":"object","properties":{"file":{"type":"string"},"function":{"type":"string"}},"additionalProperties":false,"required":["file","function"]},"Association":{"type":"object","properties":{"truth_id":{"type":"string"},"truth_version":{"type":"integer","format":"uint32","minimum":0},"reason":{"type":"string"}},"additionalProperties":false,"required":["truth_id","truth_version","reason"]},"Artifact":{"type":"object","properties":{"locators":{"type":"array","items":{"type":"string"}},"substance":{"type":"string"}},"additionalProperties":false,"required":["locators","substance"]},"Link":{"type":"object","properties":{"caller":{"type":"string"},"callee":{"type":"string"},"value":{"type":"string"}},"additionalProperties":false,"required":["caller","callee","value"]},"Observation":{"type":"object","properties":{"episode":{"type":"string"},"specification":{"$ref":"#/$defs/Specification"},"status":{"$ref":"#/$defs/Pending"}},"additionalProperties":false,"required":["episode","specification","status"]},"Specification":{"type":"object","properties":{"source":{"type":"string"},"document":{"type":"string"},"approved_by":{"type":"string"},"approved_at":{"type":"string"}},"additionalProperties":false,"required":["source","document","approved_by","approved_at"]},"Pending":{"type":"string","enum":["pending"]},"ReplacementApproval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"target":{"$ref":"#/$defs/Identity"},"old_revision":{"type":"string"},"old_document":{"type":"string"},"content":{"$ref":"#/$defs/Content"}},"additionalProperties":false,"required":["approved","target","old_revision","old_document","content"]},"Approval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"submission":{"anyOf":[{"$ref":"#/$defs/Submission"},{"type":"null"}]}},"additionalProperties":false,"required":["approved"]}}}},"isError":false}}
`````


### Event 43 — mcp-request — 2026-09-10T19:00:12.955701+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 7, "params": {"name": "cadence_query", "arguments": {"operation": "evidence-read", "phase": 2}}}
`````


### Event 44 — mcp-response — 2026-09-10T19:00:12.957600+00:00


`````json
{"jsonrpc":"2.0","id":7,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"evidence-read\",\"schema\":\"acceptance-map-view-1\",\"phase\":2,\"occurrence\":\"active-cycle:phase:2\",\"truths\":[{\"id\":\"T1\",\"version\":1,\"text\":\"When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.\",\"kind\":\"literal\"},{\"id\":\"T2\",\"version\":1,\"text\":\"When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.\",\"kind\":\"property\"},{\"id\":\"T3\",\"version\":1,\"text\":\"When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.\",\"kind\":\"literal\"}],\"contributions\":[],\"items\":[],\"associations\":[],\"aliases\":[],\"history\":[],\"coverage\":{\"uncovered\":[\"T1\",\"T2\",\"T3\"],\"without_check\":[\"T1\",\"T2\",\"T3\"],\"checks\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"item_ids\":[]},{\"truth_id\":\"T2\",\"truth_version\":1,\"item_ids\":[]},{\"truth_id\":\"T3\",\"truth_version\":1,\"item_ids\":[]}]},\"readiness\":\"provisional-authoring\",\"projections\":[],\"coherence\":\"consistent\",\"input_digest\":\"22982523409a2f7b1f3734fd51a83a51269225a0d3707448467d45157b86572b\"}"}],"structuredContent":{"status":"ok","operation":"evidence-read","schema":"acceptance-map-view-1","phase":2,"occurrence":"active-cycle:phase:2","truths":[{"id":"T1","version":1,"text":"When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.","kind":"literal"},{"id":"T2","version":1,"text":"When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.","kind":"property"},{"id":"T3","version":1,"text":"When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.","kind":"literal"}],"contributions":[],"items":[],"associations":[],"aliases":[],"history":[],"coverage":{"uncovered":["T1","T2","T3"],"without_check":["T1","T2","T3"],"checks":[{"truth_id":"T1","truth_version":1,"item_ids":[]},{"truth_id":"T2","truth_version":1,"item_ids":[]},{"truth_id":"T3","truth_version":1,"item_ids":[]}]},"readiness":"provisional-authoring","projections":[],"coherence":"consistent","input_digest":"22982523409a2f7b1f3734fd51a83a51269225a0d3707448467d45157b86572b"},"isError":false}}
`````


### Event 45 — command — 2026-09-10T19:00:12.958399+00:00


`````json
{
  "argv": [
    "find",
    ".",
    "-path",
    "./.git",
    "-prune",
    "-o",
    "-type",
    "f",
    "-print"
  ],
  "cwd": "/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project",
  "exit": 0,
  "stdout": "./.planning/state.json\n./.planning/phases/2/CONTEXT.md\n./.planning/decisions.jsonl\n./.planning/items.jsonl\n./.planning/config.v4.json\n./.planning/config.json\n./.planning/ROADMAP.md\n./main.py\n",
  "stderr": ""
}
`````


### Event 46 — code-read — 2026-09-10T19:00:12.958479+00:00


`````text
print("ready")
`````


### Event 47 — model — 2026-09-10T19:00:45.827915+00:00


`````text
The project has only main.py with print("ready"); there are no prior plans, SUMMARY, UAT or reports. I propose one plan with three sequential tasks in main.py and a new test_parcel.py, one CLI subprocess check per approved truth, artifacts for those two files, and one sender-to-receiver link for T1. Any implementation preference?
`````


### Event 48 — owner — 2026-09-10T19:00:45.827965+00:00


`````text
Keep it small: sender and receiver functions in main.py, and unittest subprocess checks in test_parcel.py.
`````


### Event 49 — model — 2026-09-10T19:00:45.827981+00:00


`````text
I will deliberately send one whitespace-only expected value and use package as the link value first, as the observation procedure requests. These are deliberate defects, not claims about the approved truths.
`````


### Event 50 — owner — 2026-09-10T19:00:45.827994+00:00


`````text
Yes. Show each refusal, then correct only the named defect.
`````


### Event 51 — snapshot — 2026-09-10T19:00:45.828600+00:00


`````json
{
  "name": "before-plan",
  "text": "# find .planning -print (sorted)\n.planning\n.planning/ROADMAP.md\n.planning/config.json\n.planning/config.v4.json\n.planning/decisions.jsonl\n.planning/items.jsonl\n.planning/phases\n.planning/phases/2\n.planning/phases/2/CONTEXT.md\n.planning/state.json\n# sha256 of every regular file\n568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md\n18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json\na54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl\n9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md\n775f2225962d83430b1fc6c45078b08b87667036c64c2ad9378799b22261d5c2  .planning/state.json\n"
}
`````


### Event 52 — mcp-request — 2026-09-10T19:00:45.828633+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 8, "params": {"name": "cadence_query", "arguments": {"operation": "plan-read", "phase_address": "2", "count": 1}}}
`````


### Event 53 — mcp-response — 2026-09-10T19:00:45.833012+00:00


`````json
{"jsonrpc":"2.0","id":8,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"plan-read\",\"phase\":\"2\",\"persisted\":false,\"plans\":[],\"inventory\":{\"occupied\":[],\"high_water\":0,\"basis\":\"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8\",\"documents\":{},\"provenance\":{}},\"targets\":[{\"phase\":2,\"plan\":1}],\"occurrence\":\"active-cycle:phase:2\",\"native_truths_approved\":true,\"next\":\"plan-submit\",\"native\":null,\"map_history\":[],\"legacy_readiness\":\"legacy-input\",\"readiness\":\"provisional-authoring\",\"contract\":{\"$schema\":\"https://json-schema.org/draft/2020-12/schema\",\"title\":\"Apply\",\"oneOf\":[{\"type\":\"object\",\"properties\":{\"submission\":{\"$ref\":\"#/$defs/Submission\"},\"approval\":{\"anyOf\":[{\"$ref\":\"#/$defs/Approval\"},{\"type\":\"null\"}]},\"operation\":{\"type\":\"string\",\"const\":\"plan-submit\"}},\"additionalProperties\":false,\"required\":[\"operation\",\"submission\"]}],\"$defs\":{\"Submission\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"occurrence\":{\"description\":\"Explicit active-cycle lifetime, established only by approved publication.\",\"type\":\"string\"},\"request_id\":{\"type\":\"string\"},\"inventory_basis\":{\"type\":\"string\"},\"plans\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Entry\"}}},\"additionalProperties\":false,\"required\":[\"phase\",\"occurrence\",\"request_id\",\"inventory_basis\",\"plans\"]},\"Entry\":{\"type\":\"object\",\"properties\":{\"target\":{\"$ref\":\"#/$defs/Identity\"},\"content\":{\"$ref\":\"#/$defs/Content\"},\"replacement\":{\"anyOf\":[{\"$ref\":\"#/$defs/ReplacementApproval\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"target\",\"content\"]},\"Identity\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"plan\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1}},\"additionalProperties\":false,\"required\":[\"phase\",\"plan\"]},\"Content\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"plan\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"requirements\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"files\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"directories\":{\"type\":\"array\",\"items\":{\"type\":\"string\"},\"default\":[]},\"execution\":{\"$ref\":\"#/$defs/Execution\"},\"body\":{\"description\":\"UTF-8 Markdown, including its original line endings and final newline.\",\"type\":\"string\"},\"evidence_map\":{\"description\":\"Absence is retained only for historical phase-27 publications.\",\"anyOf\":[{\"$ref\":\"#/$defs/Map\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"phase\",\"plan\",\"requirements\",\"files\",\"execution\",\"body\"]},\"Execution\":{\"type\":\"object\",\"properties\":{\"schema\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":0},\"suite\":{\"type\":\"string\"},\"tasks\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/TaskSpec\"}}},\"additionalProperties\":false,\"required\":[\"schema\",\"suite\",\"tasks\"]},\"TaskSpec\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"verify\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}},\"additionalProperties\":false,\"required\":[\"id\",\"verify\"]},\"Map\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Item\"}},\"mode\":{\"type\":\"string\",\"const\":\"attached\"}},\"additionalProperties\":false,\"required\":[\"mode\",\"items\"]},{\"type\":\"object\",\"properties\":{\"mode\":{\"type\":\"string\",\"const\":\"provisional\"}},\"required\":[\"mode\"],\"additionalProperties\":false}]},\"Item\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Check\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"check\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Artifact\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"artifact\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Link\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"link\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Observation\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"observation\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]}]},\"Check\":{\"type\":\"object\",\"properties\":{\"command\":{\"type\":\"string\"},\"expected\":{\"$ref\":\"#/$defs/Expected\"},\"test\":{\"$ref\":\"#/$defs/Test\"},\"setup\":{\"type\":\"string\"},\"call\":{\"type\":\"string\"},\"boundary\":{\"type\":\"string\"},\"fakes\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}},\"additionalProperties\":false,\"required\":[\"command\",\"expected\",\"test\",\"setup\",\"call\",\"boundary\",\"fakes\"]},\"Expected\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"kind\":{\"type\":\"string\",\"const\":\"literal\"},\"value\":{\"type\":\"string\"}},\"required\":[\"kind\",\"value\"],\"additionalProperties\":false},{\"type\":\"object\",\"properties\":{\"kind\":{\"type\":\"string\",\"const\":\"property\"},\"value\":{\"type\":\"string\"}},\"required\":[\"kind\",\"value\"],\"additionalProperties\":false}]},\"Test\":{\"type\":\"object\",\"properties\":{\"file\":{\"type\":\"string\"},\"function\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"file\",\"function\"]},\"Association\":{\"type\":\"object\",\"properties\":{\"truth_id\":{\"type\":\"string\"},\"truth_version\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":0},\"reason\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"truth_id\",\"truth_version\",\"reason\"]},\"Artifact\":{\"type\":\"object\",\"properties\":{\"locators\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"substance\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"locators\",\"substance\"]},\"Link\":{\"type\":\"object\",\"properties\":{\"caller\":{\"type\":\"string\"},\"callee\":{\"type\":\"string\"},\"value\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"caller\",\"callee\",\"value\"]},\"Observation\":{\"type\":\"object\",\"properties\":{\"episode\":{\"type\":\"string\"},\"specification\":{\"$ref\":\"#/$defs/Specification\"},\"status\":{\"$ref\":\"#/$defs/Pending\"}},\"additionalProperties\":false,\"required\":[\"episode\",\"specification\",\"status\"]},\"Specification\":{\"type\":\"object\",\"properties\":{\"source\":{\"type\":\"string\"},\"document\":{\"type\":\"string\"},\"approved_by\":{\"type\":\"string\"},\"approved_at\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"source\",\"document\",\"approved_by\",\"approved_at\"]},\"Pending\":{\"type\":\"string\",\"enum\":[\"pending\"]},\"ReplacementApproval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"target\":{\"$ref\":\"#/$defs/Identity\"},\"old_revision\":{\"type\":\"string\"},\"old_document\":{\"type\":\"string\"},\"content\":{\"$ref\":\"#/$defs/Content\"}},\"additionalProperties\":false,\"required\":[\"approved\",\"target\",\"old_revision\",\"old_document\",\"content\"]},\"Approval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"submission\":{\"anyOf\":[{\"$ref\":\"#/$defs/Submission\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"approved\"]}}}}"}],"structuredContent":{"status":"ok","operation":"plan-read","phase":"2","persisted":false,"plans":[],"inventory":{"occupied":[],"high_water":0,"basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","documents":{},"provenance":{}},"targets":[{"phase":2,"plan":1}],"occurrence":"active-cycle:phase:2","native_truths_approved":true,"next":"plan-submit","native":null,"map_history":[],"legacy_readiness":"legacy-input","readiness":"provisional-authoring","contract":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"Apply","oneOf":[{"type":"object","properties":{"submission":{"$ref":"#/$defs/Submission"},"approval":{"anyOf":[{"$ref":"#/$defs/Approval"},{"type":"null"}]},"operation":{"type":"string","const":"plan-submit"}},"additionalProperties":false,"required":["operation","submission"]}],"$defs":{"Submission":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"occurrence":{"description":"Explicit active-cycle lifetime, established only by approved publication.","type":"string"},"request_id":{"type":"string"},"inventory_basis":{"type":"string"},"plans":{"type":"array","items":{"$ref":"#/$defs/Entry"}}},"additionalProperties":false,"required":["phase","occurrence","request_id","inventory_basis","plans"]},"Entry":{"type":"object","properties":{"target":{"$ref":"#/$defs/Identity"},"content":{"$ref":"#/$defs/Content"},"replacement":{"anyOf":[{"$ref":"#/$defs/ReplacementApproval"},{"type":"null"}]}},"additionalProperties":false,"required":["target","content"]},"Identity":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"plan":{"type":"integer","format":"uint32","minimum":1}},"additionalProperties":false,"required":["phase","plan"]},"Content":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"plan":{"type":"integer","format":"uint32","minimum":1},"requirements":{"type":"array","items":{"type":"string"}},"files":{"type":"array","items":{"type":"string"}},"directories":{"type":"array","items":{"type":"string"},"default":[]},"execution":{"$ref":"#/$defs/Execution"},"body":{"description":"UTF-8 Markdown, including its original line endings and final newline.","type":"string"},"evidence_map":{"description":"Absence is retained only for historical phase-27 publications.","anyOf":[{"$ref":"#/$defs/Map"},{"type":"null"}]}},"additionalProperties":false,"required":["phase","plan","requirements","files","execution","body"]},"Execution":{"type":"object","properties":{"schema":{"type":"integer","format":"uint32","minimum":0},"suite":{"type":"string"},"tasks":{"type":"array","items":{"$ref":"#/$defs/TaskSpec"}}},"additionalProperties":false,"required":["schema","suite","tasks"]},"TaskSpec":{"type":"object","properties":{"id":{"type":"string"},"verify":{"type":"array","items":{"type":"string"}}},"additionalProperties":false,"required":["id","verify"]},"Map":{"oneOf":[{"type":"object","properties":{"items":{"type":"array","items":{"$ref":"#/$defs/Item"}},"mode":{"type":"string","const":"attached"}},"additionalProperties":false,"required":["mode","items"]},{"type":"object","properties":{"mode":{"type":"string","const":"provisional"}},"required":["mode"],"additionalProperties":false}]},"Item":{"oneOf":[{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Check"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"check"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Artifact"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"artifact"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Link"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"link"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Observation"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"observation"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]}]},"Check":{"type":"object","properties":{"command":{"type":"string"},"expected":{"$ref":"#/$defs/Expected"},"test":{"$ref":"#/$defs/Test"},"setup":{"type":"string"},"call":{"type":"string"},"boundary":{"type":"string"},"fakes":{"type":"array","items":{"type":"string"}}},"additionalProperties":false,"required":["command","expected","test","setup","call","boundary","fakes"]},"Expected":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"literal"},"value":{"type":"string"}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"property"},"value":{"type":"string"}},"required":["kind","value"],"additionalProperties":false}]},"Test":{"type":"object","properties":{"file":{"type":"string"},"function":{"type":"string"}},"additionalProperties":false,"required":["file","function"]},"Association":{"type":"object","properties":{"truth_id":{"type":"string"},"truth_version":{"type":"integer","format":"uint32","minimum":0},"reason":{"type":"string"}},"additionalProperties":false,"required":["truth_id","truth_version","reason"]},"Artifact":{"type":"object","properties":{"locators":{"type":"array","items":{"type":"string"}},"substance":{"type":"string"}},"additionalProperties":false,"required":["locators","substance"]},"Link":{"type":"object","properties":{"caller":{"type":"string"},"callee":{"type":"string"},"value":{"type":"string"}},"additionalProperties":false,"required":["caller","callee","value"]},"Observation":{"type":"object","properties":{"episode":{"type":"string"},"specification":{"$ref":"#/$defs/Specification"},"status":{"$ref":"#/$defs/Pending"}},"additionalProperties":false,"required":["episode","specification","status"]},"Specification":{"type":"object","properties":{"source":{"type":"string"},"document":{"type":"string"},"approved_by":{"type":"string"},"approved_at":{"type":"string"}},"additionalProperties":false,"required":["source","document","approved_by","approved_at"]},"Pending":{"type":"string","enum":["pending"]},"ReplacementApproval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"target":{"$ref":"#/$defs/Identity"},"old_revision":{"type":"string"},"old_document":{"type":"string"},"content":{"$ref":"#/$defs/Content"}},"additionalProperties":false,"required":["approved","target","old_revision","old_document","content"]},"Approval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"submission":{"anyOf":[{"$ref":"#/$defs/Submission"},{"type":"null"}]}},"additionalProperties":false,"required":["approved"]}}}},"isError":false}}
`````


### Event 54 — mcp-request — 2026-09-10T19:00:45.833408+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 9, "params": {"name": "cadence_query", "arguments": {"operation": "plan-read", "phase_address": "2", "submission": {"phase": 2, "occurrence": "active-cycle:phase:2", "request_id": "pilot29-parcel-plan-001", "inventory_basis": "965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8", "plans": [{"target": {"phase": 2, "plan": 1}, "content": {"phase": 2, "plan": 1, "requirements": ["T1", "T2", "T3"], "files": ["main.py", "test_parcel.py"], "execution": {"schema": 1, "suite": "python3 -m unittest", "tasks": [{"id": "test_delivery", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_delivery"]}, {"id": "test_blank", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_blank"]}, {"id": "test_ready", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]}, "body": "# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n", "evidence_map": {"mode": "attached", "items": [{"kind": "check", "id": "P2-T1-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_delivery", "expected": {"kind": "literal", "value": " \t\n "}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_delivery"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Dropping or changing the supplied parcel breaks the delivery output.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T2-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_blank", "expected": {"kind": "property", "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_blank"}, "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.", "call": "Run [python3, main.py, blank_value] for every subtest.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Accepting blank input or writing the error to stdout breaks the error output.", "associations": [{"truth_id": "T2", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T3-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_ready", "expected": {"kind": "literal", "value": "stdout is exactly b\"ready\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_ready"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py] with no arguments.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Requiring an argument or changing ready breaks the legacy output.", "associations": [{"truth_id": "T3", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "artifact", "id": "P2-A-CLI", "spec": {"locators": ["main.py"], "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."}, "reason": "Removing any of these CLI branches removes its promised behavior.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The CLI implements T1 at its external output boundary."}, {"truth_id": "T2", "truth_version": 1, "reason": "The CLI implements T2 at its external output boundary."}, {"truth_id": "T3", "truth_version": 1, "reason": "The CLI implements T3 at its external output boundary."}]}, {"kind": "artifact", "id": "P2-A-TEST", "spec": {"locators": ["test_parcel.py"], "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."}, "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T1."}, {"truth_id": "T2", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T2."}, {"truth_id": "T3", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T3."}]}, {"kind": "link", "id": "P2-T1-L", "spec": {"caller": "main.py::sender", "callee": "main.py::receiver", "value": "package"}, "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}}}}
`````


### Event 55 — mcp-response — 2026-09-10T19:00:45.866221+00:00


`````json
{"jsonrpc":"2.0","id":9,"result":{"content":[{"type":"text","text":"{\"status\":\"refused\",\"code\":\"invalid-plan\",\"reason\":\"phase 2 item P2-T1-C needs nonblank expected.value\",\"rule\":\"check-expected\",\"slot\":\"submission.plans[0].content.evidence_map.items[0].spec.expected.value\",\"phase\":2,\"entry\":0,\"id\":\"P2-T1-C\"}"}],"structuredContent":{"status":"refused","code":"invalid-plan","reason":"phase 2 item P2-T1-C needs nonblank expected.value","rule":"check-expected","slot":"submission.plans[0].content.evidence_map.items[0].spec.expected.value","phase":2,"entry":0,"id":"P2-T1-C"},"isError":false}}
`````


### Event 56 — snapshot — 2026-09-10T19:00:45.866828+00:00


`````json
{
  "name": "after-first-refusal",
  "text": "# find .planning -print (sorted)\n.planning\n.planning/ROADMAP.md\n.planning/config.json\n.planning/config.v4.json\n.planning/decisions.jsonl\n.planning/items.jsonl\n.planning/phases\n.planning/phases/2\n.planning/phases/2/CONTEXT.md\n.planning/state.json\n# sha256 of every regular file\n568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md\n18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json\na54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl\n9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md\n775f2225962d83430b1fc6c45078b08b87667036c64c2ad9378799b22261d5c2  .planning/state.json\n"
}
`````


### Event 57 — snapshot-diff — 2026-09-10T19:00:45.866910+00:00


`````json
{
  "name": "first-refusal",
  "diff": "",
  "byte_identical": true
}
`````


### Event 58 — model — 2026-09-10T19:00:56.530983+00:00


`````text
The binary returned check-expected for P2-T1-C at submission.plans[0].content.evidence_map.items[0].spec.expected.value: phase 2 item P2-T1-C needs nonblank expected.value. The planning tree is byte-identical to the baseline. I will replace only that blank value with the literal stdout expectation.
`````


### Event 59 — owner — 2026-09-10T19:00:56.531032+00:00


`````text
Use stdout exactly b"delivered box-17\n". Leave the link unchanged for the next submission.
`````


### Event 60 — mcp-request — 2026-09-10T19:00:56.531145+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 10, "params": {"name": "cadence_query", "arguments": {"operation": "plan-read", "phase_address": "2", "submission": {"phase": 2, "occurrence": "active-cycle:phase:2", "request_id": "pilot29-parcel-plan-001", "inventory_basis": "965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8", "plans": [{"target": {"phase": 2, "plan": 1}, "content": {"phase": 2, "plan": 1, "requirements": ["T1", "T2", "T3"], "files": ["main.py", "test_parcel.py"], "execution": {"schema": 1, "suite": "python3 -m unittest", "tasks": [{"id": "test_delivery", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_delivery"]}, {"id": "test_blank", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_blank"]}, {"id": "test_ready", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]}, "body": "# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n", "evidence_map": {"mode": "attached", "items": [{"kind": "check", "id": "P2-T1-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_delivery", "expected": {"kind": "literal", "value": "stdout is exactly b\"delivered box-17\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_delivery"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Dropping or changing the supplied parcel breaks the delivery output.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T2-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_blank", "expected": {"kind": "property", "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_blank"}, "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.", "call": "Run [python3, main.py, blank_value] for every subtest.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Accepting blank input or writing the error to stdout breaks the error output.", "associations": [{"truth_id": "T2", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T3-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_ready", "expected": {"kind": "literal", "value": "stdout is exactly b\"ready\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_ready"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py] with no arguments.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Requiring an argument or changing ready breaks the legacy output.", "associations": [{"truth_id": "T3", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "artifact", "id": "P2-A-CLI", "spec": {"locators": ["main.py"], "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."}, "reason": "Removing any of these CLI branches removes its promised behavior.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The CLI implements T1 at its external output boundary."}, {"truth_id": "T2", "truth_version": 1, "reason": "The CLI implements T2 at its external output boundary."}, {"truth_id": "T3", "truth_version": 1, "reason": "The CLI implements T3 at its external output boundary."}]}, {"kind": "artifact", "id": "P2-A-TEST", "spec": {"locators": ["test_parcel.py"], "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."}, "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T1."}, {"truth_id": "T2", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T2."}, {"truth_id": "T3", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T3."}]}, {"kind": "link", "id": "P2-T1-L", "spec": {"caller": "main.py::sender", "callee": "main.py::receiver", "value": "package"}, "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}}}}
`````


### Event 61 — mcp-response — 2026-09-10T19:00:56.560844+00:00


`````json
{"jsonrpc":"2.0","id":10,"result":{"content":[{"type":"text","text":"{\"status\":\"refused\",\"code\":\"invalid-plan\",\"reason\":\"phase 2 link P2-T1-L value \\\"package\\\", associated truth T1 version 1: value is absent under the exact individual-slot lexical rule\",\"rule\":\"link-value-not-named\",\"slot\":\"submission.plans[0].content.evidence_map.items[5].spec.value\",\"phase\":2,\"entry\":0,\"id\":\"P2-T1-L\",\"details\":{\"truth_id\":\"T1\",\"truth_version\":1,\"association_slot\":\"submission.plans[0].content.evidence_map.items[5].associations[0]\"}}"}],"structuredContent":{"status":"refused","code":"invalid-plan","reason":"phase 2 link P2-T1-L value \"package\", associated truth T1 version 1: value is absent under the exact individual-slot lexical rule","rule":"link-value-not-named","slot":"submission.plans[0].content.evidence_map.items[5].spec.value","phase":2,"entry":0,"id":"P2-T1-L","details":{"truth_id":"T1","truth_version":1,"association_slot":"submission.plans[0].content.evidence_map.items[5].associations[0]"}},"isError":false}}
`````


### Event 62 — snapshot — 2026-09-10T19:00:56.561565+00:00


`````json
{
  "name": "after-second-refusal",
  "text": "# find .planning -print (sorted)\n.planning\n.planning/ROADMAP.md\n.planning/config.json\n.planning/config.v4.json\n.planning/decisions.jsonl\n.planning/items.jsonl\n.planning/phases\n.planning/phases/2\n.planning/phases/2/CONTEXT.md\n.planning/state.json\n# sha256 of every regular file\n568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md\n18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json\na54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl\n9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md\n775f2225962d83430b1fc6c45078b08b87667036c64c2ad9378799b22261d5c2  .planning/state.json\n"
}
`````


### Event 63 — snapshot-diff — 2026-09-10T19:00:56.561649+00:00


`````json
{
  "name": "second-refusal",
  "diff": "",
  "byte_identical": true
}
`````


### Event 64 — model — 2026-09-10T19:01:04.477342+00:00


`````text
The binary returned link-value-not-named for P2-T1-L at submission.plans[0].content.evidence_map.items[5].spec.value. It names package and associated truth T1 version 1, saying the value is absent under the exact individual-slot lexical rule. Its details locate associations[0]. The tree is still byte-identical. T1 uses parcel in its trigger; I will change only the link value to parcel.
`````


### Event 65 — owner — 2026-09-10T19:01:04.477391+00:00


`````text
Use parcel, exactly as T1 names it. Keep the rest of the proposal.
`````


### Event 66 — mcp-request — 2026-09-10T19:01:04.477504+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 11, "params": {"name": "cadence_query", "arguments": {"operation": "plan-read", "phase_address": "2", "submission": {"phase": 2, "occurrence": "active-cycle:phase:2", "request_id": "pilot29-parcel-plan-001", "inventory_basis": "965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8", "plans": [{"target": {"phase": 2, "plan": 1}, "content": {"phase": 2, "plan": 1, "requirements": ["T1", "T2", "T3"], "files": ["main.py", "test_parcel.py"], "execution": {"schema": 1, "suite": "python3 -m unittest", "tasks": [{"id": "test_delivery", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_delivery"]}, {"id": "test_blank", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_blank"]}, {"id": "test_ready", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]}, "body": "# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n", "evidence_map": {"mode": "attached", "items": [{"kind": "check", "id": "P2-T1-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_delivery", "expected": {"kind": "literal", "value": "stdout is exactly b\"delivered box-17\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_delivery"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Dropping or changing the supplied parcel breaks the delivery output.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T2-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_blank", "expected": {"kind": "property", "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_blank"}, "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.", "call": "Run [python3, main.py, blank_value] for every subtest.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Accepting blank input or writing the error to stdout breaks the error output.", "associations": [{"truth_id": "T2", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T3-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_ready", "expected": {"kind": "literal", "value": "stdout is exactly b\"ready\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_ready"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py] with no arguments.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Requiring an argument or changing ready breaks the legacy output.", "associations": [{"truth_id": "T3", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "artifact", "id": "P2-A-CLI", "spec": {"locators": ["main.py"], "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."}, "reason": "Removing any of these CLI branches removes its promised behavior.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The CLI implements T1 at its external output boundary."}, {"truth_id": "T2", "truth_version": 1, "reason": "The CLI implements T2 at its external output boundary."}, {"truth_id": "T3", "truth_version": 1, "reason": "The CLI implements T3 at its external output boundary."}]}, {"kind": "artifact", "id": "P2-A-TEST", "spec": {"locators": ["test_parcel.py"], "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."}, "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T1."}, {"truth_id": "T2", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T2."}, {"truth_id": "T3", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T3."}]}, {"kind": "link", "id": "P2-T1-L", "spec": {"caller": "main.py::sender", "callee": "main.py::receiver", "value": "parcel"}, "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}}}}
`````


### Event 67 — mcp-response — 2026-09-10T19:01:04.512298+00:00


`````json
{"jsonrpc":"2.0","id":11,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"plan-read\",\"persisted\":false,\"submission\":{\"phase\":2,\"occurrence\":\"active-cycle:phase:2\",\"request_id\":\"pilot29-parcel-plan-001\",\"inventory_basis\":\"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8\",\"plans\":[{\"target\":{\"phase\":2,\"plan\":1},\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}}}]},\"documents\":[{\"identity\":{\"phase\":2,\"plan\":1},\"revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"document\":\"---\\nphase: 2\\nplan: 1\\nrequirements: [\\\"T1\\\",\\\"T2\\\",\\\"T3\\\"]\\nfiles: [\\\"main.py\\\",\\\"test_parcel.py\\\"]\\ndirectories: []\\nexecution: {\\\"schema\\\":1,\\\"suite\\\":\\\"python3 -m unittest\\\",\\\"tasks\\\":[{\\\"id\\\":\\\"test_delivery\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\"]},{\\\"id\\\":\\\"test_blank\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\"]},{\\\"id\\\":\\\"test_ready\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\"]}]}\\n---\\n# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"old_section\":null,\"section\":\"## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n\"}],\"readiness\":\"provisional-authoring\",\"coverage\":{\"uncovered\":[],\"without_check\":[]}}"}],"structuredContent":{"status":"ok","operation":"plan-read","persisted":false,"submission":{"phase":2,"occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","inventory_basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","plans":[{"target":{"phase":2,"plan":1},"content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]},"documents":[{"identity":{"phase":2,"plan":1},"revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","document":"---\nphase: 2\nplan: 1\nrequirements: [\"T1\",\"T2\",\"T3\"]\nfiles: [\"main.py\",\"test_parcel.py\"]\ndirectories: []\nexecution: {\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]}\n---\n# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","old_section":null,"section":"## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n"}],"readiness":"provisional-authoring","coverage":{"uncovered":[],"without_check":[]}},"isError":false}}
`````


### Event 68 — model — 2026-09-10T19:01:17.477713+00:00


`````text
The complete preview is read-only. Its old Evidence map section is null; its proposed canonical section contains the three checks, two artifacts, and the parcel link. Here is the exact final submission with the binary-rendered body and ordered identity:
{
  "phase": 2,
  "occurrence": "active-cycle:phase:2",
  "request_id": "pilot29-parcel-plan-001",
  "inventory_basis": "965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8",
  "plans": [
    {
      "target": {
        "phase": 2,
        "plan": 1
      },
      "content": {
        "phase": 2,
        "plan": 1,
        "requirements": [
          "T1",
          "T2",
          "T3"
        ],
        "files": [
          "main.py",
          "test_parcel.py"
        ],
        "directories": [],
        "execution": {
          "schema": 1,
          "suite": "python3 -m unittest",
          "tasks": [
            {
              "id": "test_delivery",
              "verify": [
                "python3 -m unittest test_parcel.ParcelTests.test_delivery"
              ]
            },
            {
              "id": "test_blank",
              "verify": [
                "python3 -m unittest test_parcel.ParcelTests.test_blank"
              ]
            },
            {
              "id": "test_ready",
              "verify": [
                "python3 -m unittest test_parcel.ParcelTests.test_ready"
              ]
            }
          ]
        },
        "body": "# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n",
        "evidence_map": {
          "mode": "attached",
          "items": [
            {
              "kind": "check",
              "id": "P2-T1-C",
              "spec": {
                "command": "python3 -m unittest test_parcel.ParcelTests.test_delivery",
                "expected": {
                  "kind": "literal",
                  "value": "stdout is exactly b\"delivered box-17\\n\"."
                },
                "test": {
                  "file": "test_parcel.py",
                  "function": "ParcelTests.test_delivery"
                },
                "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
                "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.",
                "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
                "fakes": []
              },
              "reason": "Dropping or changing the supplied parcel breaks the delivery output.",
              "associations": [
                {
                  "truth_id": "T1",
                  "truth_version": 1,
                  "reason": "This check causes the approved trigger and compares the specified output bytes."
                }
              ]
            },
            {
              "kind": "check",
              "id": "P2-T2-C",
              "spec": {
                "command": "python3 -m unittest test_parcel.ParcelTests.test_blank",
                "expected": {
                  "kind": "property",
                  "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."
                },
                "test": {
                  "file": "test_parcel.py",
                  "function": "ParcelTests.test_blank"
                },
                "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.",
                "call": "Run [python3, main.py, blank_value] for every subtest.",
                "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
                "fakes": []
              },
              "reason": "Accepting blank input or writing the error to stdout breaks the error output.",
              "associations": [
                {
                  "truth_id": "T2",
                  "truth_version": 1,
                  "reason": "This check causes the approved trigger and compares the specified output bytes."
                }
              ]
            },
            {
              "kind": "check",
              "id": "P2-T3-C",
              "spec": {
                "command": "python3 -m unittest test_parcel.ParcelTests.test_ready",
                "expected": {
                  "kind": "literal",
                  "value": "stdout is exactly b\"ready\\n\"."
                },
                "test": {
                  "file": "test_parcel.py",
                  "function": "ParcelTests.test_ready"
                },
                "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
                "call": "Run [python3, main.py] with no arguments.",
                "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
                "fakes": []
              },
              "reason": "Requiring an argument or changing ready breaks the legacy output.",
              "associations": [
                {
                  "truth_id": "T3",
                  "truth_version": 1,
                  "reason": "This check causes the approved trigger and compares the specified output bytes."
                }
              ]
            },
            {
              "kind": "artifact",
              "id": "P2-A-CLI",
              "spec": {
                "locators": [
                  "main.py"
                ],
                "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."
              },
              "reason": "Removing any of these CLI branches removes its promised behavior.",
              "associations": [
                {
                  "truth_id": "T1",
                  "truth_version": 1,
                  "reason": "The CLI implements T1 at its external output boundary."
                },
                {
                  "truth_id": "T2",
                  "truth_version": 1,
                  "reason": "The CLI implements T2 at its external output boundary."
                },
                {
                  "truth_id": "T3",
                  "truth_version": 1,
                  "reason": "The CLI implements T3 at its external output boundary."
                }
              ]
            },
            {
              "kind": "artifact",
              "id": "P2-A-TEST",
              "spec": {
                "locators": [
                  "test_parcel.py"
                ],
                "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."
              },
              "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.",
              "associations": [
                {
                  "truth_id": "T1",
                  "truth_version": 1,
                  "reason": "The test file contains the single external-boundary check for T1."
                },
                {
                  "truth_id": "T2",
                  "truth_version": 1,
                  "reason": "The test file contains the single external-boundary check for T2."
                },
                {
                  "truth_id": "T3",
                  "truth_version": 1,
                  "reason": "The test file contains the single external-boundary check for T3."
                }
              ]
            },
            {
              "kind": "link",
              "id": "P2-T1-L",
              "spec": {
                "caller": "main.py::sender",
                "callee": "main.py::receiver",
                "value": "parcel"
              },
              "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.",
              "associations": [
                {
                  "truth_id": "T1",
                  "truth_version": 1,
                  "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."
                }
              ]
            }
          ]
        }
      }
    }
  ]
}
`````


### Event 69 — model — 2026-09-10T19:01:17.477866+00:00


`````text
Proposed identity {"phase": 2, "plan": 1}; publication revision a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73. Full binary-rendered document follows:
---
phase: 2
plan: 1
requirements: ["T1","T2","T3"]
files: ["main.py","test_parcel.py"]
directories: []
execution: {"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]}
---
# Phase 2: Parcel delivery - Plan

## Goal

Deliver the parcel argument, reject blank input, and retain ready output using the approved context.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P2-T1-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_delivery",
        "expected": {
          "kind": "literal",
          "value": "stdout is exactly b\"delivered box-17\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_delivery"
        },
        "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
        "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Dropping or changing the supplied parcel breaks the delivery output.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P2-T2-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_blank",
        "expected": {
          "kind": "property",
          "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_blank"
        },
        "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.",
        "call": "Run [python3, main.py, blank_value] for every subtest.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Accepting blank input or writing the error to stdout breaks the error output.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P2-T3-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_ready",
        "expected": {
          "kind": "literal",
          "value": "stdout is exactly b\"ready\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_ready"
        },
        "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
        "call": "Run [python3, main.py] with no arguments.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Requiring an argument or changing ready breaks the legacy output.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P2-A-CLI",
      "spec": {
        "locators": [
          "main.py"
        ],
        "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."
      },
      "reason": "Removing any of these CLI branches removes its promised behavior.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The CLI implements T1 at its external output boundary."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The CLI implements T2 at its external output boundary."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The CLI implements T3 at its external output boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P2-A-TEST",
      "spec": {
        "locators": [
          "test_parcel.py"
        ],
        "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."
      },
      "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T1."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T2."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T3."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P2-T1-L",
      "spec": {
        "caller": "main.py::sender",
        "callee": "main.py::receiver",
        "value": "parcel"
      },
      "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."
        }
      ]
    }
  ]
}
```

## Tasks

### Task test_delivery

Files: main.py, test_parcel.py (new).
Action: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b"delivered box-17\n". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.
Verify: python3 -m unittest test_parcel.ParcelTests.test_delivery

### Task test_blank

Files: main.py, test_parcel.py (new).
Action: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b"parcel must not be blank\n". Add the strip-empty rejection branch before sender is invoked.
Verify: python3 -m unittest test_parcel.ParcelTests.test_blank

### Task test_ready

Files: main.py, test_parcel.py (new).
Action: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b"ready\n". Preserve the existing no-argument output while completing CLI dispatch.
Verify: python3 -m unittest test_parcel.ParcelTests.test_ready

## File lease and authoring boundary

The lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.
`````


### Event 70 — model — 2026-09-10T19:01:17.477961+00:00


`````text
Approve this exact complete submission and document, including its Evidence map?
`````


### Event 71 — owner — 2026-09-10T19:01:17.477976+00:00


`````text
I approve this exact complete submission for phase 2, plan 1, including the displayed Evidence map. Owner: Codex (GPT-6), acting pilot owner at the orchestrator's direction. Time: 2026-09-10T19:01:17.477968+00:00.
`````


### Event 72 — mcp-request — 2026-09-10T19:01:17.478203+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 12, "params": {"name": "cadence_apply", "arguments": {"operation": "plan-submit", "submission": {"phase": 2, "occurrence": "active-cycle:phase:2", "request_id": "pilot29-parcel-plan-001", "inventory_basis": "965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8", "plans": [{"target": {"phase": 2, "plan": 1}, "content": {"phase": 2, "plan": 1, "requirements": ["T1", "T2", "T3"], "files": ["main.py", "test_parcel.py"], "directories": [], "execution": {"schema": 1, "suite": "python3 -m unittest", "tasks": [{"id": "test_delivery", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_delivery"]}, {"id": "test_blank", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_blank"]}, {"id": "test_ready", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]}, "body": "# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n", "evidence_map": {"mode": "attached", "items": [{"kind": "check", "id": "P2-T1-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_delivery", "expected": {"kind": "literal", "value": "stdout is exactly b\"delivered box-17\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_delivery"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Dropping or changing the supplied parcel breaks the delivery output.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T2-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_blank", "expected": {"kind": "property", "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_blank"}, "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.", "call": "Run [python3, main.py, blank_value] for every subtest.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Accepting blank input or writing the error to stdout breaks the error output.", "associations": [{"truth_id": "T2", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T3-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_ready", "expected": {"kind": "literal", "value": "stdout is exactly b\"ready\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_ready"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py] with no arguments.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Requiring an argument or changing ready breaks the legacy output.", "associations": [{"truth_id": "T3", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "artifact", "id": "P2-A-CLI", "spec": {"locators": ["main.py"], "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."}, "reason": "Removing any of these CLI branches removes its promised behavior.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The CLI implements T1 at its external output boundary."}, {"truth_id": "T2", "truth_version": 1, "reason": "The CLI implements T2 at its external output boundary."}, {"truth_id": "T3", "truth_version": 1, "reason": "The CLI implements T3 at its external output boundary."}]}, {"kind": "artifact", "id": "P2-A-TEST", "spec": {"locators": ["test_parcel.py"], "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."}, "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T1."}, {"truth_id": "T2", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T2."}, {"truth_id": "T3", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T3."}]}, {"kind": "link", "id": "P2-T1-L", "spec": {"caller": "main.py::sender", "callee": "main.py::receiver", "value": "parcel"}, "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}, "approval": {"approved": true, "owner": "Codex (GPT-6), acting pilot owner at the orchestrator's direction", "at": "2026-09-10T19:01:17.477968+00:00", "submission": {"phase": 2, "occurrence": "active-cycle:phase:2", "request_id": "pilot29-parcel-plan-001", "inventory_basis": "965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8", "plans": [{"target": {"phase": 2, "plan": 1}, "content": {"phase": 2, "plan": 1, "requirements": ["T1", "T2", "T3"], "files": ["main.py", "test_parcel.py"], "directories": [], "execution": {"schema": 1, "suite": "python3 -m unittest", "tasks": [{"id": "test_delivery", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_delivery"]}, {"id": "test_blank", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_blank"]}, {"id": "test_ready", "verify": ["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]}, "body": "# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n", "evidence_map": {"mode": "attached", "items": [{"kind": "check", "id": "P2-T1-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_delivery", "expected": {"kind": "literal", "value": "stdout is exactly b\"delivered box-17\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_delivery"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Dropping or changing the supplied parcel breaks the delivery output.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T2-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_blank", "expected": {"kind": "property", "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_blank"}, "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.", "call": "Run [python3, main.py, blank_value] for every subtest.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Accepting blank input or writing the error to stdout breaks the error output.", "associations": [{"truth_id": "T2", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "check", "id": "P2-T3-C", "spec": {"command": "python3 -m unittest test_parcel.ParcelTests.test_ready", "expected": {"kind": "literal", "value": "stdout is exactly b\"ready\\n\"."}, "test": {"file": "test_parcel.py", "function": "ParcelTests.test_ready"}, "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.", "call": "Run [python3, main.py] with no arguments.", "boundary": "Real CLI subprocess to the caller-visible captured output stream.", "fakes": []}, "reason": "Requiring an argument or changing ready breaks the legacy output.", "associations": [{"truth_id": "T3", "truth_version": 1, "reason": "This check causes the approved trigger and compares the specified output bytes."}]}, {"kind": "artifact", "id": "P2-A-CLI", "spec": {"locators": ["main.py"], "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."}, "reason": "Removing any of these CLI branches removes its promised behavior.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The CLI implements T1 at its external output boundary."}, {"truth_id": "T2", "truth_version": 1, "reason": "The CLI implements T2 at its external output boundary."}, {"truth_id": "T3", "truth_version": 1, "reason": "The CLI implements T3 at its external output boundary."}]}, {"kind": "artifact", "id": "P2-A-TEST", "spec": {"locators": ["test_parcel.py"], "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."}, "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T1."}, {"truth_id": "T2", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T2."}, {"truth_id": "T3", "truth_version": 1, "reason": "The test file contains the single external-boundary check for T3."}]}, {"kind": "link", "id": "P2-T1-L", "spec": {"caller": "main.py::sender", "callee": "main.py::receiver", "value": "parcel"}, "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.", "associations": [{"truth_id": "T1", "truth_version": 1, "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}}}}}
`````


### Event 73 — mcp-response — 2026-09-10T19:01:17.657059+00:00


`````json
{"jsonrpc":"2.0","id":12,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"plan-submit\",\"persisted\":true,\"results\":[{\"identity\":{\"phase\":2,\"plan\":1},\"occurrence\":\"active-cycle:phase:2\",\"revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}},\"approval\":{\"approved\":true,\"owner\":\"Codex (GPT-6), acting pilot owner at the orchestrator's direction\",\"at\":\"2026-09-10T19:01:17.477968+00:00\",\"submission\":{\"phase\":2,\"occurrence\":\"active-cycle:phase:2\",\"request_id\":\"pilot29-parcel-plan-001\",\"inventory_basis\":\"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8\",\"plans\":[{\"target\":{\"phase\":2,\"plan\":1},\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}}}]}},\"readiness\":\"provisional-authoring\",\"history\":[\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\"],\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\"}],\"coverage\":{\"uncovered\":[],\"without_check\":[]}}"}],"structuredContent":{"status":"ok","operation":"plan-submit","persisted":true,"results":[{"identity":{"phase":2,"plan":1},"occurrence":"active-cycle:phase:2","revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}},"approval":{"approved":true,"owner":"Codex (GPT-6), acting pilot owner at the orchestrator's direction","at":"2026-09-10T19:01:17.477968+00:00","submission":{"phase":2,"occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","inventory_basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","plans":[{"target":{"phase":2,"plan":1},"content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}},"readiness":"provisional-authoring","history":["a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73"],"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89"}],"coverage":{"uncovered":[],"without_check":[]}},"isError":false}}
`````


### Event 74 — model — 2026-09-10T19:01:28.781236+00:00


`````text
The binary acknowledged plan-submit with status ok and persisted true. I am reading the authoritative map and published document through the public operations now.
`````


### Event 75 — mcp-request — 2026-09-10T19:01:28.781274+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 13, "params": {"name": "cadence_query", "arguments": {"operation": "evidence-read", "phase": 2}}}
`````


### Event 76 — mcp-response — 2026-09-10T19:01:28.790893+00:00


`````json
{"jsonrpc":"2.0","id":13,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"evidence-read\",\"schema\":\"acceptance-map-view-1\",\"phase\":2,\"occurrence\":\"active-cycle:phase:2\",\"truths\":[{\"id\":\"T1\",\"version\":1,\"text\":\"When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.\",\"kind\":\"literal\"},{\"id\":\"T2\",\"version\":1,\"text\":\"When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.\",\"kind\":\"property\"},{\"id\":\"T3\",\"version\":1,\"text\":\"When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.\",\"kind\":\"literal\"}],\"contributions\":[{\"identity\":{\"phase\":2,\"plan\":1},\"content_revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"request_id\":\"pilot29-parcel-plan-001\"}],\"items\":[{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"item_revision\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\"},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"item_revision\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\"},{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"item_revision\":\"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5\"},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"item_revision\":\"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402\"},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"item_revision\":\"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e\"},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"item_revision\":\"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616\"}],\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-CLI\",\"item_revision\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\",\"association_index\":0}},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-CLI\",\"item_revision\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\",\"association_index\":1}},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-CLI\",\"item_revision\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\",\"association_index\":2}},{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-TEST\",\"item_revision\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\",\"association_index\":0}},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-TEST\",\"item_revision\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\",\"association_index\":1}},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-TEST\",\"item_revision\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\",\"association_index\":2}},{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T1-C\",\"item_revision\":\"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5\",\"association_index\":0}},{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T1-L\",\"item_revision\":\"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402\",\"association_index\":0}},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T2-C\",\"item_revision\":\"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e\",\"association_index\":0}},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\",\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T3-C\",\"item_revision\":\"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616\",\"association_index\":0}}],\"aliases\":[{\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-CLI\",\"item_revision\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\"},\"id\":\"P2-A-CLI\",\"item_revision\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\"},{\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-A-TEST\",\"item_revision\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\"},\"id\":\"P2-A-TEST\",\"item_revision\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\"},{\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T1-C\",\"item_revision\":\"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5\"},\"id\":\"P2-T1-C\",\"item_revision\":\"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5\"},{\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T1-L\",\"item_revision\":\"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402\"},\"id\":\"P2-T1-L\",\"item_revision\":\"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402\"},{\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T2-C\",\"item_revision\":\"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e\"},\"id\":\"P2-T2-C\",\"item_revision\":\"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e\"},{\"origin\":{\"plan\":1,\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"item_id\":\"P2-T3-C\",\"item_revision\":\"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616\"},\"id\":\"P2-T3-C\",\"item_revision\":\"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616\"}],\"history\":[{\"publication\":{\"revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"occurrence\":\"active-cycle:phase:2\",\"request_id\":\"pilot29-parcel-plan-001\",\"payload_digest\":\"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2\",\"identity\":{\"phase\":2,\"plan\":1},\"content_revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}],\"item_revisions\":{\"P2-A-CLI\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\",\"P2-A-TEST\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\",\"P2-T1-C\":\"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5\",\"P2-T1-L\":\"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402\",\"P2-T2-C\":\"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e\",\"P2-T3-C\":\"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616\"}},\"status\":\"current\",\"superseded_by\":null}],\"coverage\":{\"uncovered\":[],\"without_check\":[],\"checks\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"item_ids\":[\"P2-T1-C\"]},{\"truth_id\":\"T2\",\"truth_version\":1,\"item_ids\":[\"P2-T2-C\"]},{\"truth_id\":\"T3\",\"truth_version\":1,\"item_ids\":[\"P2-T3-C\"]}]},\"readiness\":\"provisional-authoring\",\"projections\":[{\"identity\":{\"phase\":2,\"plan\":1},\"current_revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"observed_digest\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"status\":\"installed\"}],\"coherence\":\"consistent\",\"input_digest\":\"02d7ca8544f0474cb45bb49287d9b481758584725f98c57537c8c1479d935735\"}"}],"structuredContent":{"status":"ok","operation":"evidence-read","schema":"acceptance-map-view-1","phase":2,"occurrence":"active-cycle:phase:2","truths":[{"id":"T1","version":1,"text":"When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.","kind":"literal"},{"id":"T2","version":1,"text":"When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.","kind":"property"},{"id":"T3","version":1,"text":"When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.","kind":"literal"}],"contributions":[{"identity":{"phase":2,"plan":1},"content_revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","request_id":"pilot29-parcel-plan-001"}],"items":[{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","item_revision":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8"},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","item_revision":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198"},{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","item_revision":"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5"},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","item_revision":"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402"},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","item_revision":"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e"},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","item_revision":"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616"}],"associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-CLI","item_revision":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8","association_index":0}},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-CLI","item_revision":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8","association_index":1}},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-CLI","item_revision":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8","association_index":2}},{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-TEST","item_revision":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198","association_index":0}},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-TEST","item_revision":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198","association_index":1}},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-TEST","item_revision":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198","association_index":2}},{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T1-C","item_revision":"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5","association_index":0}},{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T1-L","item_revision":"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402","association_index":0}},{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T2-C","item_revision":"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e","association_index":0}},{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes.","origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T3-C","item_revision":"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616","association_index":0}}],"aliases":[{"origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-CLI","item_revision":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8"},"id":"P2-A-CLI","item_revision":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8"},{"origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-A-TEST","item_revision":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198"},"id":"P2-A-TEST","item_revision":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198"},{"origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T1-C","item_revision":"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5"},"id":"P2-T1-C","item_revision":"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5"},{"origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T1-L","item_revision":"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402"},"id":"P2-T1-L","item_revision":"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402"},{"origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T2-C","item_revision":"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e"},"id":"P2-T2-C","item_revision":"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e"},{"origin":{"plan":1,"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","item_id":"P2-T3-C","item_revision":"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616"},"id":"P2-T3-C","item_revision":"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616"}],"history":[{"publication":{"revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","payload_digest":"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2","identity":{"phase":2,"plan":1},"content_revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}],"item_revisions":{"P2-A-CLI":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8","P2-A-TEST":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198","P2-T1-C":"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5","P2-T1-L":"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402","P2-T2-C":"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e","P2-T3-C":"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616"}},"status":"current","superseded_by":null}],"coverage":{"uncovered":[],"without_check":[],"checks":[{"truth_id":"T1","truth_version":1,"item_ids":["P2-T1-C"]},{"truth_id":"T2","truth_version":1,"item_ids":["P2-T2-C"]},{"truth_id":"T3","truth_version":1,"item_ids":["P2-T3-C"]}]},"readiness":"provisional-authoring","projections":[{"identity":{"phase":2,"plan":1},"current_revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","observed_digest":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","status":"installed"}],"coherence":"consistent","input_digest":"02d7ca8544f0474cb45bb49287d9b481758584725f98c57537c8c1479d935735"},"isError":false}}
`````


### Event 77 — mcp-request — 2026-09-10T19:01:28.791336+00:00


`````json
{"jsonrpc": "2.0", "method": "tools/call", "id": 14, "params": {"name": "cadence_query", "arguments": {"operation": "plan-read", "phase_address": "2"}}}
`````


### Event 78 — mcp-response — 2026-09-10T19:01:28.806936+00:00


`````json
{"jsonrpc":"2.0","id":14,"result":{"content":[{"type":"text","text":"{\"status\":\"ok\",\"operation\":\"plan-read\",\"phase\":\"2\",\"persisted\":false,\"plans\":[{\"identity\":{\"phase\":2,\"plan\":1},\"phase_address\":\"2\",\"document\":\"---\\nphase: 2\\nplan: 1\\nrequirements: [\\\"T1\\\",\\\"T2\\\",\\\"T3\\\"]\\nfiles: [\\\"main.py\\\",\\\"test_parcel.py\\\"]\\ndirectories: []\\nexecution: {\\\"schema\\\":1,\\\"suite\\\":\\\"python3 -m unittest\\\",\\\"tasks\\\":[{\\\"id\\\":\\\"test_delivery\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\"]},{\\\"id\\\":\\\"test_blank\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\"]},{\\\"id\\\":\\\"test_ready\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\"]}]}\\n---\\n# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"classification\":\"native-publication\",\"publication\":{\"identity\":{\"phase\":2,\"plan\":1},\"occurrence\":\"active-cycle:phase:2\",\"revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}},\"approval\":{\"approved\":true,\"owner\":\"Codex (GPT-6), acting pilot owner at the orchestrator's direction\",\"at\":\"2026-09-10T19:01:17.477968+00:00\",\"submission\":{\"phase\":2,\"occurrence\":\"active-cycle:phase:2\",\"request_id\":\"pilot29-parcel-plan-001\",\"inventory_basis\":\"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8\",\"plans\":[{\"target\":{\"phase\":2,\"plan\":1},\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}}}]}},\"readiness\":\"provisional-authoring\",\"history\":[\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\"],\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\"}}],\"inventory\":{\"occupied\":[1],\"high_water\":1,\"basis\":\"95ce0d4f6f1a353444079512c9561c5663e6fb97c3561adac34b585b194c7557\",\"documents\":{\"phases/2/PLAN-1.md\":\"---\\nphase: 2\\nplan: 1\\nrequirements: [\\\"T1\\\",\\\"T2\\\",\\\"T3\\\"]\\nfiles: [\\\"main.py\\\",\\\"test_parcel.py\\\"]\\ndirectories: []\\nexecution: {\\\"schema\\\":1,\\\"suite\\\":\\\"python3 -m unittest\\\",\\\"tasks\\\":[{\\\"id\\\":\\\"test_delivery\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\"]},{\\\"id\\\":\\\"test_blank\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\"]},{\\\"id\\\":\\\"test_ready\\\",\\\"verify\\\":[\\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\"]}]}\\n---\\n# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\"},\"provenance\":{\"1\":[\"phases/2/PLAN-1.md\",\"publication:pilot29-parcel-plan-001\"]}},\"targets\":[],\"occurrence\":\"active-cycle:phase:2\",\"native_truths_approved\":true,\"next\":\"plan-submit\",\"native\":{\"id\":\"active-cycle:phase:2\",\"phase\":2,\"cycle\":\"active\",\"high_water\":1,\"consumed\":[1],\"provenance\":{\"1\":[\"publication:pilot29-parcel-plan-001\"]},\"publications\":{\"1\":{\"identity\":{\"phase\":2,\"plan\":1},\"occurrence\":\"active-cycle:phase:2\",\"revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}},\"approval\":{\"approved\":true,\"owner\":\"Codex (GPT-6), acting pilot owner at the orchestrator's direction\",\"at\":\"2026-09-10T19:01:17.477968+00:00\",\"submission\":{\"phase\":2,\"occurrence\":\"active-cycle:phase:2\",\"request_id\":\"pilot29-parcel-plan-001\",\"inventory_basis\":\"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8\",\"plans\":[{\"target\":{\"phase\":2,\"plan\":1},\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}}}]}},\"readiness\":\"provisional-authoring\",\"history\":[\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\"],\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\"}},\"receipts\":{\"pilot29-parcel-plan-001\":{\"payload_digest\":\"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2\",\"results\":[{\"identity\":{\"phase\":2,\"plan\":1},\"occurrence\":\"active-cycle:phase:2\",\"revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}},\"approval\":{\"approved\":true,\"owner\":\"Codex (GPT-6), acting pilot owner at the orchestrator's direction\",\"at\":\"2026-09-10T19:01:17.477968+00:00\",\"submission\":{\"phase\":2,\"occurrence\":\"active-cycle:phase:2\",\"request_id\":\"pilot29-parcel-plan-001\",\"inventory_basis\":\"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8\",\"plans\":[{\"target\":{\"phase\":2,\"plan\":1},\"content\":{\"phase\":2,\"plan\":1,\"requirements\":[\"T1\",\"T2\",\"T3\"],\"files\":[\"main.py\",\"test_parcel.py\"],\"directories\":[],\"execution\":{\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]},\"body\":\"# Phase 2: Parcel delivery - Plan\\n\\n## Goal\\n\\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\\n\\n## Evidence map\\n\\n```json\\n{\\n  \\\"mode\\\": \\\"attached\\\",\\n  \\\"items\\\": [\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T1-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_delivery\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"delivered box-17\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_delivery\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Dropping or changing the supplied parcel breaks the delivery output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T2-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_blank\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"property\\\",\\n          \\\"value\\\": \\\"For each argument whose strip() is empty, stderr is exactly b\\\\\\\"parcel must not be blank\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_blank\\\"\\n        },\\n        \\\"setup\\\": \\\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py, blank_value] for every subtest.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Accepting blank input or writing the error to stdout breaks the error output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"check\\\",\\n      \\\"id\\\": \\\"P2-T3-C\\\",\\n      \\\"spec\\\": {\\n        \\\"command\\\": \\\"python3 -m unittest test_parcel.ParcelTests.test_ready\\\",\\n        \\\"expected\\\": {\\n          \\\"kind\\\": \\\"literal\\\",\\n          \\\"value\\\": \\\"stdout is exactly b\\\\\\\"ready\\\\\\\\n\\\\\\\".\\\"\\n        },\\n        \\\"test\\\": {\\n          \\\"file\\\": \\\"test_parcel.py\\\",\\n          \\\"function\\\": \\\"ParcelTests.test_ready\\\"\\n        },\\n        \\\"setup\\\": \\\"Use the real main.py subprocess from the project root; capture stdout as bytes.\\\",\\n        \\\"call\\\": \\\"Run [python3, main.py] with no arguments.\\\",\\n        \\\"boundary\\\": \\\"Real CLI subprocess to the caller-visible captured output stream.\\\",\\n        \\\"fakes\\\": []\\n      },\\n      \\\"reason\\\": \\\"Requiring an argument or changing ready breaks the legacy output.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"This check causes the approved trigger and compares the specified output bytes.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-CLI\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"main.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\\\"\\n      },\\n      \\\"reason\\\": \\\"Removing any of these CLI branches removes its promised behavior.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T1 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T2 at its external output boundary.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The CLI implements T3 at its external output boundary.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"artifact\\\",\\n      \\\"id\\\": \\\"P2-A-TEST\\\",\\n      \\\"spec\\\": {\\n        \\\"locators\\\": [\\n          \\\"test_parcel.py\\\"\\n        ],\\n        \\\"substance\\\": \\\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\\\"\\n      },\\n      \\\"reason\\\": \\\"Replacing the subprocess with a fake or removing a named test removes the intended check.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T1.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T2\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T2.\\\"\\n        },\\n        {\\n          \\\"truth_id\\\": \\\"T3\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"The test file contains the single external-boundary check for T3.\\\"\\n        }\\n      ]\\n    },\\n    {\\n      \\\"kind\\\": \\\"link\\\",\\n      \\\"id\\\": \\\"P2-T1-L\\\",\\n      \\\"spec\\\": {\\n        \\\"caller\\\": \\\"main.py::sender\\\",\\n        \\\"callee\\\": \\\"main.py::receiver\\\",\\n        \\\"value\\\": \\\"parcel\\\"\\n      },\\n      \\\"reason\\\": \\\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\\\",\\n      \\\"associations\\\": [\\n        {\\n          \\\"truth_id\\\": \\\"T1\\\",\\n          \\\"truth_version\\\": 1,\\n          \\\"reason\\\": \\\"T1 explicitly names a parcel crossing from the sender to the receiver.\\\"\\n        }\\n      ]\\n    }\\n  ]\\n}\\n```\\n\\n## Tasks\\n\\n### Task test_delivery\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\\\"delivered box-17\\\\n\\\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\\n\\n### Task test_blank\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\\\"parcel must not be blank\\\\n\\\". Add the strip-empty rejection branch before sender is invoked.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\\n\\n### Task test_ready\\n\\nFiles: main.py, test_parcel.py (new).\\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\\\"ready\\\\n\\\". Preserve the existing no-argument output while completing CLI dispatch.\\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\\n\\n## File lease and authoring boundary\\n\\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\\n\",\"evidence_map\":{\"mode\":\"attached\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}]}}}]}},\"readiness\":\"provisional-authoring\",\"history\":[\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\"],\"map_revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\"}]}}},\"map_history\":[{\"publication\":{\"revision\":\"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89\",\"occurrence\":\"active-cycle:phase:2\",\"request_id\":\"pilot29-parcel-plan-001\",\"payload_digest\":\"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2\",\"identity\":{\"phase\":2,\"plan\":1},\"content_revision\":\"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73\",\"items\":[{\"kind\":\"check\",\"id\":\"P2-T1-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_delivery\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Dropping or changing the supplied parcel breaks the delivery output.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T2-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_blank\",\"expected\":{\"kind\":\"property\",\"value\":\"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_blank\"},\"setup\":\"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\"call\":\"Run [python3, main.py, blank_value] for every subtest.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Accepting blank input or writing the error to stdout breaks the error output.\",\"associations\":[{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"check\",\"id\":\"P2-T3-C\",\"spec\":{\"command\":\"python3 -m unittest test_parcel.ParcelTests.test_ready\",\"expected\":{\"kind\":\"literal\",\"value\":\"stdout is exactly b\\\"ready\\\\n\\\".\"},\"test\":{\"file\":\"test_parcel.py\",\"function\":\"ParcelTests.test_ready\"},\"setup\":\"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\"call\":\"Run [python3, main.py] with no arguments.\",\"boundary\":\"Real CLI subprocess to the caller-visible captured output stream.\",\"fakes\":[]},\"reason\":\"Requiring an argument or changing ready breaks the legacy output.\",\"associations\":[{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"This check causes the approved trigger and compares the specified output bytes.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-CLI\",\"spec\":{\"locators\":[\"main.py\"],\"substance\":\"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"},\"reason\":\"Removing any of these CLI branches removes its promised behavior.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The CLI implements T1 at its external output boundary.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The CLI implements T2 at its external output boundary.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The CLI implements T3 at its external output boundary.\"}]},{\"kind\":\"artifact\",\"id\":\"P2-A-TEST\",\"spec\":{\"locators\":[\"test_parcel.py\"],\"substance\":\"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"},\"reason\":\"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T1.\"},{\"truth_id\":\"T2\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T2.\"},{\"truth_id\":\"T3\",\"truth_version\":1,\"reason\":\"The test file contains the single external-boundary check for T3.\"}]},{\"kind\":\"link\",\"id\":\"P2-T1-L\",\"spec\":{\"caller\":\"main.py::sender\",\"callee\":\"main.py::receiver\",\"value\":\"parcel\"},\"reason\":\"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\"associations\":[{\"truth_id\":\"T1\",\"truth_version\":1,\"reason\":\"T1 explicitly names a parcel crossing from the sender to the receiver.\"}]}],\"item_revisions\":{\"P2-A-CLI\":\"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8\",\"P2-A-TEST\":\"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198\",\"P2-T1-C\":\"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5\",\"P2-T1-L\":\"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402\",\"P2-T2-C\":\"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e\",\"P2-T3-C\":\"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616\"}},\"status\":\"current\",\"superseded_by\":null}],\"legacy_readiness\":\"legacy-input\",\"readiness\":\"provisional-authoring\",\"contract\":{\"$schema\":\"https://json-schema.org/draft/2020-12/schema\",\"title\":\"Apply\",\"oneOf\":[{\"type\":\"object\",\"properties\":{\"submission\":{\"$ref\":\"#/$defs/Submission\"},\"approval\":{\"anyOf\":[{\"$ref\":\"#/$defs/Approval\"},{\"type\":\"null\"}]},\"operation\":{\"type\":\"string\",\"const\":\"plan-submit\"}},\"additionalProperties\":false,\"required\":[\"operation\",\"submission\"]}],\"$defs\":{\"Submission\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"occurrence\":{\"description\":\"Explicit active-cycle lifetime, established only by approved publication.\",\"type\":\"string\"},\"request_id\":{\"type\":\"string\"},\"inventory_basis\":{\"type\":\"string\"},\"plans\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Entry\"}}},\"additionalProperties\":false,\"required\":[\"phase\",\"occurrence\",\"request_id\",\"inventory_basis\",\"plans\"]},\"Entry\":{\"type\":\"object\",\"properties\":{\"target\":{\"$ref\":\"#/$defs/Identity\"},\"content\":{\"$ref\":\"#/$defs/Content\"},\"replacement\":{\"anyOf\":[{\"$ref\":\"#/$defs/ReplacementApproval\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"target\",\"content\"]},\"Identity\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"plan\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1}},\"additionalProperties\":false,\"required\":[\"phase\",\"plan\"]},\"Content\":{\"type\":\"object\",\"properties\":{\"phase\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"plan\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":1},\"requirements\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"files\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"directories\":{\"type\":\"array\",\"items\":{\"type\":\"string\"},\"default\":[]},\"execution\":{\"$ref\":\"#/$defs/Execution\"},\"body\":{\"description\":\"UTF-8 Markdown, including its original line endings and final newline.\",\"type\":\"string\"},\"evidence_map\":{\"description\":\"Absence is retained only for historical phase-27 publications.\",\"anyOf\":[{\"$ref\":\"#/$defs/Map\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"phase\",\"plan\",\"requirements\",\"files\",\"execution\",\"body\"]},\"Execution\":{\"type\":\"object\",\"properties\":{\"schema\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":0},\"suite\":{\"type\":\"string\"},\"tasks\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/TaskSpec\"}}},\"additionalProperties\":false,\"required\":[\"schema\",\"suite\",\"tasks\"]},\"TaskSpec\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"verify\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}},\"additionalProperties\":false,\"required\":[\"id\",\"verify\"]},\"Map\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Item\"}},\"mode\":{\"type\":\"string\",\"const\":\"attached\"}},\"additionalProperties\":false,\"required\":[\"mode\",\"items\"]},{\"type\":\"object\",\"properties\":{\"mode\":{\"type\":\"string\",\"const\":\"provisional\"}},\"required\":[\"mode\"],\"additionalProperties\":false}]},\"Item\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Check\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"check\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Artifact\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"artifact\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Link\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"link\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]},{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"spec\":{\"$ref\":\"#/$defs/Observation\"},\"reason\":{\"type\":\"string\"},\"associations\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/Association\"}},\"kind\":{\"type\":\"string\",\"const\":\"observation\"}},\"additionalProperties\":false,\"required\":[\"kind\",\"id\",\"spec\",\"reason\",\"associations\"]}]},\"Check\":{\"type\":\"object\",\"properties\":{\"command\":{\"type\":\"string\"},\"expected\":{\"$ref\":\"#/$defs/Expected\"},\"test\":{\"$ref\":\"#/$defs/Test\"},\"setup\":{\"type\":\"string\"},\"call\":{\"type\":\"string\"},\"boundary\":{\"type\":\"string\"},\"fakes\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}},\"additionalProperties\":false,\"required\":[\"command\",\"expected\",\"test\",\"setup\",\"call\",\"boundary\",\"fakes\"]},\"Expected\":{\"oneOf\":[{\"type\":\"object\",\"properties\":{\"kind\":{\"type\":\"string\",\"const\":\"literal\"},\"value\":{\"type\":\"string\"}},\"required\":[\"kind\",\"value\"],\"additionalProperties\":false},{\"type\":\"object\",\"properties\":{\"kind\":{\"type\":\"string\",\"const\":\"property\"},\"value\":{\"type\":\"string\"}},\"required\":[\"kind\",\"value\"],\"additionalProperties\":false}]},\"Test\":{\"type\":\"object\",\"properties\":{\"file\":{\"type\":\"string\"},\"function\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"file\",\"function\"]},\"Association\":{\"type\":\"object\",\"properties\":{\"truth_id\":{\"type\":\"string\"},\"truth_version\":{\"type\":\"integer\",\"format\":\"uint32\",\"minimum\":0},\"reason\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"truth_id\",\"truth_version\",\"reason\"]},\"Artifact\":{\"type\":\"object\",\"properties\":{\"locators\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}},\"substance\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"locators\",\"substance\"]},\"Link\":{\"type\":\"object\",\"properties\":{\"caller\":{\"type\":\"string\"},\"callee\":{\"type\":\"string\"},\"value\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"caller\",\"callee\",\"value\"]},\"Observation\":{\"type\":\"object\",\"properties\":{\"episode\":{\"type\":\"string\"},\"specification\":{\"$ref\":\"#/$defs/Specification\"},\"status\":{\"$ref\":\"#/$defs/Pending\"}},\"additionalProperties\":false,\"required\":[\"episode\",\"specification\",\"status\"]},\"Specification\":{\"type\":\"object\",\"properties\":{\"source\":{\"type\":\"string\"},\"document\":{\"type\":\"string\"},\"approved_by\":{\"type\":\"string\"},\"approved_at\":{\"type\":\"string\"}},\"additionalProperties\":false,\"required\":[\"source\",\"document\",\"approved_by\",\"approved_at\"]},\"Pending\":{\"type\":\"string\",\"enum\":[\"pending\"]},\"ReplacementApproval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"target\":{\"$ref\":\"#/$defs/Identity\"},\"old_revision\":{\"type\":\"string\"},\"old_document\":{\"type\":\"string\"},\"content\":{\"$ref\":\"#/$defs/Content\"}},\"additionalProperties\":false,\"required\":[\"approved\",\"target\",\"old_revision\",\"old_document\",\"content\"]},\"Approval\":{\"type\":\"object\",\"properties\":{\"approved\":{\"type\":\"boolean\"},\"owner\":{\"type\":[\"string\",\"null\"]},\"at\":{\"type\":[\"string\",\"null\"]},\"submission\":{\"anyOf\":[{\"$ref\":\"#/$defs/Submission\"},{\"type\":\"null\"}]}},\"additionalProperties\":false,\"required\":[\"approved\"]}}}}"}],"structuredContent":{"status":"ok","operation":"plan-read","phase":"2","persisted":false,"plans":[{"identity":{"phase":2,"plan":1},"phase_address":"2","document":"---\nphase: 2\nplan: 1\nrequirements: [\"T1\",\"T2\",\"T3\"]\nfiles: [\"main.py\",\"test_parcel.py\"]\ndirectories: []\nexecution: {\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]}\n---\n# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","classification":"native-publication","publication":{"identity":{"phase":2,"plan":1},"occurrence":"active-cycle:phase:2","revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}},"approval":{"approved":true,"owner":"Codex (GPT-6), acting pilot owner at the orchestrator's direction","at":"2026-09-10T19:01:17.477968+00:00","submission":{"phase":2,"occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","inventory_basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","plans":[{"target":{"phase":2,"plan":1},"content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}},"readiness":"provisional-authoring","history":["a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73"],"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89"}}],"inventory":{"occupied":[1],"high_water":1,"basis":"95ce0d4f6f1a353444079512c9561c5663e6fb97c3561adac34b585b194c7557","documents":{"phases/2/PLAN-1.md":"---\nphase: 2\nplan: 1\nrequirements: [\"T1\",\"T2\",\"T3\"]\nfiles: [\"main.py\",\"test_parcel.py\"]\ndirectories: []\nexecution: {\"schema\":1,\"suite\":\"python3 -m unittest\",\"tasks\":[{\"id\":\"test_delivery\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_delivery\"]},{\"id\":\"test_blank\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_blank\"]},{\"id\":\"test_ready\",\"verify\":[\"python3 -m unittest test_parcel.ParcelTests.test_ready\"]}]}\n---\n# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n"},"provenance":{"1":["phases/2/PLAN-1.md","publication:pilot29-parcel-plan-001"]}},"targets":[],"occurrence":"active-cycle:phase:2","native_truths_approved":true,"next":"plan-submit","native":{"id":"active-cycle:phase:2","phase":2,"cycle":"active","high_water":1,"consumed":[1],"provenance":{"1":["publication:pilot29-parcel-plan-001"]},"publications":{"1":{"identity":{"phase":2,"plan":1},"occurrence":"active-cycle:phase:2","revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}},"approval":{"approved":true,"owner":"Codex (GPT-6), acting pilot owner at the orchestrator's direction","at":"2026-09-10T19:01:17.477968+00:00","submission":{"phase":2,"occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","inventory_basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","plans":[{"target":{"phase":2,"plan":1},"content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}},"readiness":"provisional-authoring","history":["a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73"],"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89"}},"receipts":{"pilot29-parcel-plan-001":{"payload_digest":"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2","results":[{"identity":{"phase":2,"plan":1},"occurrence":"active-cycle:phase:2","revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}},"approval":{"approved":true,"owner":"Codex (GPT-6), acting pilot owner at the orchestrator's direction","at":"2026-09-10T19:01:17.477968+00:00","submission":{"phase":2,"occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","inventory_basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","plans":[{"target":{"phase":2,"plan":1},"content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}},"readiness":"provisional-authoring","history":["a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73"],"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89"}]}}},"map_history":[{"publication":{"revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","payload_digest":"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2","identity":{"phase":2,"plan":1},"content_revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}],"item_revisions":{"P2-A-CLI":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8","P2-A-TEST":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198","P2-T1-C":"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5","P2-T1-L":"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402","P2-T2-C":"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e","P2-T3-C":"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616"}},"status":"current","superseded_by":null}],"legacy_readiness":"legacy-input","readiness":"provisional-authoring","contract":{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"Apply","oneOf":[{"type":"object","properties":{"submission":{"$ref":"#/$defs/Submission"},"approval":{"anyOf":[{"$ref":"#/$defs/Approval"},{"type":"null"}]},"operation":{"type":"string","const":"plan-submit"}},"additionalProperties":false,"required":["operation","submission"]}],"$defs":{"Submission":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"occurrence":{"description":"Explicit active-cycle lifetime, established only by approved publication.","type":"string"},"request_id":{"type":"string"},"inventory_basis":{"type":"string"},"plans":{"type":"array","items":{"$ref":"#/$defs/Entry"}}},"additionalProperties":false,"required":["phase","occurrence","request_id","inventory_basis","plans"]},"Entry":{"type":"object","properties":{"target":{"$ref":"#/$defs/Identity"},"content":{"$ref":"#/$defs/Content"},"replacement":{"anyOf":[{"$ref":"#/$defs/ReplacementApproval"},{"type":"null"}]}},"additionalProperties":false,"required":["target","content"]},"Identity":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"plan":{"type":"integer","format":"uint32","minimum":1}},"additionalProperties":false,"required":["phase","plan"]},"Content":{"type":"object","properties":{"phase":{"type":"integer","format":"uint32","minimum":1},"plan":{"type":"integer","format":"uint32","minimum":1},"requirements":{"type":"array","items":{"type":"string"}},"files":{"type":"array","items":{"type":"string"}},"directories":{"type":"array","items":{"type":"string"},"default":[]},"execution":{"$ref":"#/$defs/Execution"},"body":{"description":"UTF-8 Markdown, including its original line endings and final newline.","type":"string"},"evidence_map":{"description":"Absence is retained only for historical phase-27 publications.","anyOf":[{"$ref":"#/$defs/Map"},{"type":"null"}]}},"additionalProperties":false,"required":["phase","plan","requirements","files","execution","body"]},"Execution":{"type":"object","properties":{"schema":{"type":"integer","format":"uint32","minimum":0},"suite":{"type":"string"},"tasks":{"type":"array","items":{"$ref":"#/$defs/TaskSpec"}}},"additionalProperties":false,"required":["schema","suite","tasks"]},"TaskSpec":{"type":"object","properties":{"id":{"type":"string"},"verify":{"type":"array","items":{"type":"string"}}},"additionalProperties":false,"required":["id","verify"]},"Map":{"oneOf":[{"type":"object","properties":{"items":{"type":"array","items":{"$ref":"#/$defs/Item"}},"mode":{"type":"string","const":"attached"}},"additionalProperties":false,"required":["mode","items"]},{"type":"object","properties":{"mode":{"type":"string","const":"provisional"}},"required":["mode"],"additionalProperties":false}]},"Item":{"oneOf":[{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Check"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"check"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Artifact"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"artifact"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Link"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"link"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]},{"type":"object","properties":{"id":{"type":"string"},"spec":{"$ref":"#/$defs/Observation"},"reason":{"type":"string"},"associations":{"type":"array","items":{"$ref":"#/$defs/Association"}},"kind":{"type":"string","const":"observation"}},"additionalProperties":false,"required":["kind","id","spec","reason","associations"]}]},"Check":{"type":"object","properties":{"command":{"type":"string"},"expected":{"$ref":"#/$defs/Expected"},"test":{"$ref":"#/$defs/Test"},"setup":{"type":"string"},"call":{"type":"string"},"boundary":{"type":"string"},"fakes":{"type":"array","items":{"type":"string"}}},"additionalProperties":false,"required":["command","expected","test","setup","call","boundary","fakes"]},"Expected":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"literal"},"value":{"type":"string"}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"property"},"value":{"type":"string"}},"required":["kind","value"],"additionalProperties":false}]},"Test":{"type":"object","properties":{"file":{"type":"string"},"function":{"type":"string"}},"additionalProperties":false,"required":["file","function"]},"Association":{"type":"object","properties":{"truth_id":{"type":"string"},"truth_version":{"type":"integer","format":"uint32","minimum":0},"reason":{"type":"string"}},"additionalProperties":false,"required":["truth_id","truth_version","reason"]},"Artifact":{"type":"object","properties":{"locators":{"type":"array","items":{"type":"string"}},"substance":{"type":"string"}},"additionalProperties":false,"required":["locators","substance"]},"Link":{"type":"object","properties":{"caller":{"type":"string"},"callee":{"type":"string"},"value":{"type":"string"}},"additionalProperties":false,"required":["caller","callee","value"]},"Observation":{"type":"object","properties":{"episode":{"type":"string"},"specification":{"$ref":"#/$defs/Specification"},"status":{"$ref":"#/$defs/Pending"}},"additionalProperties":false,"required":["episode","specification","status"]},"Specification":{"type":"object","properties":{"source":{"type":"string"},"document":{"type":"string"},"approved_by":{"type":"string"},"approved_at":{"type":"string"}},"additionalProperties":false,"required":["source","document","approved_by","approved_at"]},"Pending":{"type":"string","enum":["pending"]},"ReplacementApproval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"target":{"$ref":"#/$defs/Identity"},"old_revision":{"type":"string"},"old_document":{"type":"string"},"content":{"$ref":"#/$defs/Content"}},"additionalProperties":false,"required":["approved","target","old_revision","old_document","content"]},"Approval":{"type":"object","properties":{"approved":{"type":"boolean"},"owner":{"type":["string","null"]},"at":{"type":["string","null"]},"submission":{"anyOf":[{"$ref":"#/$defs/Submission"},{"type":"null"}]}},"additionalProperties":false,"required":["approved"]}}}},"isError":false}}
`````


### Event 79 — server-stop — 2026-09-10T19:01:28.810005+00:00


`````json
{
  "method": "stdin EOF then wait; no signal",
  "exit": 0,
  "stderr": ""
}
`````


### Event 80 — snapshot — 2026-09-10T19:01:28.810595+00:00


`````json
{
  "name": "after-server-exit",
  "text": "# find .planning -print (sorted)\n.planning\n.planning/ROADMAP.md\n.planning/config.json\n.planning/config.v4.json\n.planning/decisions.jsonl\n.planning/items.jsonl\n.planning/phases\n.planning/phases/2\n.planning/phases/2/CONTEXT.md\n.planning/phases/2/PLAN-1.md\n.planning/state.json\n# sha256 of every regular file\n568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9  .planning/ROADMAP.md\n18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b  .planning/config.json\na54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e  .planning/config.v4.json\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/decisions.jsonl\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  .planning/items.jsonl\n9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e  .planning/phases/2/CONTEXT.md\na8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73  .planning/phases/2/PLAN-1.md\n7fcc9dd12f08a43c73a9d6891ab8f57974202f2c7633188608143354123ec4e0  .planning/state.json\n"
}
`````


### Event 81 — command — 2026-09-10T19:01:28.810974+00:00


`````json
{
  "argv": [
    "find",
    ".planning/phases/2",
    "-maxdepth",
    "1",
    "-printf",
    "%y %p\n"
  ],
  "cwd": "/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project",
  "exit": 0,
  "stdout": "d .planning/phases/2\nf .planning/phases/2/PLAN-1.md\nf .planning/phases/2/CONTEXT.md\n",
  "stderr": ""
}
`````


### Event 82 — post-exit-listing — 2026-09-10T19:01:28.810998+00:00


`````text
d .planning/phases/2
f .planning/phases/2/PLAN-1.md
f .planning/phases/2/CONTEXT.md
`````


### Event 83 — post-exit-file — 2026-09-10T19:01:28.811151+00:00


Path: `.planning/ROADMAP.md`; bytes: 427; SHA-256: `568dab958a7ea7cafd5877acca77ff5ff186f8bc61b43e71dfcd8d06e7526df9`.


`````markdown
# Pilot parcel project

## Phases

- [x] **Phase 1: Seed CLI** - Print ready with no arguments.
- [ ] **Phase 2: Parcel delivery** - Deliver a parcel, reject blank input, and retain the ready output.

## Phase Details

### Phase 1: Seed CLI
**Goal:** A Python CLI prints ready with no arguments.

### Phase 2: Parcel delivery
**Goal:** Deliver a parcel, reject blank input, and retain the ready output.
**Depends on:** Phase 1
`````


### Event 84 — post-exit-file — 2026-09-10T19:01:28.811189+00:00


Path: `.planning/config.json`; bytes: 30; SHA-256: `18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b`.


`````json
{"memory":{"backend":"none"}}
`````


### Event 85 — post-exit-file — 2026-09-10T19:01:28.811215+00:00


Path: `.planning/config.v4.json`; bytes: 43; SHA-256: `a54ce1469265ec1b285b776841fc39a4c96fa5105a3fbbd2470319d26d952f5e`.


`````json
{
  "memory": {
    "backend": "none"
  }
}
`````


### Event 86 — post-exit-file — 2026-09-10T19:01:28.811238+00:00


Path: `.planning/decisions.jsonl`; bytes: 0; SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.


This file is empty (0 bytes).


`````json

`````


### Event 87 — post-exit-file — 2026-09-10T19:01:28.811260+00:00


Path: `.planning/items.jsonl`; bytes: 0; SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.


This file is empty (0 bytes).


`````json

`````


### Event 88 — post-exit-file — 2026-09-10T19:01:28.811287+00:00


Path: `.planning/phases/2/CONTEXT.md`; bytes: 1001; SHA-256: `9fec29d1a8baeebca6263c36214a4aef11dbbe7655ab49f39f7a64be5dbab25e`.


`````markdown
# Phase 2: Parcel delivery

## Scope boundary

Deliver one parcel argument, reject blank input, and preserve the no-argument ready output.

## Durable decisions

- D-01. Use Python 3 and keep the CLI output byte-stable.

## Decisions

- D-02. The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline.

## Truths

- T1. When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.
- T2. When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.
- T3. When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.

## Flagged assumptions

- One supplied argument is in scope; multiple arguments are outside this phase.
`````


### Event 89 — post-exit-file — 2026-09-10T19:01:28.811318+00:00


Path: `.planning/phases/2/PLAN-1.md`; bytes: 7533; SHA-256: `a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73`.


`````markdown
---
phase: 2
plan: 1
requirements: ["T1","T2","T3"]
files: ["main.py","test_parcel.py"]
directories: []
execution: {"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]}
---
# Phase 2: Parcel delivery - Plan

## Goal

Deliver the parcel argument, reject blank input, and retain ready output using the approved context.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P2-T1-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_delivery",
        "expected": {
          "kind": "literal",
          "value": "stdout is exactly b\"delivered box-17\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_delivery"
        },
        "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
        "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Dropping or changing the supplied parcel breaks the delivery output.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P2-T2-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_blank",
        "expected": {
          "kind": "property",
          "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_blank"
        },
        "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.",
        "call": "Run [python3, main.py, blank_value] for every subtest.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Accepting blank input or writing the error to stdout breaks the error output.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P2-T3-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_ready",
        "expected": {
          "kind": "literal",
          "value": "stdout is exactly b\"ready\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_ready"
        },
        "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
        "call": "Run [python3, main.py] with no arguments.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Requiring an argument or changing ready breaks the legacy output.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P2-A-CLI",
      "spec": {
        "locators": [
          "main.py"
        ],
        "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."
      },
      "reason": "Removing any of these CLI branches removes its promised behavior.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The CLI implements T1 at its external output boundary."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The CLI implements T2 at its external output boundary."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The CLI implements T3 at its external output boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P2-A-TEST",
      "spec": {
        "locators": [
          "test_parcel.py"
        ],
        "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."
      },
      "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T1."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T2."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T3."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P2-T1-L",
      "spec": {
        "caller": "main.py::sender",
        "callee": "main.py::receiver",
        "value": "parcel"
      },
      "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."
        }
      ]
    }
  ]
}
```

## Tasks

### Task test_delivery

Files: main.py, test_parcel.py (new).
Action: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b"delivered box-17\n". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.
Verify: python3 -m unittest test_parcel.ParcelTests.test_delivery

### Task test_blank

Files: main.py, test_parcel.py (new).
Action: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b"parcel must not be blank\n". Add the strip-empty rejection branch before sender is invoked.
Verify: python3 -m unittest test_parcel.ParcelTests.test_blank

### Task test_ready

Files: main.py, test_parcel.py (new).
Action: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b"ready\n". Preserve the existing no-argument output while completing CLI dispatch.
Verify: python3 -m unittest test_parcel.ParcelTests.test_ready

## File lease and authoring boundary

The lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.
`````


### Event 90 — post-exit-file — 2026-09-10T19:01:28.811401+00:00


Path: `.planning/state.json`; bytes: 64515; SHA-256: `7fcc9dd12f08a43c73a9d6891ab8f57974202f2c7633188608143354123ec4e0`.


`````json
{"version":1,"generation":3,"items_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","decisions_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","data":{"import":{"format":1,"complete":true,"source_generation":"740f0b6c7fc4a4f87c6793dd69f587e16dea3240f278dfdd37c61d8afdf4d564","sources":[{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/config.json","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/config.json","content":"18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b"},{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/CAPTURE.md","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/CAPTURE.md","content":null},{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/FILED.md","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/FILED.md","content":null},{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/DECLINED.md","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/DECLINED.md","content":null},{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/STATE.md","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/STATE.md","content":null},{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/trace.jsonl","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/trace.jsonl","content":null},{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/trace.1.jsonl","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/trace.1.jsonl","content":null},{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/ARCHIVE.md","identity":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/ARCHIVE.md","content":null}],"active":{"global":null,"repo":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/config.v4.json"},"created":["/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/items.jsonl","/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/decisions.jsonl","/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/state.json","/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/config.v4.json"],"warnings":["Retired settings (D-06): parallelization.enabled, parallelization.max_concurrent_agents, parallelization.min_plans_for_parallel, parallelization.use_worktrees, review.triggers.phase_diff.gate, review.triggers.phase_diff.tier, review.triggers.phase_diff.effort, git.auto_close. Present values are removed; publishing and merging require explicit authorization.","Retired token-report settings: workflow.max_dispatch_tokens.cad-assumptions-analyzer, workflow.max_dispatch_tokens.cad-executor, workflow.max_dispatch_tokens.cad-plan-checker, workflow.max_dispatch_tokens.cad-planner, workflow.max_dispatch_tokens.cad-reviewer, workflow.max_dispatch_tokens.cad-verifier. No terminal-window budget is enforced.","Global present and removed: none","Repo present and removed: none","missing routing receipts remain unavailable; source-file order does not establish inter-file chronology"]},"cursor":{"available":false},"source_evidence":[{"source":{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/config.json","bytes":[123,34,109,101,109,111,114,121,34,58,123,34,98,97,99,107,101,110,100,34,58,34,110,111,110,101,34,125,125,10]},"generation":"18e038f8cade6453345e5994465cf8852b5603ac8ebacf7ef812a6e0c9faa72b","label":"non_effective_original_source","layer":"repo"}],"archive":{"path":"/tmp/claude-1000/-code-cadence/6718c066-da65-444f-a0fb-f85ca9897e01/scratchpad/pilot29/project/.planning/ARCHIVE.md","maintained":false,"available":false},"context":{"schema":"context-1","phases":{"2":{"submission":{"phase":2,"title":"Parcel delivery","scope":"Deliver one parcel argument, reject blank input, and preserve the no-argument ready output.","durable_decisions":[{"id":"D-01","text":"Use Python 3 and keep the CLI output byte-stable."}],"decisions":[{"id":"D-02","text":"The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline."}],"assumptions":["One supplied argument is in scope; multiple arguments are outside this phase."],"truths":[{"id":"T1","trigger":"the sender hands the receiver a parcel through the CLI argument box-17","observer":"the CLI caller","verb":"sees","outcome":"stdout exactly delivered box-17 followed by a newline","kind":"literal","observable":true,"fixed_oracle":true},{"id":"T2","trigger":"the CLI caller supplies an argument whose Python strip() result is empty","observer":"the CLI caller","verb":"sees","outcome":"stderr exactly parcel must not be blank followed by a newline","kind":"property","observable":true,"fixed_oracle":true},{"id":"T3","trigger":"the CLI caller supplies no arguments","observer":"the CLI caller","verb":"sees","outcome":"stdout exactly ready followed by a newline","kind":"literal","observable":true,"fixed_oracle":true}]},"approval":{"approved":true,"owner":"Codex (GPT-6), acting pilot owner at the orchestrator's direction","at":"2026-09-10T19:00:06.495423+00:00","submission":{"phase":2,"title":"Parcel delivery","scope":"Deliver one parcel argument, reject blank input, and preserve the no-argument ready output.","durable_decisions":[{"id":"D-01","text":"Use Python 3 and keep the CLI output byte-stable."}],"decisions":[{"id":"D-02","text":"The sender passes the parcel argument unchanged to the receiver. Blank means Python strip() returns an empty string. The receiver prints delivered plus one space plus the supplied parcel and a newline."}],"assumptions":["One supplied argument is in scope; multiple arguments are outside this phase."],"truths":[{"id":"T1","trigger":"the sender hands the receiver a parcel through the CLI argument box-17","observer":"the CLI caller","verb":"sees","outcome":"stdout exactly delivered box-17 followed by a newline","kind":"literal","observable":true,"fixed_oracle":true},{"id":"T2","trigger":"the CLI caller supplies an argument whose Python strip() result is empty","observer":"the CLI caller","verb":"sees","outcome":"stderr exactly parcel must not be blank followed by a newline","kind":"property","observable":true,"fixed_oracle":true},{"id":"T3","trigger":"the CLI caller supplies no arguments","observer":"the CLI caller","verb":"sees","outcome":"stdout exactly ready followed by a newline","kind":"literal","observable":true,"fixed_oracle":true}]}},"truths":[{"id":"T1","phase":2,"version":1,"pattern":"when","text":"When the sender hands the receiver a parcel through the CLI argument box-17, the CLI caller sees stdout exactly delivered box-17 followed by a newline.","kind":"literal","status":"pending"},{"id":"T2","phase":2,"version":1,"pattern":"when","text":"When the CLI caller supplies an argument whose Python strip() result is empty, the CLI caller sees stderr exactly parcel must not be blank followed by a newline.","kind":"property","status":"pending"},{"id":"T3","phase":2,"version":1,"pattern":"when","text":"When the CLI caller supplies no arguments, the CLI caller sees stdout exactly ready followed by a newline.","kind":"literal","status":"pending"}]}}},"plan_publications":{"schema":"plan-1","phases":{"2":{"id":"active-cycle:phase:2","phase":2,"cycle":"active","high_water":1,"consumed":[1],"provenance":{"1":["publication:pilot29-parcel-plan-001"]},"publications":{"1":{"identity":{"phase":2,"plan":1},"occurrence":"active-cycle:phase:2","revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}},"approval":{"approved":true,"owner":"Codex (GPT-6), acting pilot owner at the orchestrator's direction","at":"2026-09-10T19:01:17.477968+00:00","submission":{"phase":2,"occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","inventory_basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","plans":[{"target":{"phase":2,"plan":1},"content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}},"readiness":"provisional-authoring","history":["a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73"],"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89"}},"receipts":{"pilot29-parcel-plan-001":{"payload_digest":"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2","results":[{"identity":{"phase":2,"plan":1},"occurrence":"active-cycle:phase:2","revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}},"approval":{"approved":true,"owner":"Codex (GPT-6), acting pilot owner at the orchestrator's direction","at":"2026-09-10T19:01:17.477968+00:00","submission":{"phase":2,"occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","inventory_basis":"965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8","plans":[{"target":{"phase":2,"plan":1},"content":{"phase":2,"plan":1,"requirements":["T1","T2","T3"],"files":["main.py","test_parcel.py"],"directories":[],"execution":{"schema":1,"suite":"python3 -m unittest","tasks":[{"id":"test_delivery","verify":["python3 -m unittest test_parcel.ParcelTests.test_delivery"]},{"id":"test_blank","verify":["python3 -m unittest test_parcel.ParcelTests.test_blank"]},{"id":"test_ready","verify":["python3 -m unittest test_parcel.ParcelTests.test_ready"]}]},"body":"# Phase 2: Parcel delivery - Plan\n\n## Goal\n\nDeliver the parcel argument, reject blank input, and retain ready output using the approved context.\n\n## Evidence map\n\n```json\n{\n  \"mode\": \"attached\",\n  \"items\": [\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T1-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_delivery\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"delivered box-17\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_delivery\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Dropping or changing the supplied parcel breaks the delivery output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T2-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_blank\",\n        \"expected\": {\n          \"kind\": \"property\",\n          \"value\": \"For each argument whose strip() is empty, stderr is exactly b\\\"parcel must not be blank\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_blank\"\n        },\n        \"setup\": \"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.\",\n        \"call\": \"Run [python3, main.py, blank_value] for every subtest.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Accepting blank input or writing the error to stdout breaks the error output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"check\",\n      \"id\": \"P2-T3-C\",\n      \"spec\": {\n        \"command\": \"python3 -m unittest test_parcel.ParcelTests.test_ready\",\n        \"expected\": {\n          \"kind\": \"literal\",\n          \"value\": \"stdout is exactly b\\\"ready\\\\n\\\".\"\n        },\n        \"test\": {\n          \"file\": \"test_parcel.py\",\n          \"function\": \"ParcelTests.test_ready\"\n        },\n        \"setup\": \"Use the real main.py subprocess from the project root; capture stdout as bytes.\",\n        \"call\": \"Run [python3, main.py] with no arguments.\",\n        \"boundary\": \"Real CLI subprocess to the caller-visible captured output stream.\",\n        \"fakes\": []\n      },\n      \"reason\": \"Requiring an argument or changing ready breaks the legacy output.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"This check causes the approved trigger and compares the specified output bytes.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-CLI\",\n      \"spec\": {\n        \"locators\": [\n          \"main.py\"\n        ],\n        \"substance\": \"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output.\"\n      },\n      \"reason\": \"Removing any of these CLI branches removes its promised behavior.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T1 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T2 at its external output boundary.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The CLI implements T3 at its external output boundary.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"artifact\",\n      \"id\": \"P2-A-TEST\",\n      \"spec\": {\n        \"locators\": [\n          \"test_parcel.py\"\n        ],\n        \"substance\": \"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations.\"\n      },\n      \"reason\": \"Replacing the subprocess with a fake or removing a named test removes the intended check.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T1.\"\n        },\n        {\n          \"truth_id\": \"T2\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T2.\"\n        },\n        {\n          \"truth_id\": \"T3\",\n          \"truth_version\": 1,\n          \"reason\": \"The test file contains the single external-boundary check for T3.\"\n        }\n      ]\n    },\n    {\n      \"kind\": \"link\",\n      \"id\": \"P2-T1-L\",\n      \"spec\": {\n        \"caller\": \"main.py::sender\",\n        \"callee\": \"main.py::receiver\",\n        \"value\": \"parcel\"\n      },\n      \"reason\": \"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.\",\n      \"associations\": [\n        {\n          \"truth_id\": \"T1\",\n          \"truth_version\": 1,\n          \"reason\": \"T1 explicitly names a parcel crossing from the sender to the receiver.\"\n        }\n      ]\n    }\n  ]\n}\n```\n\n## Tasks\n\n### Task test_delivery\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_delivery using the actual CLI subprocess and handwritten stdout b\"delivered box-17\\n\". Implement sender and receiver in main.py: sender passes the unchanged parcel argument to receiver, which prints the delivery line.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_delivery\n\n### Task test_blank\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_blank as one function with the listed blank-input subtests. Assert stderr b\"parcel must not be blank\\n\". Add the strip-empty rejection branch before sender is invoked.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_blank\n\n### Task test_ready\n\nFiles: main.py, test_parcel.py (new).\nAction: Create ParcelTests.test_ready invoking the CLI without arguments and comparing stdout b\"ready\\n\". Preserve the existing no-argument output while completing CLI dispatch.\nVerify: python3 -m unittest test_parcel.ParcelTests.test_ready\n\n## File lease and authoring boundary\n\nThe lease covers main.py and test_parcel.py. Tasks are sequential because they share these files. The full suite for later close is python3 -m unittest. These are authored implementation and test specifications, not completed work. Publication remains provisional-authoring; this plan assigns no verdict or truth status.\n","evidence_map":{"mode":"attached","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}]}}}]}},"readiness":"provisional-authoring","history":["a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73"],"map_revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89"}]}}}}},"acceptance_maps":{"schema":"acceptance-map-1","phases":{"2":{"occurrence":"active-cycle:phase:2","revisions":[{"revision":"f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89","occurrence":"active-cycle:phase:2","request_id":"pilot29-parcel-plan-001","payload_digest":"7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2","identity":{"phase":2,"plan":1},"content_revision":"a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73","items":[{"kind":"check","id":"P2-T1-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_delivery","expected":{"kind":"literal","value":"stdout is exactly b\"delivered box-17\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_delivery"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Dropping or changing the supplied parcel breaks the delivery output.","associations":[{"truth_id":"T1","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T2-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_blank","expected":{"kind":"property","value":"For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_blank"},"setup":"One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.","call":"Run [python3, main.py, blank_value] for every subtest.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Accepting blank input or writing the error to stdout breaks the error output.","associations":[{"truth_id":"T2","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"check","id":"P2-T3-C","spec":{"command":"python3 -m unittest test_parcel.ParcelTests.test_ready","expected":{"kind":"literal","value":"stdout is exactly b\"ready\\n\"."},"test":{"file":"test_parcel.py","function":"ParcelTests.test_ready"},"setup":"Use the real main.py subprocess from the project root; capture stdout as bytes.","call":"Run [python3, main.py] with no arguments.","boundary":"Real CLI subprocess to the caller-visible captured output stream.","fakes":[]},"reason":"Requiring an argument or changing ready breaks the legacy output.","associations":[{"truth_id":"T3","truth_version":1,"reason":"This check causes the approved trigger and compares the specified output bytes."}]},{"kind":"artifact","id":"P2-A-CLI","spec":{"locators":["main.py"],"substance":"CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."},"reason":"Removing any of these CLI branches removes its promised behavior.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The CLI implements T1 at its external output boundary."},{"truth_id":"T2","truth_version":1,"reason":"The CLI implements T2 at its external output boundary."},{"truth_id":"T3","truth_version":1,"reason":"The CLI implements T3 at its external output boundary."}]},{"kind":"artifact","id":"P2-A-TEST","spec":{"locators":["test_parcel.py"],"substance":"ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."},"reason":"Replacing the subprocess with a fake or removing a named test removes the intended check.","associations":[{"truth_id":"T1","truth_version":1,"reason":"The test file contains the single external-boundary check for T1."},{"truth_id":"T2","truth_version":1,"reason":"The test file contains the single external-boundary check for T2."},{"truth_id":"T3","truth_version":1,"reason":"The test file contains the single external-boundary check for T3."}]},{"kind":"link","id":"P2-T1-L","spec":{"caller":"main.py::sender","callee":"main.py::receiver","value":"parcel"},"reason":"A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.","associations":[{"truth_id":"T1","truth_version":1,"reason":"T1 explicitly names a parcel crossing from the sender to the receiver."}]}],"item_revisions":{"P2-A-CLI":"89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8","P2-A-TEST":"9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198","P2-T1-C":"e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5","P2-T1-L":"760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402","P2-T2-C":"a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e","P2-T3-C":"a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616"}}]}}}},"operations":{"context:8bfea0ec359f81aee9db9290ba338eab8dbb274b15f35aeff92963fb8e8909ee":"a44f32b29798bf67ac9879b989d614cab47f282166e5b450ede5f95c899a0720","import:740f0b6c7fc4a4f87c6793dd69f587e16dea3240f278dfdd37c61d8afdf4d564":"6f1aee9981ced11f8fbc6c84d361c9bf2c036ee58a3373ef0cb0bf810e73ec42","plan:active-cycle:phase:2:pilot29-parcel-plan-001":"1eec2c7c4f36a538fb9d40d088022a84339e8cc86b51e9cc97eca4bdb39f3209"},"integrity":"e6cefc5a2641ef83618554081f3604622f89e78f1e37dc6ff649802859a5c25a"}
`````


## Post-exit store locations


The full raw store contents appear above at their post-exit file events. In `.planning/state.json`, the approved context and native truth records are under `/data/context/phases/2`; the installed publication is `/data/plan_publications/phases/2/publications/1`; its exact receipt is `/data/plan_publications/phases/2/receipts/pilot29-parcel-plan-001`; the attached map record is `/data/acceptance_maps/phases/2/revisions/0`. `items.jsonl` and `decisions.jsonl` are empty; the context, publication and map records in this pilot are in state.json.


The extracted map record below is a parsed view of the actual post-exit state file, not an inferred reconstruction from the PLAN:


`````json
{
  "revision": "f8e5441da5acfe9b73aff1948fb086bb02bf6b8d57f791d92018daefbc1a2c89",
  "occurrence": "active-cycle:phase:2",
  "request_id": "pilot29-parcel-plan-001",
  "payload_digest": "7719e6b8cfa425e6fdacbf6bf072b76fe8656c643e1d62131ab8033c035fe7d2",
  "identity": {
    "phase": 2,
    "plan": 1
  },
  "content_revision": "a8128df5eeb1b79be8711bdd123671e5c4592f696582b95b155a1b8c75f30a73",
  "items": [
    {
      "kind": "check",
      "id": "P2-T1-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_delivery",
        "expected": {
          "kind": "literal",
          "value": "stdout is exactly b\"delivered box-17\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_delivery"
        },
        "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
        "call": "Run [python3, main.py, box-17]; the sender hands the receiver the parcel argument.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Dropping or changing the supplied parcel breaks the delivery output.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P2-T2-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_blank",
        "expected": {
          "kind": "property",
          "value": "For each argument whose strip() is empty, stderr is exactly b\"parcel must not be blank\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_blank"
        },
        "setup": "One test function uses subtests for empty string, spaces, tab, newline, mixed whitespace, U+2003 and a long space-only string; each is one argv element. Capture stderr as bytes.",
        "call": "Run [python3, main.py, blank_value] for every subtest.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Accepting blank input or writing the error to stdout breaks the error output.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P2-T3-C",
      "spec": {
        "command": "python3 -m unittest test_parcel.ParcelTests.test_ready",
        "expected": {
          "kind": "literal",
          "value": "stdout is exactly b\"ready\\n\"."
        },
        "test": {
          "file": "test_parcel.py",
          "function": "ParcelTests.test_ready"
        },
        "setup": "Use the real main.py subprocess from the project root; capture stdout as bytes.",
        "call": "Run [python3, main.py] with no arguments.",
        "boundary": "Real CLI subprocess to the caller-visible captured output stream.",
        "fakes": []
      },
      "reason": "Requiring an argument or changing ready breaks the legacy output.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This check causes the approved trigger and compares the specified output bytes."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P2-A-CLI",
      "spec": {
        "locators": [
          "main.py"
        ],
        "substance": "CLI dispatch retains no-argument ready output, rejects strip-empty input to stderr, and sends the unchanged parcel through sender to receiver for delivery output."
      },
      "reason": "Removing any of these CLI branches removes its promised behavior.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The CLI implements T1 at its external output boundary."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The CLI implements T2 at its external output boundary."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The CLI implements T3 at its external output boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P2-A-TEST",
      "spec": {
        "locators": [
          "test_parcel.py"
        ],
        "substance": "ParcelTests contains exactly test_delivery, test_blank with subtests, and test_ready, invoking real CLI subprocesses with handwritten byte expectations."
      },
      "reason": "Replacing the subprocess with a fake or removing a named test removes the intended check.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T1."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T2."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The test file contains the single external-boundary check for T3."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P2-T1-L",
      "spec": {
        "caller": "main.py::sender",
        "callee": "main.py::receiver",
        "value": "parcel"
      },
      "reason": "A missing handoff or a transformed argument prevents the receiver from delivering the supplied parcel.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "T1 explicitly names a parcel crossing from the sender to the receiver."
        }
      ]
    }
  ],
  "item_revisions": {
    "P2-A-CLI": "89f6ada93ef40c9f89ca218327c01ce88df75eecfca02cae8ab60ce8e38a46a8",
    "P2-A-TEST": "9b70569dd0cbfe701a1cac002289c326ea680a27acc4a7e9d752d9d7132e3198",
    "P2-T1-C": "e3c774c301e68b2b022b5550a27c7cb621d0f5c6f3d73fab6a9e1f41b115ede5",
    "P2-T1-L": "760095eaa8c697c0e00663b376d81e63f539601a951d2b2297127a75e0fab402",
    "P2-T2-C": "a4d1f12702a6b9abebcf76a7a31ebf8b128e4256c07a0c72b85894787ecf4f9e",
    "P2-T3-C": "a95abc57b057ac068e629c7bff873b648aa85837000a2a537edf44665df9f616"
  }
}
`````


## Rendered skill instructions used by this host


### cad-context


SHA-256: `bc93a42b99aadc329113ed62106f898dc4af3e87994f7b3757e2aa154b862265`.


`````markdown
---
name: cad-context
description: "Discuss a phase's scope, decisions and truths with its owner, then publish only the exact approved set through Cadence"
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

You are the context author. Discuss the phase with the owner and submit their
approved context through the running Cadence binary. The binary owns publication.
Keep the draft in the conversation. Never write CONTEXT.md, STATE.md, native
store records, configuration, session tokens, or any other planning file directly.
Never invoke a legacy planning writer or a post-write acceptance gate.

## Read the phase and its priors

Use the requested positive integer phase number. If it is missing, resolve it
with the owner before authoring. Call `mcp__cadence__cadence_query` with:

```json
{"operation":"context-intake","phase":11}
```

The operation is bound to the project's running `cadence serve` session. Do not
send another root or filesystem destination. A successful intake has `status: ok`,
`operation: context-intake`, `phase`, `context` (prior authored Markdown or null),
`roadmap` (authored roadmap or null), `contract` (the submission schema), and
`persisted: false`. Intake does not initialize storage or recover pending work.

Read the phase scope and priors from that intake, and inspect relevant existing
project documentation or code through read-only tools when it helps clarify a
decision. Resolve missing scope with the owner. Discuss unresolved choices in
small, relevant questions. Distinguish decisions that should carry forward from
phase-local decisions. Retain the owner's authored prose, Markdown, evidence
citations, ordering and flagged assumptions. Do not replace them with a template.
Do not dispatch an analyzer, change the roadmap, allocate new phases, mutate a
cursor, or start planning/evidence-map work during this interview.

## Assemble the complete draft

The apply operation is `context-submit`. Its `submission` contains `phase`,
`title`, `scope`, `durable_decisions`, `decisions`, `assumptions`, and `truths`.
Each decision is `{id, text}`. Assumptions are authored strings. The two decision
sections share one phase identity scope with all the truths. Use distinct full
IDs throughout that phase; T1 and D-01 differ even though their suffixes match.
Another phase may reuse the same spellings. This operation publishes a phase's
first native-approved context; it does not revise an existing native approval.

Collect one through seven truths, each with `id`, `trigger`, `observer`, `verb`,
`outcome`, `kind`, `observable`, and `fixed_oracle`. The binary renders:

    When <trigger>, <observer> <verb> <outcome>.

Submit slots, never a separately supplied final sentence. Each sentence promises
one trigger, one observer and one outcome. All five sentence slots must be
nonblank strings. `verb` is exactly `sees`, `gets`, or `is refused`; `kind` is
`literal` or `property`. The trigger cannot contain the literal delimiter
` or `. The observer cannot contain ` and `, ` & `, a comma, or a semicolon:
these are mechanical conjunction/list rules, not natural-language understanding.
An outcome clause may only sharpen the same outcome, never add another promise.
Eight truths require the owner to split the phase; never truncate or split it
automatically. Do not quietly change the promise to fit the budget.

For EVERY truth ask the owner to attest separately:

- `observable: true`: the outcome is observable from outside, not merely an
  implementation internal.
- `fixed_oracle: true`: the expected answer is fixed independently of model
  prose; it does not come from a model call.

These are the owner's judgments. The binary cannot reliably infer them from
internal names or prose. Missing or false attestations are refusals; do not
infer either from the other, from approval, or from your own confidence. There
is no third attestation and no model or keyword classifier deciding the oracle.
Discuss a refusal with the owner and correct the promise or attestation honestly.

To validate a complete draft call `mcp__cadence__cadence_apply` with:

```json
{
  "operation": "context-submit",
  "submission": {
    "phase": 11,
    "title": "First approved context",
    "scope": "The owner's agreed scope.",
    "durable_decisions": [{"id":"D-01","text":"The owner's durable decision."}],
    "decisions": [{"id":"D-02","text":"The owner's phase-local decision."}],
    "assumptions": [],
    "truths": [{
      "id":"T1", "trigger":"the owner opens the context", "observer":"the owner",
      "verb":"sees", "outcome":"the approved decisions", "kind":"literal",
      "observable":true, "fixed_oracle":true
    }]
  }
}
```

The values above illustrate the wire shape; obtain the actual values and both
attestations from the owner. An `ok` draft response has `operation: context-submit`,
`persisted: false`, and `validation: draft`. Draft success is not publication.

## Present the exact set and obtain approval

Show the owner the entire final submission: scope, all decisions in order,
assumptions, every rendered truth with its kind and full ID, and both attestations
for every truth. Ask for explicit approval of this exact complete set. Record the
approving owner's identity and the observed approval time (an ISO 8601 timestamp);
do not invent either. Any content change needs renewed approval of the changed set.

Only after that approval, resubmit `context-submit` with the identical `submission`
and an `approval` object containing `approved: true`, `owner`, `at`, and
`submission`: an exact copy of the entire approved submission, including the
decisions, prose, truth slots and attestations. Approval of a subset, a mismatched
copy, an empty owner or a missing time is insufficient. There is no draft token.

If approval is missing, stop without submitting an approved request. An explicit
decline can be represented by `approval: {"approved": false}` and also ends
without writing. Never publish to preserve interview progress. The prior files
must remain unchanged when the interview ends without approval.

Wait for `status: ok`, `operation: context-submit`, `persisted: true` before
telling the owner the context landed. This acknowledges the confirmed transaction
of CONTEXT.md and its native truth/approval records. A pending or failed write is
not success. On an uncertain response, retry only the exact original approved
request; do not invent a new approval identity or time. Exact durable retries do
not create another approval. Version 1 and pending truth status are assigned by
the binary; do not submit truth-status changes.

## Handle typed refusals

A refusal is a successful MCP response with `status: refused`, `code`, `reason`,
`rule`, `slot`, `phase`, `entry` (zero-based within the named section), and `id`.
Set-level refusals have no affected entry. Explain the named fault and ask for the
owner's correction; keep their unaffected promises intact. Resubmit through the
same binary operation. Never work around a refusal by editing a file directly.

- `required-slot`, `one-trigger`, `one-observer`, `allowed-verb`, `allowed-kind`:
  correct the named sentence slot or identity.
- `unobservable` / `observable` and `prose-oracle` / `fixed_oracle`: revisit the
  named truth and its distinct owner attestation.
- `seven-truths` / `truths`: explain "split the phase" and end this publication
  attempt until the owner resolves the phase boundary.
- `identity-collision`: identify the full ID, phase and `truths.id`,
  `durable_decisions.id`, or `decisions.id` slot. Do not renumber silently.
- `exact-set-approval` / `approval`: present the actual full set again and obtain
  the missing or corrected approval evidence.
- `native-context-exists`: a first approval already exists; revision is outside
  this operation. Do not overwrite it.
- `submission` or `phase`: correct the request against the intake's contract.

Treat `unknown`, `not-applicable`, transport errors, and storage errors as an
unsettled operation; report what happened without claiming publication. If any
owner decision is needed, keep the draft in the conversation while discussing it.

## Live-host evidence

The interview's quality, host loading and the quality of owner attestations are
knowingly untested. O1 is the owner's real-host observation: the interview reaches
the binary, a deliberately malformed truth produces a typed refusal in the
conversation, and the approved set lands with nothing written before approval.
Preserve an actual observer/date/seen record when supplied; never invent one or
substitute a test of this Markdown. O1 remains an observation and caps the related
truths at concerns even when seen.

## Compiled submission schema

The schema below and the intake's `contract` come from the same compiled types.
The role has no disk instruction loader or user override.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Apply",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "submission": {
          "$ref": "#/$defs/Submission"
        },
        "approval": {
          "anyOf": [
            {
              "$ref": "#/$defs/Approval"
            },
            {
              "type": "null"
            }
          ]
        },
        "operation": {
          "type": "string",
          "const": "context-submit"
        }
      },
      "additionalProperties": false,
      "required": [
        "operation",
        "submission"
      ]
    }
  ],
  "$defs": {
    "Submission": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "title": {
          "type": "string"
        },
        "scope": {
          "type": "string"
        },
        "durable_decisions": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Decision"
          }
        },
        "decisions": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Decision"
          }
        },
        "assumptions": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "truths": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/TruthSlots"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "title",
        "scope",
        "durable_decisions",
        "decisions",
        "assumptions",
        "truths"
      ]
    },
    "Decision": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "text": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "id",
        "text"
      ]
    },
    "TruthSlots": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "trigger": {
          "type": "string"
        },
        "observer": {
          "description": "One party: the literal separators \" and \", \" & \", comma and semicolon are refused.",
          "type": "string"
        },
        "verb": {
          "$ref": "#/$defs/Verb"
        },
        "outcome": {
          "type": "string"
        },
        "kind": {
          "$ref": "#/$defs/Kind"
        },
        "observable": {
          "description": "Owner attestation, never an internal-name classifier.",
          "type": "boolean"
        },
        "fixed_oracle": {
          "description": "Separate owner attestation; approval or observability cannot imply it.",
          "type": "boolean"
        }
      },
      "additionalProperties": false,
      "required": [
        "id",
        "trigger",
        "observer",
        "verb",
        "outcome",
        "kind",
        "observable",
        "fixed_oracle"
      ]
    },
    "Verb": {
      "type": "string",
      "enum": [
        "sees",
        "gets",
        "is refused"
      ]
    },
    "Kind": {
      "type": "string",
      "enum": [
        "literal",
        "property"
      ]
    },
    "Approval": {
      "type": "object",
      "properties": {
        "approved": {
          "type": "boolean"
        },
        "owner": {
          "type": [
            "string",
            "null"
          ]
        },
        "at": {
          "type": [
            "string",
            "null"
          ]
        },
        "submission": {
          "anyOf": [
            {
              "$ref": "#/$defs/Submission"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "approved"
      ]
    }
  }
}
```
`````


### cad-plan


SHA-256: `f1a779b74b29dc6c5ad96b1d5e2528bc2dc1e2204f14e78ed00cbf7cdbdb811a`.


`````markdown
---
name: cad-plan
description: "Author a phase's plans and publish the exact owner-approved content through Cadence"
argument-hint: "[phase number] [--gaps]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

You are the planner. Keep the draft in the conversation and publish through the
running Cadence binary only after the owner approves the exact submission.
This front door is rendered by `cadence plan-instructions` from the compiled
`plan::instructions` role and public submission types. It has no disk loader or
user instruction override.

**Planner.** For each truth, write its ONE check: the test that causes the
truth's trigger and looks for its outcome - test file and function, setup,
call, expected result. Add an artifact for each thing that must exist. Add a
link only where the truth itself names a value crossing between two things.
A task's verify names the narrowest command that settles it - one test, one
binary - never the whole suite. Do not write checks for functions, do not
write coverage, and do not write a second check for a truth.

## Read scope, truths and prior work

Resolve the requested phase with the owner if it is missing. Native publication
requires a canonical positive integer phase. Start with these read-only calls,
using the actual phase in place of 27:

```json
{"operation":"context-intake","phase":27}
```

```json
{"operation":"plan-read","phase_address":"27"}
```

Both use `mcp__cadence__cadence_query` against the running project's bound session.
Do not pass another root or destination. Context intake supplies the roadmap and
context. Plan read returns prior `plans` with their `document` and classification,
`inventory` with occupied identities and source documents, `native` publication
records, `occurrence`, `native_truths_approved`, `readiness` and the apply `contract`.
Read the authoritative phase truths and saved evidence through the same query tool:

```json
{"operation":"evidence-read","phase":27}
```

Use its current `truths` records' opaque `id` and numeric `version`; phase 26 has
not introduced truth revision, so native current versions are presently 1. The
record supplies the number: never derive it from text, a heading, O1 provenance,
an item id or this instruction. A missing native truth set requires context
authoring before publication.
Read SUMMARY, UAT and reports as well as prior plans, and inspect the existing
code and callers the tasks will change. Legacy files are inputs, never native
approval. Decimal phase addresses are read-only and cannot alias native phases.

Read-only intake and research may proceed without approved truths. If
`native_truths_approved` is false, stop publication and lead the owner to
`/cad-context` (`context-intake` / `context-submit`). Use that phase's locked
truths exactly; do not invent truths, revise them or repeat their attestations.

For `--gaps`, read the unresolved UAT items and prior plans/reports. If there is
no unresolved work, say so and end. Otherwise author the additional work at a new
previewed identity. A completed report remains prior history. The old gap flow's
overwrite of PLAN.md could leave reports saying complete and hide new work;
never replace a completed plan to make a gap visible. There is no gap label that
grants replacement authority and no JavaScript allocation step in this flow.

## Author the plan and evidence map

Derive atomic tasks from the approved truths and inspected code. Each task names
its files, action and narrow verify command. Keep a truthful file lease covering
the work. Bind each evidence item to the exact approved truth and known revision;
never invent a truth version. Write the one check per truth with setup, call,
handwritten expected result, test file/function and command. The check must cross
the boundary it claims. Add substantive artifacts, necessary links and explicit
live observations with a reason explaining what change would break each item.
An observation is supplementary to the truth's check. This API accepts only its
specification and `status: "pending"`; it has no observation-result field.

Put the typed map in `content.evidence_map` as `{"mode":"attached","items":[...]}`.
Each item has an opaque, nonblank, occurrence-scoped `id`, one `kind`, a `spec`,
its own nonblank `reason` (what change would break this evidence), and explicit
`associations: [{truth_id, truth_version, reason}]`. Each association has its own
nonblank reason for serving that particular truth. The four spec shapes are:

- `check`: `command`, `expected: {kind: "literal" | "property", value: <string>}`,
  `test: {file, function}`, `setup`, `call`, `boundary`, `fakes: [<string>, ...]`.
- `artifact`: `locators: [<path or symbol>, ...]` and `substance`.
- `link`: `caller`, `callee`, `value`; only author one when the truth itself
  names that value crossing between the two things.
- `observation`: `episode`, `specification: {source, document, approved_by,
  approved_at}`, and `status: "pending"`. These names/time describe approval of
  the specification, never an observation result.

Except for numeric `truth_version` and the arrays shown, spec slots are strings.
The compiled schema below is the exact wire grammar. Kind-specific required
fields are structural, not proof that the check proves its truth or that a handoff
occurs. Complete preview and fresh approved attached publication enforce:

- `check-command`: command must be nonblank text. Any nonblank custom wrapper,
  broad command or command with surrounding whitespace is accepted verbatim.
  Keep the Planner block's narrow command discipline: the binary does not parse
  runners, execute commands, inspect test existence or enforce test selection.
- `check-expected`: expected must explicitly tag a `literal` or `property` with
  a nonblank string value. For silence, write a property such as "stdout is empty
  and the exit status is zero". Blank text never means silence. Property prose
  is retained for verification; no predicate evaluator or strength inference runs.
- `truth-check-limit`: one distinct check id per full current truth id/version
  across the entire resulting phase union. Different ids with identical specs
  are distinct checks; aliases of the same shared definition count once. One
  check may serve several truths through explicit associations. All replaced
  contributions are removed before this count; historical checks never count.
- `link-content`: caller, callee and value must each be nonblank strings.
  Nonblank endpoints need not occur in a truth. `link-value-not-named`: the value
  must be named in every associated current truth under the lexical rule below.

Only command and expected output are content-checked on a check. Test locator,
setup, call, boundary and fakes retain their typed grammar; blank strings and
an empty fakes array remain legal. Test existence, task/check bindings, red/green
receipts and subject-stub gates belong to phase 12, adequacy to the verifier.

Link comparison uses the same snapshot's native approved trigger, observer and
outcome slots, resolved by full current truth id/version. Trim only the value's
outer whitespace for comparison; preserve all submitted bytes. The comparison
is a case-sensitive contiguous exact phrase inside ONE slot, retaining internal
whitespace and punctuation. Where a value begins or ends with an alphanumeric
character or underscore, the adjacent character cannot extend that run. W1's
implementation interpretation of D-101 uses Rust `char::is_alphanumeric()` or
`_` for the run and `char::is_whitespace()` for outer trim, per character, never
per byte. Thus `parcel` matches "sends the parcel, then", but not `parcelé` or
`parcel_2`; `arc` does not match `parcel`. A later delimited occurrence still
matches after an earlier embedded one. Never join slots, search ids/reasons/
titles/plan prose/other truths, fold case, stem or resolve synonyms and pronouns.
This lexical rule is weaker than semantic necessity. A match permits publication
for later tracing and proves no handoff. Unavailable or ambiguous approved slots
produce `link-truth-unresolvable`, distinct from an absent value; never infer
slots from a rendered sentence or silently accept an unclassifiable link.

Coverage uses the union of current plan contributions after removing everything
the proposed batch replaces. Publish an initial split phase's maps together in
one batch; a gap plan may rely on current saved contributions. Every current
truth needs evidence and a check. Old maps and stale associations cannot cover
it. One shared artifact or observation keeps one id, with explicit associations
for each truth and distinct reasons. If multiple plans reference the same id,
its kind/spec/item reason must agree; associations retain their separate origins.
Changing its definition requires replacing all conflicting current contributions
together. A changed spec under the same id retains the old item revision.

The binary renders the canonical `## Evidence map` section from the typed map
at complete preview, preserving surrounding authored body bytes. Leave that
section for the binary to insert, or submit the exact canonical section. Duplicate
sections and disagreement with typed data are refused, never silently adopted.
An existing opaque phase-27 section is not native map authority; replace the plan
with an explicitly approved new body and typed map. Inspect the preview's old
section and proposed canonical section before approval.

For deliberately mapless authoring, explicitly send `{"mode":"provisional"}`.
Missing map fields are preserved only in historical receipts and cannot authorize
a new publication. Provisional maps show missing coverage honestly and contribute
no evidence, even if their body repeats old map text.

All publication remains `provisional-authoring`: readable and addressable, with a
mechanical `execute-next` gate. Phase 12 still owns execution activation and its
acceptance contract; phase 13 owns verdicts, phase 30 owns review handoff. No
red/green receipt, execution or verdict API is added by typed-map authoring.

Prepare `content` with numeric `phase` and `plan`, `requirements` IDs, project-relative
`files`, optional `directories`, `execution`, the exact Markdown `body`, and
the explicit `evidence_map` mode above.
`execution` has `schema: 1`, the project's nonblank full-suite command in `suite`,
and `tasks`, each with a stable unique `id` and nonempty `verify` command array.
These fields describe authored commands. Planning neither runs them nor certifies
acceptance readiness. Keep task verification narrow; the executor runs the suite
once at plan close. The binary round-trips the canonical frontmatter through its
strict native reader. No approval, revision or map metadata goes in frontmatter.
No bare PLAN.md is created; files land at `.planning/phases/<N>/PLAN-<k>.md`.

## Preview, show the exact proposal, and obtain approval

When the complete draft's plan count is known, ask the binary for a fresh preview:

```json
{"operation":"plan-read","phase_address":"27","count":2}
```

`count` is 1 through 64. Omit it for readback. Preview acquires no writer and
reserves nothing. Keep the returned `occurrence`, `inventory.basis` and ordered
`targets`. Numbers are monotonic within the explicit active-cycle phase occurrence,
including known deleted plans, reports and execution identities. Never choose a
hole, normalize an alias or reset a counter. Cycle migration is deferred.

Construct a `plan-submit` request for `mcp__cadence__cadence_apply`. Its `submission`
contains `phase`, returned `occurrence`, a fresh durable caller `request_id`,
`inventory_basis` copied from `inventory.basis`, and ordered `plans`. Each entry
contains its exact returned `target: {phase, plan}` and matching `content` as above.
There is no caller-controlled path and no separate gap operation. Preserve all
authored body bytes and the order shown to the owner. Before approval, send the
complete `submission` through `cadence_query`, without a `count`:

```json
{"operation":"plan-read","phase_address":"27","submission":<complete submission>}
```

Keep the returned final `submission` and `documents`, including each document's
`revision`, `document`, `old_section` and `section`. This preview validates the
whole candidate union without a writer, normalizes the map section and updates
the matching replacement content. Approval must copy this final submission.

Show the entire proposed submission, including every ordered target and the full
content of every plan. Obtain the identified owner's explicit approval of that
exact proposal and their reported approval time; do not invent either. Add
`approval: {approved: true, owner: <identity>, at: <reported time>, submission:
<exact copy of the entire submission>}`. Submit only that approved request.
Keep a missing or declined approval as a conversation draft; never publish to
save progress. Any content or allocation change requires fresh approval.

Wait for `status: ok`, `operation: plan-submit`, `persisted: true` before reporting
that the transaction was acknowledged. Its ordered `results` contain stable
identity, original content revision, approval, `map_revision` for an attached map,
and provisional readiness. Use `plan-read` for the published document and
`evidence-read` for the authoritative phase map. Do not infer
publication from a preview, draft response, storage error or uncertain transport.

## Replacement is a separate exact authorization

Prefer a new approved gap identity for additional work. Only an unexecuted native
publication is eligible for replacement in place. Read the current target's exact
`document` and publication `revision` with `plan-read`. Keep the fresh inventory
basis, then name that existing target in the submission entry and its content.
Add `replacement` to that entry with ALL of these fields:

- `approved: true`, identified `owner` and reported `at`;
- `target`: the exact existing `{phase, plan}`;
- `old_revision` and `old_document`: the observed revision and exact old bytes;
- `content`: an exact copy of the proposed new content in the entry.

Show this complete replacement proposal and obtain its exact approval. The outer
approval must also copy the entire submission, including `replacement`. Original
approval, general planning permission, gap labels and review prose are insufficient.
Stale old bytes or revision lose; read the winner, prepare a new request and obtain
fresh approval. The binary retains prior publications/approvals and does not
replace an identity admitted to execution, even after its active dispatch ends.
Legacy aliases remain read-only even when the canonical filename is absent.

Explicitly resubmit and revalidate the map with every replacement. A changed
non-map body is a new publication even when the map's bytes are identical.
Old immutable map/item payloads and original receipt results remain readable;
`plan-read.map_history` marks retired contributions `superseded` with their
`superseded_by` publication binding. Only the newly approved map may be current.
An explicitly provisional mapless replacement removes the old contribution from
current coverage while retaining its historical payload and retirement relation.

## Retry the acknowledged request, not a new allocation

Keep the original caller request ID and the exact approved request. If its
acknowledgment is uncertain, resend them unchanged, including the original
approval identity/time and inventory basis. Do not re-preview, mint another ID
or silently retarget that retry. Durable receipts are scoped to the occurrence
and bind the payload digest to ordered original identities and revisions.

A replay returns `replayed: true`, the original `payload_digest` and historical
`results` with their original map bindings before testing the
old preview. `persisted: true` means the historical transaction was committed;
it does not assert its old bytes are currently installed. Inspect `projections`
separately: each has `identity`, `current_revision` (the current native record's
revision), and `status`: `installed`, `newer-authorized`, `missing` or `drifted`.
Report that state honestly. Replay never restores old bytes, replaces a newer
revision or allocates another file. A changed payload under the same ID is refused.
This includes changing only an item spec or an association reason. Replays of
historical absent-map phase-27 requests preserve the absent fields, even after
an approved replacement has attached the first map.
Historical replay is an acknowledgment, never certification under the new
planning limits. A fresh attached submission validates all current saved and
proposed contributions, so an old-policy blank command/output, extra check or
unnamed link blocks that union. Correct every offending contribution together
in one explicitly approved replacement batch. Nothing rewrites saved payloads,
drops history or silently grandfathers invalid current content. Provisional
mapless authoring remains explicit and does not claim a validated attached map.

## Read the authoritative acceptance inputs

`evidence-read` is read-only and returns `schema: "acceptance-map-view-1"`,
`phase`, `occurrence`, current `truths` (id/version/text/kind), `contributions`
(plan identity/content revision/map revision/request id), canonical `items`
(id/kind/spec/reason/item revision), explicit `associations` with reasons and
origins, and `aliases` identifying each plan's reference to a shared item.
Its `history` retains full map definitions and exact current/superseded events;
`coverage` lists `uncovered`, `without_check`, and distinct check ids per truth.
A mapless current plan has a null map revision. All views keep
`readiness: "provisional-authoring"` regardless of coverage.

`projections` reports each current plan identity/revision, observed byte digest
or absence, and `installed`, `missing` or `drifted` status. Saved maps remain
authoritative when Markdown is missing, malformed or invalid UTF-8. Readback
does not parse Markdown to invent evidence, repair files or recover intents.

`coherence: "consistent"` requires unchanged before/after observed inputs and no
outstanding intent. `input_digest` is lowercase SHA-256 over compact canonical
JSON of schema/phase/occurrence/truths/contributions/items/associations/aliases/
history/coverage/readiness/projections. Object keys use UTF-8 order; set arrays
use stable identities (numeric plan first where applicable), with exact ordering
and tie-breaking documented in compiled `plan::map_view`. Spec order is retained.
Publication request ids stay included; transient read ids, clocks, absolute roots,
coherence and explanatory prose are excluded. Changed projection bytes change
this digest without changing saved evidence. Later consumers must bind to this
input identity and inspect projection health separately.

An `inconsistent-inputs` answer has `coherence: "inconsistent"`, names `inputs`
and provides no usable `input_digest`. Report the outstanding intent or changed
input and retry readback after it stabilizes; never call it a coherent view or
acquire a writer to recover it. These are stable observed reads, not a claim of
filesystem-wide atomicity. Empty phases return explicit empty sets, not inferred
Markdown maps. Verification must inspect this saved set, never reconstruct its
own expected set from Markdown or a summary.

## Correct typed refusals through the same binary

Refusals carry `status: refused`, `code`, `rule`, `reason` and the standard
location slots (`slot`, `phase`, `entry`, `id`), plus optional structured
`details`. Explain the named identity/path and correct the complete request:

- `check-command` and `check-expected`: supply the nonblank command or explicit
  literal/property value. The full item id and exact JSON path identify the
  missing, malformed or blank field. Expected-container errors locate
  `spec.expected`, invalid tags locate `.kind`, and invalid values locate `.value`.
  Auxiliary check/link shape failures retain `evidence-item-shape` and their
  actual field path, including malformed nested approval/replacement copies.
- `truth-check-limit`: `id` is the full truth id, `slot` is `submission.plans`,
  and `details` contains `truth_id`, `truth_version`, and `checks`. Each check
  has `id` and every `origins: [{phase, plan, source, slot}]`; `source` is
  `saved` or `proposed`. Saved paths use `current.plans[N].evidence_map.items[j]`,
  proposed paths use `submission.plans[i].content.evidence_map.items[j]`.
  Truth/check ids sort by full UTF-8 spelling, versions numerically, origins by
  numeric phase/plan, source and numeric item position. Reordered inputs retain
  accurate paths. Inspect all origins, keep one distinct shared definition,
  and correct all conflicting contributions together with exact approval.
- `link-content`: correct the named caller/callee/value field to nonblank text.
- `link-value-not-named`: use a value actually named by every associated truth.
  `details` carries `truth_id`, `truth_version`, and `association_slot`; `id`
  remains the link id and `slot` its value field. The reason includes the value.
  Do not broaden the lexical rule or rewrite the locked truth to force a match;
  truth revision belongs to phase 26.
- `link-truth-unresolvable`: the same detail locates the association whose
  approved slot authority is unavailable, with the cause in the reason.
  Resolve native authority explicitly; copying truth prose into the plan cannot
  authorize a link.

- `native-approved-truths`: return to context authoring for that phase.
- `uncovered-truth` or `truth-without-check`: inspect the named current truth
  and resulting phase union; supply its evidence and its one authored check.
  An observation cannot stand in for the check.
- `evidence-item-truth`: correct the named item's association to an actual
  current truth in the bound phase; spelling and matching text confer no authority.
- `truth-version-mismatch`: read the current native numeric version and correct
  the named association explicitly; do not infer or silently coerce a version.
- `evidence-association-shape`, `evidence-item-shape` or `duplicate-evidence-item`:
  correct the located numeric slot, nonblank id/reason or duplicate definition.
- `evidence-item-conflict`: retain the shared definition or replace all current
  conflicting contributions together in a newly previewed and approved batch.
- `evidence-map-mode`: choose attached evidence or explicit provisional authoring.
- `evidence-map-section`: remove duplicate sections or submit the exact canonical
  section in a corrected full preview; never infer items from authored prose.
- `preview-scope` or `batch-size`: match the bound phase and use submission or
  count, not both; allocation previews accept 1 through 64 plans.
- `identity-mismatch` or `path-confinement`: correct the proposal and obtain its
  exact approval; never change destinations behind the owner's back.
- `inventory`: resolve the reported legacy ambiguity explicitly; do not rename,
  rewrite or normalize the conflicting inputs as part of planning.
- `allocation-conflict`: a competing write changed the approved precondition;
  get a fresh preview and approval for a new request.
- `replacement-authorization` or `stale-target`: obtain exact target/old/new
  consent based on current readback, preserving the existing winner.
- `admitted-plan` or `legacy-read-only`: leave the existing work intact and use
  a fresh approved gap identity for additional work.
- `request-id-reuse`: recover the exact original request for a retry; a genuinely
  different proposal needs its own ID and fresh approval.
- `number-exhaustion` or `active-cycle`: stop for explicit owner resolution;
  never wrap, reset or migrate a counter automatically.
- `submission`, `publication`, `native-identity` or `exact-submission-approval`:
  inspect the returned schema/reason and correct the complete proposal honestly.

Never fall back to direct PLAN, store or STATE writes, the frozen workflow,
post-write gates, automatic retargeting, reviewer/checker dispatch, paid review,
selected edits, docs commits, requirement writers or cursor writers. Those are
outside this authoring-only front door. Storage/transport failures remain unsettled
until the exact request is acknowledged or the actual blocker is resolved.

## Live-host observation

P28-O1 is the shared observation for phase-28 T1 and T7, source O1 in
`.planning/phases/28/CONTEXT.md`. Its specification was approved by the owner on
2026-09-10 at dispatch HEAD `7d5ccc4f`; it is **pending, not yet seen**:

The owner runs `/cad-plan` for a real phase in a real host, sees the
planner submit its evidence map with the plan, sees one deliberately
uncovered truth come back as a typed refusal in the conversation, and sees
the approved plan land with its map attached and readable back. The map's
quality is the model's and is not asserted.

Keep one item id and both explicit associations. Its item reason is that
deterministic stdio checks cannot establish real host conduct; T1's association
reason is "the owner must see the host submit and publish the attached map";
T7's is "the owner must see authoritative readback in the host". Specification provenance is not a seen
result. This API records no observed result; do not infer one from automated
checks or turn the rendered skill into a check. If observed later, O1 remains
supplementary and caps those truths at `concerns`.

P29-O1 is a separate pending observation, associated with phase-29 T2 and T4,
source O1 in `.planning/phases/29/CONTEXT.md`. Its specification was approved
by the owner on 2026-09-10; it is **pending, not yet seen**:

The owner runs `/cad-plan` for a real phase in a real host, sees the
planner submit a map in which one check has a blank expected output and
one link names a value its truth does not use, sees each come back as a
typed refusal in the conversation naming the item, and sees the corrected
plan land with its map attached. Whether the planner writes a good check
after the refusal is the model's and is not asserted.

Keep one observation item with both associations: T2's reason is that the
owner must see the expected-output refusal in the conversation; T4's is that
the owner must see the unnamed-value refusal and corrected publication.
The item reason is that deterministic stdio checks cannot establish real host
conduct. This is specification provenance only, with no observer, observation
date or result recorded. Automated checks do not make it seen. Observation
verdicts belong to phase 13; even when seen this supplementary item caps the
associated truths at `concerns`.

## Compiled publication schema

The schema below is also returned as the `plan-read` contract.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Apply",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "submission": {
          "$ref": "#/$defs/Submission"
        },
        "approval": {
          "anyOf": [
            {
              "$ref": "#/$defs/Approval"
            },
            {
              "type": "null"
            }
          ]
        },
        "operation": {
          "type": "string",
          "const": "plan-submit"
        }
      },
      "additionalProperties": false,
      "required": [
        "operation",
        "submission"
      ]
    }
  ],
  "$defs": {
    "Submission": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "occurrence": {
          "description": "Explicit active-cycle lifetime, established only by approved publication.",
          "type": "string"
        },
        "request_id": {
          "type": "string"
        },
        "inventory_basis": {
          "type": "string"
        },
        "plans": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Entry"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "occurrence",
        "request_id",
        "inventory_basis",
        "plans"
      ]
    },
    "Entry": {
      "type": "object",
      "properties": {
        "target": {
          "$ref": "#/$defs/Identity"
        },
        "content": {
          "$ref": "#/$defs/Content"
        },
        "replacement": {
          "anyOf": [
            {
              "$ref": "#/$defs/ReplacementApproval"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "target",
        "content"
      ]
    },
    "Identity": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "plan": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "plan"
      ]
    },
    "Content": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "plan": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "requirements": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "files": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "directories": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": []
        },
        "execution": {
          "$ref": "#/$defs/Execution"
        },
        "body": {
          "description": "UTF-8 Markdown, including its original line endings and final newline.",
          "type": "string"
        },
        "evidence_map": {
          "description": "Absence is retained only for historical phase-27 publications.",
          "anyOf": [
            {
              "$ref": "#/$defs/Map"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "plan",
        "requirements",
        "files",
        "execution",
        "body"
      ]
    },
    "Execution": {
      "type": "object",
      "properties": {
        "schema": {
          "type": "integer",
          "format": "uint32",
          "minimum": 0
        },
        "suite": {
          "type": "string"
        },
        "tasks": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/TaskSpec"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "schema",
        "suite",
        "tasks"
      ]
    },
    "TaskSpec": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "verify": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "id",
        "verify"
      ]
    },
    "Map": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Item"
              }
            },
            "mode": {
              "type": "string",
              "const": "attached"
            }
          },
          "additionalProperties": false,
          "required": [
            "mode",
            "items"
          ]
        },
        {
          "type": "object",
          "properties": {
            "mode": {
              "type": "string",
              "const": "provisional"
            }
          },
          "required": [
            "mode"
          ],
          "additionalProperties": false
        }
      ]
    },
    "Item": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Check"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "check"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Artifact"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "artifact"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Link"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "link"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "spec": {
              "$ref": "#/$defs/Observation"
            },
            "reason": {
              "type": "string"
            },
            "associations": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/Association"
              }
            },
            "kind": {
              "type": "string",
              "const": "observation"
            }
          },
          "additionalProperties": false,
          "required": [
            "kind",
            "id",
            "spec",
            "reason",
            "associations"
          ]
        }
      ]
    },
    "Check": {
      "type": "object",
      "properties": {
        "command": {
          "type": "string"
        },
        "expected": {
          "$ref": "#/$defs/Expected"
        },
        "test": {
          "$ref": "#/$defs/Test"
        },
        "setup": {
          "type": "string"
        },
        "call": {
          "type": "string"
        },
        "boundary": {
          "type": "string"
        },
        "fakes": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "command",
        "expected",
        "test",
        "setup",
        "call",
        "boundary",
        "fakes"
      ]
    },
    "Expected": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "kind": {
              "type": "string",
              "const": "literal"
            },
            "value": {
              "type": "string"
            }
          },
          "required": [
            "kind",
            "value"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "kind": {
              "type": "string",
              "const": "property"
            },
            "value": {
              "type": "string"
            }
          },
          "required": [
            "kind",
            "value"
          ],
          "additionalProperties": false
        }
      ]
    },
    "Test": {
      "type": "object",
      "properties": {
        "file": {
          "type": "string"
        },
        "function": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "file",
        "function"
      ]
    },
    "Association": {
      "type": "object",
      "properties": {
        "truth_id": {
          "type": "string"
        },
        "truth_version": {
          "type": "integer",
          "format": "uint32",
          "minimum": 0
        },
        "reason": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "truth_id",
        "truth_version",
        "reason"
      ]
    },
    "Artifact": {
      "type": "object",
      "properties": {
        "locators": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "substance": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "locators",
        "substance"
      ]
    },
    "Link": {
      "type": "object",
      "properties": {
        "caller": {
          "type": "string"
        },
        "callee": {
          "type": "string"
        },
        "value": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "caller",
        "callee",
        "value"
      ]
    },
    "Observation": {
      "type": "object",
      "properties": {
        "episode": {
          "type": "string"
        },
        "specification": {
          "$ref": "#/$defs/Specification"
        },
        "status": {
          "$ref": "#/$defs/Pending"
        }
      },
      "additionalProperties": false,
      "required": [
        "episode",
        "specification",
        "status"
      ]
    },
    "Specification": {
      "type": "object",
      "properties": {
        "source": {
          "type": "string"
        },
        "document": {
          "type": "string"
        },
        "approved_by": {
          "type": "string"
        },
        "approved_at": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "source",
        "document",
        "approved_by",
        "approved_at"
      ]
    },
    "Pending": {
      "type": "string",
      "enum": [
        "pending"
      ]
    },
    "ReplacementApproval": {
      "type": "object",
      "properties": {
        "approved": {
          "type": "boolean"
        },
        "owner": {
          "type": [
            "string",
            "null"
          ]
        },
        "at": {
          "type": [
            "string",
            "null"
          ]
        },
        "target": {
          "$ref": "#/$defs/Identity"
        },
        "old_revision": {
          "type": "string"
        },
        "old_document": {
          "type": "string"
        },
        "content": {
          "$ref": "#/$defs/Content"
        }
      },
      "additionalProperties": false,
      "required": [
        "approved",
        "target",
        "old_revision",
        "old_document",
        "content"
      ]
    },
    "Approval": {
      "type": "object",
      "properties": {
        "approved": {
          "type": "boolean"
        },
        "owner": {
          "type": [
            "string",
            "null"
          ]
        },
        "at": {
          "type": [
            "string",
            "null"
          ]
        },
        "submission": {
          "anyOf": [
            {
              "$ref": "#/$defs/Submission"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "approved"
      ]
    }
  }
}
```
`````


## Scope of this record


All Cadence context and plan publication used the public operations in the rendered skills, over real stdio MCP. Direct pilot planning writes were limited to initial project preparation; no CONTEXT, PLAN, native store or state record was hand-authored as a fallback. No command mutated the /code/cadence Git repository and no tracked file was edited. The sole report written there is this pilot.md; the required cargo build used the existing target directory. Concurrent reports plan-1.md and verify.md were observed as untracked and left alone. The protected phase-27 test root and its lock were not accessed. No process was killed. Owner review remains pending.

