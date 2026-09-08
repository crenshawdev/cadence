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
