// @ts-check
// The record readers /cad-why joins a commit through. Text in, data out: no disk, no git, no emit, no exit, no Date, no randomness. Every I/O decision belongs to why-corpus.mjs and every refusal sentence to why.mjs.
// They're new, not calls into planning-files.mjs, because nothing there parses a SUMMARY's `## Commits` table (the undo workflow reads it by model), so the commit-to-plan-task edge has no machine reader. They sit beside that module because the write side doesn't change: `parsePlanFiles` keeps its exact behavior for `plan-overlap`, and `parseSummarySnippets` keeps merging deviations with open items for the BM25 corpus.
// Sections are bound by `sectionSpan`, never `split(/^## /m)`. That idiom (which planning-files.mjs's private `sectionBody` still uses for the recall corpus) is fence-blind: a fenced `## ` line ends the section early and every row after it silently disappears. `sectionSpan` runs one never-restarted fence scanner over the whole document, and a start found fence-blind can't be repaired by a fence-aware end.
// Two grammar facts bind the commits table. The Task cell isn't an integer: `fix`, `fix 1`, `fix 2` and `fix 3` appear in shipped summaries (a review-fix round, not a task), so it's carried as the record's own string and never passed through `Number()`, which would attribute three fixes to task 0. And abbreviation width varies by era (7 characters in archived summaries, 8 in a later one), so a commit match is a case-insensitive prefix test in either direction (`shaMatches`) against a full sha, never a fixed-width slice.
// The column set varies too, which is why the header row is read instead of counted: most archived tables carry `| Plan | Task | Commit | Description |`, but an old one has three columns from before plans were numbered. Mapping by position would read its task cell as the plan and its commit cell as the task, a wrong join instead of a missing one.
// A row whose commit cell isn't hexadecimal is skipped, as parseArchiveRows does for a line that doesn't match, so a note or hand-written line inside the table mints no edge.
'use strict';

import {
  normalize, parseContextDecisions, planTaskTitles, sectionBound, sectionSpan,
} from './planning-files.mjs';
import { RULINGS } from './adjudication-record.mjs';
import { covers } from './lease-grammar.mjs';

/** The heading whose table carries the commit-to-plan-task edge. */
const COMMITS_HEADING = '## Commits';

/** A commit cell as an auditor can spend it: `git show <cell>`. */
const HEX = /^[0-9a-fA-F]+$/;

/** The four columns this reader wants, each by the header text that names it. `Plan` is optional since the three-column era predates it; its absence yields `plan: ''` instead of a shifted read. */
const COLUMNS = Object.freeze({ plan: 'plan', task: 'task', commit: 'commit', description: 'description' });

/**
 * Do two commit ids name the same commit?
 * Case-insensitive and a prefix test in either direction, because the corpus holds abbreviations of two widths and the chain holds full 40-character shas. Both sides must be hexadecimal and non-empty: a blank cell prefixes everything and would attach one row to every commit in the chain.
 *
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
export function shaMatches(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y || !HEX.test(x) || !HEX.test(y)) return false;
  return x.length <= y.length ? y.startsWith(x) : x.startsWith(y);
}

/** A markdown table row: a trimmed line that opens with `|`. */
const TABLE_ROW = /^\s*\|/;
/** A separator row - only pipes, dashes, colons and spaces between them. */
const SEPARATOR_ROW = /^\s*\|[\s|:-]*$/;
/** A cell boundary: a `|` the author did not escape. */
const UNESCAPED_PIPE = /(?<!\\)\|/;

/**
 * One table row's cells, trimmed, with the outer empties dropped.
 * Split on unescaped pipes and unescape what survives, so a description carrying a literal `\|` (the escaping milestone-prune writes into its rows) stays one cell instead of two and a split row never gets attributed to the wrong commit.
 * @param {string} line @returns {string[]}
 */
function cells(line) {
  const parts = line.trim().split(UNESCAPED_PIPE);
  if (parts.length && parts[0].trim() === '') parts.shift();
  if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map((c) => c.replace(/\\\|/g, '|').trim());
}

/**
 * The `## Commits` table of one SUMMARY.md, as rows carrying the plan, task, commit and description cells, each verbatim as the record wrote it.
 * An absent section, an absent header row and a header naming no `Commit` column all yield `[]`. That differs from a table that was read and held no conforming row, but the caller treats both as "this summary contributes no edge" and says so in its own words.
 *
 * @param {string} text one SUMMARY.md's bytes
 * @returns {Array<{plan: string, task: string, commit: string, description: string}>}
 */
