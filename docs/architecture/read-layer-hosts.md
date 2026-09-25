# Read-layer host support

The supported worker boundary is one startup-bound `cadence serve` stdio
server named `cadence`. Main threads and workers use that same connection and
the same compiled server instructions. A worker never defines an inline
Cadence server and never launches another resident.

## Claude Code: supported

Claude Code named child agents can list `cadence` as a string in their
`mcpServers` metadata. That reference reuses the server already configured in
the parent session; it is not an inline server definition. Each shipped agent
rung preloads `cad-read-contract`, permits
`mcp__cadence__cadence_query`, and removes built-in and standalone reader
permissions. Engineering roles retain their existing source-writing tools,
model, effort, and routing policy.

P31-T6-C configures the installed Claude host with one named `cadence` stdio
server in disposable fixture settings and installs a project-scoped named
child agent derived from the shipped assumptions-analyzer rung. It captures
the host's actual JSON tool requests and complete results, distinct parent and
child identities, the issued-location handoff, and a sampled process tree.
The check compares both callers with a separate direct-stdio handwritten
oracle and requires exactly one `cadence serve` in the Claude process tree.

The genuine-host prerequisites are an installed `claude` executable and the
owner's existing authenticated session. The fixture does not copy or print
credentials. A missing executable, failed authentication or transport,
missing named-child episode, incomplete tool result, or absent one-resident
evidence makes the check fail explicitly; none is a skip condition.

## Codex: unsupported for this boundary

The installed Codex host was exercised with its genuine worker mechanism.
Each spawned worker started another `cadence serve` instead of inheriting the
parent's resident. A result from that topology cannot establish T6: issued
locations are resident-owned, so the parent-to-worker handoff crosses the
very boundary the check is meant to prove.

P31-T6-C therefore has no Codex leg. Its acceptance helper contains no Codex
configuration or launch path and deliberately refuses to treat a Codex worker
as an optional or skipped episode. Codex support would require a host mechanism
that demonstrably reuses the parent's named MCP connection and resident; a
second server, private bridge, manufactured transcript, or model-written
answer is not a substitute.

## Shared contract

Every supported caller begins with the compiled read contract: use `search`
in a bounded or named scope, follow only Cadence-issued locations and file
references through `read`, and select process records through `document`
identities. Large-source outlines, continuation locations, and located
refusals are copied exactly. Host file tools, shell reads, standalone excerpt
servers, caller-invented paths, and guessed ranges are not supported read
paths.
