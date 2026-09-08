# Native configuration and routing contract

The binary supplies configuration facts and persists changes through
`cadence_query` and `cadence_apply`. The tool list also contains
`cadence_version`; configuration adds operations, not tools. Replies retain the
phase-7 structured envelope (`status`, and `code`/`reason` on refusal). No shell
or terminal conversation runs on MCP stdio.

`config-facts` returns supported keys with raw stored values, presence,
effective values, source layers, validation constraints, active paths,
diagnostics, retirement evidence and the ordinary interview. `config-entry`
takes literal `tokens` and prepares the no-argument knob walk, `--roles`,
`--roles --global`, `--surfaces`, `--review [redetect]`, or key/value updates.
Only the first equals sign separates a key from its value. String values retain
spaces, quotes, equals signs and Unicode; the exact token `null` requests a
reset. The host does not evaluate or normalize tokens. Suggested updates use
`config-apply` only after an explicit accepted answer.

`config-interview` takes `mode`: `roles`, `global`, `new-project`, `adopt` or
`suggestion`. Its facts contain thirteen ordered subjects, each with purpose,
cost explanation, current/default value, stored presence, source and schema
constraints. Ordering is planner, assumptions analyzer, verifier, reviewer,
executor, plan checker, with model then effort for each, followed by the
plan-time floor. Raw absence of the global `roles` key means first run. When
global aliases repo, the same physical raw repo input determines presence and
retains repo provenance. Empty/partial roles are later-run inputs; the separate
stored-leaf coverage list is not a completion marker. All thirteen questions
still appear on every ordinary invocation.

`config-interview-apply` takes the returned mode and captured inputs, an explicit
`accepted` boolean and the thirteen ordered `answers` (`key`, literal `value`).
False acceptance or absent answers performs no settings write. A complete first
answer writes twelve role leaves globally, including null models and accepted
schema efforts, plus the floor answer in one transaction. Later ordinary answers
write only role diffs from the captured effective values to repo. Explicit global
editing shows global values and writes to the global address. Intake and role
suggestion modes reuse this service without implementing their later workflows.

"Keep it for every surface" means a stored
`review.triggers.risk_surface.waive_routing_floor: []`. The unanswered schema
default is null; it is not an accepted answer. An explicit empty array is pinned
in the selected layer even if effective protection looks identical. An existing
identical pin may be a no-op. A global empty array cannot override a stronger
repo waiver; responses report the actual effective value and repo source.
`detect-surfaces` separately returns phase-7 structural evidence and options.
Accepting that question writes only `review.triggers.risk_surface.surfaces`, the
actual-diff selected set, and declining makes no write.

The interview binds identity, exact content digest, file identity stamp and alias
status for both controlling inputs. Validation runs before preparing changes,
inside writer ownership at admission, and again at final transaction policy
validation. Stale conversational intent returns a config conflict. The shared
batch validates every update and effective configuration before saving any;
there is no separate interview writer or series of individual setters. The
checked transaction also validates no-op acceptance under ownership. Once a
transaction is durably admitted, ordinary exact-participant recovery applies;
no conversational token is persisted as migration or completion state.

Original `stakes` values are disclosed with layer/path and the static statement
that the level is retired. Preserved evidence remains immutable; unavailable
evidence is named as unavailable. The ordinary questions use current settings,
without expansion, accepted/dismissed retirement state or original-file edits.
Invalid active configuration returns `config-unavailable` with its named
key/layer/path and repair-required reason. The skill stops; it cannot repair JSON
or retry a setter against invalid controlling config. Native live-provider setup
is unavailable until the later review-delivery phase; `--review [redetect]`
returns `review-setup-unavailable` before opening a settings session.

Stored role model/effort values outrank legacy pins. Present model null inherits
the session by omitting the dispatch model parameter; present effort null chooses
the role schema default. Both resets defeat their corresponding older pins.
Absence permits legacy fallback; injected defaults are not stored pins. Model
text remains literal through storage; dispatch resolution owns compatibility.
Requested effort records intent and does not establish observed host effort or
receipt evidence. Live host behavior belongs to the phase's manual checklist.

