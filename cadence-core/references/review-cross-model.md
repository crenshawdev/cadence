# Cross-model review: composing the payload, calling the provider

`references/review-triggers.md` step 4 decides WHETHER this arm runs: step 3's
resolved set has to hold a provider other than `claude-subagent`, which a
project that never set `review.reviewers` never does. That step also holds the
rules a caller owes whether or not it reaches here - no lifecycle bracket, where
the tier and the effort come from, naming an `ok:false` reviewer before dropping
it, and the empty-set fallback. This file is the PROCEDURE once the branch is
taken, and nothing else in the review subsystem reads it.

## The cross-model arm

- **any cross-model provider** (`openai` / `gemini` / `deepseek`, ...): an API
  call runs nothing, so this is the one backend that cannot resolve a reference
  itself. **This arm gets NO lifecycle bracket and no token field, deliberately.**
  It is the one place a real API-reported usage figure could exist rather than a
  host-reported one, and no adapter extracts one today. State the consequence
  rather than let a reader infer completeness: under a panel, `cad-reviewer`'s
  per-role total in `trace render` covers the claude-subagent voice ONLY, and the
  provider call that ran beside it is unmeasured, so that number is short by an
  unstated amount. Compose the payload FILE inside THIS RUN's own scratch
  directory and pass it with the EXISTING `--payload <file>` flag - no new
  subcommand or flag:
  ```
  D="$(mktemp -d "${TMPDIR:-/tmp}/cad-review-XXXXXX")" \
    && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D holds a character a carried literal cannot survive" >&2; exit 1;; esac \
    && T="$$-$(date +%s)" && printf '%s' "$T" > "$D/run-token" \
    && git diff <base_ref>..<head_ref> > "$D/artifact.txt" \
    && node -e 'const f=require("fs");const rd=(p)=>{try{return f.readFileSync(p,"utf8")}catch(e){console.error("scratch-unreadable: "+p+": "+e.message);process.exit(1)}};const brief=rd(process.argv[1]),art=rd(process.argv[3]);if(art===""){console.error("scratch-unreadable: "+process.argv[3]+" is empty");process.exit(1)}f.writeFileSync(process.argv[4],JSON.stringify({instruction:brief+"\n\n"+process.argv[2],artifact:art}))' "${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md" "<instruction>" "$D/artifact.txt" "$D/payload.json" \
    && echo "scratch dir: $D  run token: $T"
  ```
  A carried literal is pasted into a later command unquoted-by-construction, so the guard REFUSES the directory at creation rather than trying to quote it defensively at every use site: `mktemp` builds the path from `$TMPDIR`, which the operator does not always own (a cloned repo's `.envrc`, a devcontainer, a CI runner), and one `"` in it closes the argument and runs the rest as commands. The character class is deliberately narrow - a `TMPDIR` holding a space is refused too, and fixing that is one `export` away, where a path that executes is not.

  **The directory and the token are ECHOED because the seam call below runs in a
  DIFFERENT Bash invocation**, where `$D` is empty - the tool persists the
  working directory and not shell state. Carry both printed values into that
  block as LITERALS. A fixed shared scratch name here is the worst collision in
  the tree: a concurrent review in another repository would be the one whose
  diff is sent to the provider under this run's instruction, at a gate that
  blocks. The token is what a carried path needs, because a previous run's
  payload is well-formed BY CONSTRUCTION and no shape guard can tell it from
  this run's.
  The composer REFUSES rather than composing something the provider would
  accept: a brief or an artifact it cannot read, and an artifact that is EMPTY,
  each name `scratch-unreadable` on stderr and exit non-zero without writing a
  payload. The empty case is not defensive padding - an empty artifact is
  exactly what a failed or colliding redirect leaves behind, and it would
  otherwise be sent as a review of nothing.
  The `instruction` is the reviewer BRIEF followed by this trigger's own
  sentence, never the sentence alone.
  `references/reviewer-brief.md` is the stance, the severity definitions, the
  "approach differences are NOT findings" rule and the empty-findings rule -
  the bar the claude-subagent arm gets from `skills/cad-reviewer-contract` and
  this arm had no way to receive, so the two backends' findings were being
  merged blind while only one of them had been told what a `blocker` is. The
  same `node -e` step reads it, for the same reason it reads the artifact:
  nothing is hand-assembled.
  It is composed HERE, at the fire site, and NOT inside `review-provider.mjs`
  because `assertUnderCap` measures the payload's parsed string FIELDS - bytes
  added here are inside what the cap counts, so an over-cap payload is still
  refused before any request is issued, while bytes added in the seam would be
  invisible to it (the cap deliberately excludes the adapters'
  schema-injection bytes) and every provider's cap would under-report by the
  brief. The cost is measured, not unknown: about 670 estimated tokens against
  the 120,000 default `review.max_prompt_tokens`, ~0.6% of one payload.
  The composing step takes the artifact path as its THIRD argument and the
  payload path it WRITES as its fourth. Both are arguments, and that is what
  lets all three shapes share the step: shape (b) redirects `git diff --cached`
  into the same run directory in place of the range diff, and shape (c) drops
  the diff step and passes its OWN absolute path as that third argument.
  Hardcode either name - as the payload path was, derived inside the script
  from the environment - and shape (c) has no command at all, and every run
  writes over every other run: it silently ships the previous review's file.
  NEVER hand-assemble that JSON
  with `echo` or a heredoc - one
  unescaped quote or backslash anywhere in a diff makes the payload
  unparseable, which comes back as `bad-payload` after the shell already did
  the work. Both files are the model's own scratch inside that run directory,
  never a phase artifact, and the directory is left for the operating system to
  reap.
  `assertUnderCap` is UNCHANGED and still measures the parsed string fields,
  which under `--payload <file>` ARE the file's contents; a non-string
  `artifact` is still refused `bad-payload` before the cap is consulted. Then
  take this trigger's tier and effort off the step-1 line -
  `reviewer_tiers[<trigger>]` and `reviewer_efforts[<trigger>]` - index the
  provider's own map with the tier
  (`model = review.providers.<name>.tiers[<the resolved tier>]`),
  and run the seam with that model and that effort. Check the run token FIRST,
  in the same invocation, so a carried path that is not this run's refuses
  instead of being sent:
  ```
  [ "$(cat "<the echoed scratch directory>/run-token" 2>/dev/null)" = "<the echoed run token>" ] || { echo "scratch-stale: that directory holds another run payload" >&2; exit 1; }
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" review \
    --provider <name> --model <model> --effort <effort> --trigger <trigger> \
    --payload "<the echoed scratch directory>/payload.json" \
    [--key-file <review.key_file, only if set>]
  ```
  Both `<the echoed ...>` placeholders are the literals the composition block
  printed, never a fresh `mktemp` and never a `$(...)` - a path is the
  caller-derived-text rule `references/conventions.md` states, and re-deriving
  the directory here would point `--payload` at an empty one.
  `--trigger` is what JOINS this arm's seam-written event to the fire: the event
  it writes already shares the phase's correlation id, and the trigger name is
  the field that was missing. That event plus the subagent arm's `--reviewer`
  field are what make two fires of ONE trigger - one cross-model, one subagent -
  distinguishable in the record afterwards.
  Read the one JSON line.
  - `ok:true` -> use `findings`. An envelope carrying `redactions: <n>` means
    the seam's outbound fence replaced that many credential-shaped spans before
    sending (references/seam-review-provider.md); say so in one line, since the
    reviewer read a smaller artifact than this step composed. Do NOT filter here
    as well: a second copy of that regex is the drift D-14 keeps out of the
    tree, and it would sit outside what `assertUnderCap` measures.
  **Run this with an explicit command timeout of at least
  `review.request_timeout_ms`** (default 540000; the host's own default is
  120000 and its ceiling 600000). Without one the host kills the command
  first, and a host kill prints NOTHING - the "one JSON line" below is then an
  empty string, strictly worse than the `{ok:false, reason:"transport"}` this
  seam degrades to on its own timer. A high-effort review legitimately takes
  minutes (a flagship model on a ~13KB diff measured 292s), and the bound is a
  socket INACTIVITY timeout on an unstreamed response, so it caps total
  thinking time rather than detecting a dead
  connection. Set it too low and the blocking gates lose their cross-model
  voices to `reason:"transport"` while still reporting PASS.
  - `ok:false` -> this reviewer is unavailable or unusable. Before dropping it,
    emit one visible line naming the degradation - the reviewer and its
    `reason` (`no-key` names where to set the key), e.g. "cross-model reviewer
    `openai` unavailable: no-key (set $OPENAI_API_KEY) - dropping it from the
    reviewer set". Do not swallow the reason silently. Drop the reviewer from
    the set. If dropping it empties the set, fall back to `claude-subagent`
    rather than return nothing - and RUN `review-triggers.md` step 4's
    `claude-subagent` arm to do it, which brackets the dispatch AND closes it:
    append that arm's `lifecycle/dispatch`, dispatch, then `trace close` the
    moment the returned object is parsed, taking its `--detail-file` checkpoint
    arm when the dispatch failed, returned nothing or returned something
    unparseable. Leaving this branch does not leave the bracket behind - a
    fallback that dispatches without a close leaves the fire `unpaired` for
    good. A payload over `review.max_prompt_tokens` arrives here as
    `reason: over-cap`, refused before any request was issued.