export function parseCommitRows(text) {
  const lines = normalize(String(text || '')).split('\n');
  const { start, end } = sectionSpan(lines, COMMITS_HEADING);
  if (start === -1) return [];

  /** @type {Record<string, number>|null} */
  let header = null;
  const out = [];
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (!TABLE_ROW.test(line)) continue;
    if (SEPARATOR_ROW.test(line)) continue;
    const cs = cells(line);
    if (!header) {
      /** @type {Record<string, number>} */
      const found = {};
      cs.forEach((c, idx) => {
        const key = c.toLowerCase();
        for (const [name, label] of Object.entries(COLUMNS)) {
          if (key === label && found[name] === undefined) found[name] = idx;
        }
      });
      if (found.commit === undefined) return [];
      header = found;
      continue;
    }
    const at = (/** @type {string} */ name) => {
      const idx = header[name];
      return idx === undefined || cs[idx] === undefined ? '' : cs[idx];
    };
    const commit = at('commit');
    if (!HEX.test(commit)) continue;
    out.push({ plan: at('plan'), task: at('task'), commit, description: at('description') });
  }
  return out;
}

// The decision edge. An entry reaches its D-NN by explicit textual cite and nothing else: nothing in a PLAN.md or SUMMARY.md structurally references a decision (the plan's Context section is free prose), so the only honest edge is the one the author typed. Three scopes, in order, and each says which it is:
//   task   the body of the task the commits table attributed the commit to names a D-NN, the narrowest true answer
//   plan   the plan's `## Context` names one but that task's body doesn't: true of the plan, not the task, and labelled that way
//   phase  neither does, so the phase's whole decision set is printed under a phase-scoped label. Never an empty result and never a task-level edge the record doesn't carry, since an empty answer would read as "no decision governed this", a claim the corpus can't support.
// The decisions start at parseContextDecisions, which reads `## Durable decisions` first and falls back to `## Decisions` only when the durable heading is absent entirely. That's the durable-only recall surface and this command needs the whole set: here the fallback never fires, so over half the decision bullets are unreachable through it. That's by design for BM25 recall, where a phase-local decision must not be injected into a later phase's planning, and exactly wrong here, where the user asked about one file and the phase-local decision is the answer.
// So contextDecisions unions the two, durable first, de-duplicated by id so a legacy single-section file yields each decision once. It adds no second spelling of either heading's grammar: the durable half is still parseContextDecisions and the `## Decisions` half is bound by the same fence-aware sectionSpan.
// Task bodies are cut on planTaskTitles's boundaries. The anchored `### Task <n>:` grammar already exists in planning-files.mjs and a second spelling of it is the drift that rule was written against, so planTaskBodies uses it as the authority for how many tasks a plan has and cuts at the heading lines it agrees with. When they disagree about the count (a `### Task foo`, a heading inside a fence) it attributes nothing instead of attributing wrongly, and the caller falls back to the plan scope, a true statement about a coarser thing.
// The task cell maps to an ordinal only when it's a plain integer. `fix 1` and friends name a review-fix round, not a task; they resolve to no body and the answer degrades to the plan scope by saying so.

/** A decision id as a context file and the plans that cite it spell it. */
const DECISION_TOKEN = /\bD-\d+(?:\.\d+)?\b/g;

/** The plan section whose cites are plan-scoped rather than task-scoped. */
const PLAN_CONTEXT_HEADING = '## Context';

/**
 * Every distinct `D-NN` token in `s`, in first-occurrence order.
 * @param {string} s @returns {string[]}
 */
function decisionTokens(s) {
  const seen = new Set();
  for (const m of String(s || '').matchAll(DECISION_TOKEN)) seen.add(m[0]);
  return [...seen];
}

/**
 * The `### Task <n>:` chunks of one PLAN file, in file order.
 * `body` runs from the heading to the next task heading or the next column-0 `## ` section (`## Notes` after the last task isn't part of it), whichever comes first. The `## ` bound comes from sectionBound, so a fenced `## ` inside a task body can't end it early.
 * `[]` when planTaskTitles and the heading lines disagree about how many tasks there are: no attribution beats a wrong one.
 *
 * @param {string} text one PLAN file's bytes
 * @returns {Array<{ordinal: number, title: string, heading: string, body: string}>}
 */
export function planTaskBodies(text) {
  const src = normalize(String(text || ''));
  const lines = src.split('\n');
  const titles = planTaskTitles(src);
  const starts = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('### Task')) starts.push(i);
  if (!starts.length || starts.length !== titles.length) return [];

  return starts.map((start, k) => {
    const nextTask = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const rest = lines.slice(start + 1, nextTask);
    const nextSection = sectionBound(rest);
    const end = nextSection === -1 ? nextTask : start + 1 + nextSection;
    return {
      ordinal: k + 1,
      title: titles[k],
      heading: lines[start],
      body: lines.slice(start, end).join('\n'),
    };
  });
}

