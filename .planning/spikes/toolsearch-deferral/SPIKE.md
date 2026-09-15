# Spike: is ToolSearch deferral enforced at call time?

Run 2026-09-05. CLI 2.1.261. Answers `TSL-01` (`OQ-1`) and retires `TSL-02`
(`OQ-2`) as no longer load-bearing.

## Risk

A `ToolSearch` preamble was about to be written into 28 command skill files at
~900 tokens per skill invocation, roughly 3,600 tokens for a
context -> plan -> execute -> verify run. The prior attempt on 2026-09-05 could
not separate anything: its never-loaded control stayed callable too, so
"the loaded tool still works" had no failing arm to compare against.

## Method

A purpose-built MCP server, `server.mjs` here, declaring two tools and nothing
else. `probe_alpha` is the loaded arm. `probe_bravo` is the control and is
never loaded through `ToolSearch` in any run. The server appends every
JSON-RPC call it receives to `calls.jsonl`, so what the server saw is readable
independently of what the client transcript says.

Each run is a fresh headless session:

    claude -p --strict-mcp-config --mcp-config mcp.json --setting-sources "" \
           --output-format stream-json --verbose --permission-mode bypassPermissions

`--strict-mcp-config` keeps the operator's own MCP servers out. `--setting-sources ""`
keeps the operator's settings, hooks and output style out. Both runs reported
28 tools at `init` with `ToolSearch` present and `mcp__probe__probe_alpha` and
`mcp__probe__probe_bravo` listed by name.

Every observation below is read from the transcript and the server log, never
from an agent's account of its own behaviour. A model cannot observe its own
skipping: it is the thing deciding.

## Runs

Run 1, session `651b984a-f978-411b-bee5-a87075687cb2`, `run1.jsonl`.
Prompt asked for `probe_alpha` and said to call nothing else first. The agent
issued `ToolSearch {"query":"select:mcp__probe__probe_alpha"}` anyway, with the
text "I need to load the tool's schema first before I can call it", then called
the tool successfully.

Run 2, session `6534785f-d312-47aa-acfb-a7414b2c9f3a`, `run2.jsonl`.
Prompt forbade `ToolSearch` outright and asked for `probe_bravo` directly. The
agent called `mcp__probe__probe_bravo` as its first and only tool use. The
server logged `{"event":"tool_called","name":"probe_bravo","text":"bravo-nosearch"}`.
The call returned `PROBE_BRAVO received: bravo-nosearch`. No
`InputValidationError`, no `is_error`, no `ToolSearch` anywhere in the run.

## What this does and does not show

Shown: an MCP tool never loaded through `ToolSearch` is callable, and the call
reaches the server. Deferral withholds the schema from context; it does not
block the call.

Not shown: whether the model reliably knows a tool's argument shape without
loading the schema. Run 2's prompt supplied the field name `text`, so that run
does not test it. A tool with a non-obvious schema may still need the load.

## Consequence

The preamble question inverts. A line telling the model to load is
unnecessary. A line telling it to SKIP the load would save ~900 tokens per
skill invocation, since run 1 shows the model spending one unprompted. Writing
that line is not this spike's work.

`TSL-02` asked whether a loaded schema survives a compaction. With calls not
blocked either way, the answer changes nothing that gets written, so it is
deferred rather than answered. Promote it if a future CLI enforces deferral at
call time.

VERDICT: validated