The public `route` bundle includes the saved role choice and its source/reset,
attempt, escalation and pin explanations, plus the current generation and review
policy. Policy contains only surviving schema gate rows: `plan`, `diff` and
`risk_surface`, each with gate, explicit gate layer, reviewer set, tier and
requested effort. A provider qualifies only when its configured model ID at that
trigger's tier is nonblank. `claude-subagent` always qualifies; an empty result
falls back to it with a reason naming the trigger and tier. Diagnostics name
every dropped provider and missing setting. These are configured eligibility
facts, without provider discovery, credentials, review invocation or settlement.
Surface answers share phase 7's distinction between unanswered null/absence,
invalid empty arrays and answered valid arrays. Unanswered or invalid selection
keeps every category in the declared-floor scan and is reported explicitly.

Planner and assumptions analyzer bypass declared-scope I/O. Without an explicit
phase, the floor is not computed. A named plan is read only at that phase's
`PLAN-N.md` address; otherwise the floor uses the numeric-order union of the
phase's native plans. Each plan must pass `parse_plan`, including its exact file
and directory lease grammar. Task prose never contributes paths. Missing,
unreadable, malformed or empty scope produces an incomplete result.

Declared bodies use the shared risk signal table with whole-body evidence labels.
Documents and the documented signal-table files exclude body matching while
retaining path signals. Import-only and literal-constant-only category evidence
is withheld with a reason; executable initializer calls still count. These
exclusions do not affect actual Git diff classification or excuse a failed read.

Native scope acquisition corrects the frozen reference's catch-all metadata
failure: only genuine NotFound contributes a new file path without a body.
Metadata, traversal and canonicalization errors remain incomplete observations.
Even missing leaves require a contained observable parent. Final symlinks and
nonregular bodies are rejected before opening; regular bodies are opened through
contained directory handles with identity checks and bounded reads. Replacement,
growth, invalid UTF-8 and failed reads remain incomplete. Directory leases walk
all descendants in sorted order, including ignored paths, without following
symlinks; overlapping paths are counted once. Each body is bounded to 512 KiB,
source reads to 16 MiB, and the walk to 4096 entries. Crossing a bound reports
incomplete scope; it never supplies a silently truncated clean answer.

An unwaived selected-category match or incomplete required scope recommends deep
verification and raises a default plan gate to blocking. A valid explicitly
stored plan gate wins, including an inherited global value equal to the schema
default. Blocking and adjudicated gates remain at least blocking. Waivers apply
per category and cannot waive failed observations. Repo [] clears an inherited
waiver; global [] leaves a stronger repo waiver visible. The floor changes no
model, starting or escalated rung, other review gate, or actual-diff surface set.
Deep verification is a recommendation and records no verifier execution.

Public routing and new execution admission use the same completed resolver over
one refreshed configuration generation. Execution retains the existing disabled
review-dispatch policy; the bundle supplies routing facts only. A replay keeps
its admitted model/rung, while a new dispatch and fresh public facts resolve
current settings. Failed config reload still refuses through the existing
synchronous validation seam.

New dispatch admission compares the captured resolved input identities, exact
byte digests, file stamps, presence and alias status after preparing participants
and immediately before installing the durable intent. The production writer
holds its root and shared config destination ownership through this check and
confirmation. Generation numbers are diagnostic counters, not config identities.
A changed input returns the typed unconfirmed failure `routing-inputs-changed`;
no worker prompt or successful routing admission is returned, and the resident
remains reusable because no intent was installed. Failed reload
retains its controlling-policy refusal. A later query can select current inputs.

A routed active dispatch needs its exact Routing decision and matching confirmed
dispatch boundary. Recovery validates that join even when a supplied intent has
consistent recomputed JSON digests. The stored model, mapped agent, requested
rung, source settings and reason trail remain the historical admission facts.
Recovery checks current config usability without comparing historical selection
to new settings; valid edits affect the next new dispatch. Missing observed
effort and receipt remain `Evidence::Missing`, never inferred from a requested
rung or agent frontmatter. Admission persists the route and boundary in one intent, without a later
standalone decision append.

The binary assertions use separate saved-input fixtures for sonnet/high,
opus/xhigh, and a model-only null reset retaining xhigh. They establish exact
stored bytes, resolution sources and reasons, dispatch identities, atomic
routing records and the prompt renderer's bytes for supplied dispatch/schema
values, including its historical rendering. The service supplies the real
executor patch schema to that same pure renderer; grouped schema assertions
separately cover the three tools and malformed-call refusals. The shipped skill
uses those binary parameters. Whether a host loads the skill, honours its model
and agent choice, or preserves prompt/patch bytes remains the AC4/AC10 manual
checklist work. These tests invoke no host or model.