/** The second decision section, phase-local by construction. */
const PHASE_DECISIONS_HEADING = '## Decisions';
/** A decision bullet, as `parseContextDecisions` reads one. */
const DECISION_BULLET = /^- (D-\d+(?:\.\d+)?)\b/;

/**
 * Every decision one context file carries: the durable set parseContextDecisions returns, then the phase-local `## Decisions` bullets it deliberately doesn't, de-duplicated by id with the durable spelling winning.
 * @param {string} text @returns {string[]}
 */
export function contextDecisions(text) {
  const src = normalize(String(text || ''));
  const out = parseContextDecisions(src);
  const seen = new Set(out.map((d) => (d.match(/^(D-\d+(?:\.\d+)?)\b/) || [])[1]).filter(Boolean));

  const lines = src.split('\n');
  const { start, end } = sectionSpan(lines, PHASE_DECISIONS_HEADING);
  if (start === -1) return out;
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(DECISION_BULLET);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push(lines[i].replace(/^- /, ''));
  }
  return out;
}

/** A commits-table Task cell as an ordinal, or null when it names no task. */
function taskOrdinal(cell) {
  return /^\d+$/.test(String(cell || '').trim()) ? Number(String(cell).trim()) : null;
}

/**
 * The decision edge for one chain entry.
 *
 * @param {{planText?: string, contextText?: string, taskCell?: string}} input
 * @returns {{scope: 'task'|'plan'|'phase'|'absent', ids: string[], lines: string[]}}
 */
export function decisionsFor({ planText = '', contextText = '', taskCell = '' } = {}) {
  const decisions = contextDecisions(contextText);

  const bodies = planTaskBodies(planText);
  const ordinal = taskOrdinal(taskCell);
  const body = ordinal === null ? null : bodies.find((b) => b.ordinal === ordinal);
  const taskIds = body ? decisionTokens(body.body) : [];
  if (taskIds.length) return { scope: 'task', ids: taskIds, lines: quote(taskIds, decisions) };

  const lines = normalize(String(planText || '')).split('\n');
  const { start, end } = sectionSpan(lines, PLAN_CONTEXT_HEADING);
  const planIds = start === -1 ? [] : decisionTokens(lines.slice(start + 1, end).join('\n'));
  if (planIds.length) return { scope: 'plan', ids: planIds, lines: quote(planIds, decisions) };

  if (!decisions.length) return { scope: 'absent', ids: [], lines: [] };
  return { scope: 'phase', ids: [], lines: decisions };
}

/**
 * The context lines the cited ids name, in the ids' own cite order. A cited id the context file doesn't carry is stated instead of dropped: a plan citing a decision nobody recorded is a gap in the record, and this command exists to show those.
 * @param {string[]} ids @param {string[]} decisions
 * @returns {string[]}
 */
function quote(ids, decisions) {
  return ids.map((id) => {
    const head = new RegExp(`^${id}\\b`);
    const hit = decisions.find((d) => head.test(d));
    return hit || `${id} - cited here, but the phase's CONTEXT.md carries no such decision`;
  });
}

// The deviation edge, and the gap it has to name.
// A separate reader from parseSummarySnippets, which merges `## Deviations` with `## Open items` for the BM25 corpus and can't tell them apart afterwards. Recall wants every bullet a phase left behind; this command must never print an open item as though the plan had been wrong about something. The `[deviation]` tag is stripped the way that reader strips it, and the template's placeholder prose (`None...`, `<...>`) is skipped for the same reason: it's the template speaking, not the phase.
// The edge itself doesn't exist in machine-readable form, and the output says so by name. The execute workflow prescribes appending ` [corrected by plan-<k> deviation: ...]` to the refuted D-NN line in the context file when a deviation refutes a decision, but across the archived and recovered context files essentially none of the D-NN lines carry it, and few deviation bullets name any D-NN at all. So an entry prints the phase's deviation bullets unjoined and labelled phase-scoped, plus `MARKER_GAP`, a statement in the output that the prescribed marker is absent from the record.
// Reporting this edge as "none" is refused. "No deviation corrected a decision here" and "nothing in this corpus can express that a deviation corrected a decision" are different claims and only the second is true. Printing the first would hide the write-side gap, and fixing the write side is out of scope, which is why the gap has to be visible from the read side.

/** The section whose bullets are deviations and nothing else. */
const DEVIATIONS_HEADING = '## Deviations';

/** Every entry with a resolved phase carries this sentence beside its deviation bullets. It names the marker by its literal spelling so a reader can grep the execute workflow that prescribes it and see nothing emits it. */
export const MARKER_GAP = 'the `corrected by plan-<k> deviation:` marker '
  + '`workflows/execute.md` prescribes for a deviation that refutes a decision '
  + 'is absent from the whole record, so no deviation below is joined to a '
  + 'decision - the edge is missing on the WRITE side, not empty here';

/** Template prose, not phase content: the same two shapes parseSummarySnippets skips. */
const PLACEHOLDER = /^(?:None\b|<)/;

/**
 * One SUMMARY.md's `## Deviations` bullets with `[deviation]` stripped and the rest byte-exact. Column-0 `- ` bullets only, first line of each, since a wrapped continuation is the bullet's own tail and parseSummarySnippets reads it the same way.
 * @param {string} text @returns {string[]}
 */
export function parseDeviations(text) {
  const lines = normalize(String(text || '')).split('\n');
  const { start, end } = sectionSpan(lines, DEVIATIONS_HEADING);
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^-\s+(.*)$/);
    if (!m) continue;
    const raw = m[1].trim();
    if (!raw || PLACEHOLDER.test(raw)) continue;
    out.push(raw.replace(/^\[deviation\]\s*/, ''));
  }
  return out;
}

// The surviving review finding edge.
// Summary prose isn't a viable source, so this reads the JSON records: review sections appear in shipped summaries under five different one-off spellings, one file each, while `## Commits` appears in all of them. A reader built on the prose would be a reader of one summary.
// The source is the phase directory's `ADJUDICATION-*.json` records, taking only entries whose `ruling` is `survived` and quoting that entry's `claim`, `failure_scenario` and `counter_evidence` verbatim. The ruling vocabulary is RULINGS in lib/adjudication-record.mjs, imported instead of restated, since a second list of the rulings is a second thing to keep in step with the module that defines what a record is.
// An entry joins a commit by range, `base_id..head_id`, and resolving the range is the caller's job (why-corpus.mjs) because it needs git. What's decided here is the degradation: an entry missing either id contributes a stated absence and an issue code, never a silent drop and never a claim that the finding applies. The both-fields-present assumption was verified on one git-recovered record, not across the corpus, so the degradation path is the one that has to exist.
// Fail soft here, not closed. adjudication-record.mjs refuses a malformed record outright, rightly, because it's the writer's validator. This is a reader over records written months ago by earlier versions of that writer, and refusing the whole file would delete the other findings' evidence to punish one entry's shape. So a bad entry is skipped with an issue, and a file that won't parse yields one issue and no findings.
// A survivor naming no fix commit is a legitimate stored state, not a malformed entry. Records written before the writer's widening named a commit on every survived entry because the writer refused any that didn't; since then a survived finding raised below blocker or high is one that was confirmed and not fixed, and carries no commit id because none exists. Both parse to the survivors they always did, `fix_commit` carrying whatever the entry held, so an old record reads unchanged and a new one reads honestly.

/** The one ruling this command reads, taken positionally from RULINGS (frozen and ordered survived, downgraded, refuted) instead of spelled again. The literal is pinned in why-record.test.mjs, so a reorder of that list turns the test red instead of silently changing which findings get printed. */
export const SURVIVED_RULING = RULINGS[0];

/** A non-empty string, or null, so an absent field and a blank one are the same answer. */
const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

/**
 * The survived findings of one adjudication record.
 * `issues` are codes, not sentences: this module never names the file it was handed, so the caller that opened it writes the warning.
 *
 * @param {string} text one ADJUDICATION-*.json's bytes
 * @returns {{ok: boolean, baseId: string|null, headId: string|null,
 *   survivors: Array<{claim: string, failure_scenario: string,
 *     counter_evidence: string|null, fix_commit: string|null,
 *     file: string|null, line: number|null,
 *     severity: string|null, baseId: string|null, headId: string|null}>,
 *   issues: string[]}}
 */
export function parseAdjudication(text) {
  /** @type {string[]} */
  const issues = [];
  const empty = { ok: false, baseId: null, headId: null, survivors: [], issues };

  let record;
  try {
    record = JSON.parse(String(text || ''));
  } catch {
    issues.push('unparseable-json');
    return empty;
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    issues.push('not-a-record-object');
    return empty;
  }

  const baseId = str(record.base_id);
  const headId = str(record.head_id);
  const entries = Array.isArray(record.entries) ? record.entries : [];
  if (!Array.isArray(record.entries)) issues.push('no-entries-array');

  const survivors = [];
  for (const e of entries) {
    if (e === null || typeof e !== 'object' || Array.isArray(e)) { issues.push('entry-not-an-object'); continue; }
    if (e.ruling !== SURVIVED_RULING) continue;
    const entryBase = str(e.base_id) || baseId;
    const entryHead = str(e.head_id) || headId;
    if (!entryBase || !entryHead) issues.push('survivor-without-a-range');
    survivors.push({
      claim: str(e.claim) || '',
      failure_scenario: str(e.failure_scenario) || '',
      counter_evidence: str(e.counter_evidence),
      // through str like the optional field above: absent and blank are the same answer to whether this survivor names a fix an auditor can spend
      fix_commit: str(e.fix_commit),
      file: str(e.file),
      line: Number.isInteger(e.line) ? e.line : null,
      severity: str(e.severity),
      baseId: entryBase,
      headId: entryHead,
    });
  }
  return { ok: true, baseId, headId, survivors, issues };
}

// The task-attributed declared-files edge.
// Beside parsePlanFiles, never instead of it: plan-overlap depends on it, the write side doesn't change, and its two arms answer a different question. It returns one flat union of every path a plan names, right for "do these two plans collide" and useless for "which task declared the file I asked about".
// Its task-line arm is single-line: the Files regex stops at the newline, and well over a third of task Files lines wrap onto an indented continuation, so those declared paths are invisible to it. For the union that's harmless (a sibling task or the frontmatter usually names them); for attribution it's the difference between naming the declaring task and the wrong one. The reader below consumes the continuation lines.
// Same normalization as that arm on purpose, backticks stripped and one trailing parenthetical dropped (`planning.mjs (the seam)`), because a second cleaning rule over the same bytes is two readers disagreeing about one declaration, the defect closed between plan-overlap and lease-check. It's written out here rather than imported because that arm is an inline closure inside parsePlanFiles, and exporting it would change the function this edge leaves alone.
// Task boundaries are planTaskBodies's, which are planTaskTitles's: one anchored `### Task` grammar in this tree.
// Containment is `covers` from lib/lease-grammar.mjs and nothing else. It's the one containment predicate the pre-flight overlap gate and commit-time enforcement both read, and a fresh string comparison here would be a third opinion that eventually disagrees. It's also what lets a directory lease (`src/`) claim `src/auth.js` without this module knowing about directories.

/** A task's declared-files line. */
const FILES_LINE = /^\s*-\s*\*\*Files:\*\*\s*(.*)$/;
/** An indented, non-blank line - a continuation of whatever came before it. */
const CONTINUATION = /^\s+\S/;
/** An indented bullet opening a NEW bold field, which ends the continuation. */
const NEXT_FIELD = /^\s*-\s*\*\*/;

/** parsePlanFiles's task-line normalization: backticks and one trailing parenthetical. */
const normalizeTaskItem = (/** @type {string} */ raw) =>
  raw.replace(/`/g, '').replace(/\s*\(.*\)\s*$/, '').trim();

/**
 * The paths each `### Task <n>:` heading's `- **Files:**` line declares, continuation lines included, attributed to the task that wrote them.
 * @param {string} text one PLAN file's bytes
 * @returns {Array<{ordinal: number, title: string, files: string[]}>}
 */
export function taskDeclaredFiles(text) {
  return planTaskBodies(text).map(({ ordinal, title, body }) => {
    const lines = body.split('\n');
    const files = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(FILES_LINE);
      if (!m) continue;
      let raw = m[1];
      for (let k = i + 1; k < lines.length; k++) {
        if (!CONTINUATION.test(lines[k]) || NEXT_FIELD.test(lines[k])) break;
        raw += ` ${lines[k].trim()}`;
        i = k;
      }
      for (const part of raw.split(',')) {
        const f = normalizeTaskItem(part);
        // `{...}` is a template placeholder, the skip `parsePlanFiles` takes.
        if (f && !f.startsWith('{') && !files.includes(f)) files.push(f);
      }
    }
    return { ordinal, title, files };
  });
}

/**
 * Which of a plan's tasks declared the queried path, and by which declaration. A task may claim it through a directory lease, so the declaration comes back with the task.
 * @param {string} text one PLAN file's bytes @param {string} path repo-relative
 * @returns {Array<{ordinal: number, title: string, declaration: string}>}
 */
export function declaringTasks(text, path) {
  const out = [];
  for (const task of taskDeclaredFiles(text)) {
    const declaration = task.files.find((f) => covers(f, path));
    if (declaration) out.push({ ordinal: task.ordinal, title: task.title, declaration });
  }
  return out;
}
