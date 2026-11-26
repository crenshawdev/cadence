// @ts-check
// agile-render.mjs - a read Seldon design as the agile path's files; every word comes from the design, none from a model
// pure: values in, text out, no fs and no process
'use strict';

import { CHECK_LINE, requirementPrefix } from './agile-read.mjs';
import { FRONTMATTER_RE } from './frontmatter.mjs';
import { sectionSpan } from './planning-files.mjs';
import { fenceScanner } from './text-util.mjs';

/** @typedef {import('./seldon-design.mjs').Phase} Epic */

/** @param {string[]} blocks one per paragraph, list or heading @returns {string} */
const page = (blocks) => `${blocks.join('\n\n')}\n`;

/** @typedef {import('./seldon-design.mjs').Decision} Decision */

/** @param {Decision} d */
const decisionLine = (d) => `- **${d.id}: ${d.title}** (${d.kind}): ${d.text}`;

/** The decisions that limit the whole project. @param {Decision[]} decisions */
export const limits = (decisions) => decisions.filter((d) => d.kind === 'stack' || d.kind === 'hosting');

/**
 * Every spine decision has a home: stack and hosting here as constraints, the ones an epic names in that epic's file, and
 * any that no epic names here as key decisions.
 * @param {string} title @param {Record<string, string>} brief @param {Epic[]} epics @param {Decision[]} decisions
 * @returns {string}
 */
export function renderProjectFile(title, brief, epics, decisions) {
  const section = (/** @type {string} */ name) => [`### ${name}`, brief[name]];
  const named = new Set(epics.flatMap((e) => e.spine_decisions).map((d) => d.id));
  const limited = limits(decisions);
  const key = decisions.filter((d) => !limited.includes(d) && !named.has(d.id));
  return page([
    `# ${title}`,
    '## What it is',
    ...section('Problem'), ...section('Solution'), ...section('Who it serves'), ...section("What's different"),
    ...section('Success criteria'), ...section('Scope'), ...section('Vision'),
    '## Out of scope',
    brief['What it refuses'],
    '## Constraints',
    limited.map(decisionLine).join('\n') || 'None.',
    '## Key decisions',
    key.map(decisionLine).join('\n') || 'None yet.',
  ]);
}

/** @param {{id: string, text: string}} q */
const requirementLine = (q) => `- **${q.id}**: ${q.text}`;

/**
 * The release's requirements in Seldon's own bullet, under their PRD categories, then the deferred ones.
 * @param {string} title @param {import('./seldon-design.mjs').Requirement[]} requirements
 * @param {{id: string, text: string}[]} [deferred] @returns {string}
 */
export function renderRequirementsFile(title, requirements, deferred = []) {
  /** @type {string[]} */
  const blocks = [];
  /** @type {string | null} */
  let category = null;
  for (const q of requirements) {
    const bullet = requirementLine(q);
    if (q.category !== category) blocks.push(`### ${q.category}`, bullet);
    else blocks[blocks.length - 1] += `\n${bullet}`;
    category = q.category;
  }
  return page([`# Requirements: ${title}`, '## Requirements', ...blocks, '## Deferred', deferred.map(requirementLine).join('\n') || 'None.']);
}

/**
 * REQUIREMENTS.md once a refinement changed the ask: each added one after the last of its prefix, then each deferred
 * one moved under Deferred. One a run cut short already moved or added is left where it is.
 * @param {string} text the file `read` came from, which read `whole` @param {ReturnType<typeof import('./agile-read.mjs').readRequirementsFile>} read
 * @param {string[]} defer @param {{id: string, text: string}[]} add @returns {string}
 */
export function renderAskChanged(text, read, defer, add) {
  const held = [...read.requirements];
  for (const q of add) {
    if (held.some((h) => h.id === q.id)) continue;
    const prefix = requirementPrefix(q.id);
    const last = held.map((h) => requirementPrefix(h.id)).lastIndexOf(prefix);
    // every one of its prefix deferred leaves no category to sit in, so the prefix names its own
    held.splice(last < 0 ? held.length : last + 1, 0, { ...q, category: last < 0 ? String(prefix).replace(/-$/, '') : held[last].category });
  }
  const moving = held.filter((h) => defer.includes(h.id));
  const out = renderRequirementsFile(String(read.title), held.filter((h) => !moving.includes(h)),
    [...read.deferred, ...moving.map(({ id, text: said }) => ({ id, text: said }))]);
  return text.includes('\r\n') ? out.replaceAll('\n', '\r\n') : out;
}

/**
 * @param {string} title @param {Record<string, string>} brief @param {Epic[]} epics
 * @param {string} [commitHere] the protected branch the start was told to commit on anyway
 * @returns {string}
 */
export function renderReleaseFile(title, brief, epics, commitHere) {
  return page([
    `# Release: ${title}`,
    '## Goal',
    brief['Success criteria'],
    '## Epics',
    epics.map((e) => `- ${e.epic}: ${e.name}`).join('\n'),
    ...(commitHere ? ['## Branch', `- Commit here anyway: ${commitHere}`] : []),
  ]);
}

/** @param {Epic} e @returns {string} */
export function renderEpicFile(e) {
  return page([
    ['---', `epic: ${e.epic}`, `title: ${e.name}`, 'status: backlog',
      `builds_on: ${e.builds_on.join(', ') || 'None'}`, `requirements: ${e.requirements.join(', ')}`, '---'].join('\n'),
    `# ${e.epic}: ${e.name}`,
    '## Outcome',
    e.description,
    '## Boundaries',
    e.boundaries,
    '## Done when',
    e.success_criteria.map((c) => `- ${c}`).join('\n'),
    '## Spine decisions',
    e.spine_decisions.map(decisionLine).join('\n') || 'None.',
    '## Decisions',
    'None yet.',
  ]);
}

/** @typedef {import('./agile-read.mjs').Story} Story */

/** An S is built without a written plan, so it has no section for one. @param {Story} s @returns {string} */
export function renderStoryFile(s) {
  return page([
    ['---', `story: ${s.id}`, `title: ${s.title}`, `size: ${s.size}`, `status: ${s.status}`,
      `builds_on: ${s.builds_on.join(', ') || 'None'}`, `requirements: ${s.requirements.join(', ')}`, '---'].join('\n'),
    `# ${s.id}: ${s.title}`,
    '## Delivers',
    s.delivers,
    '## Accepted when',
    s.accepted_when.map((c) => `- ${c}`).join('\n'),
    ...(s.size === 'S' ? [] : ['## Plan', 'None yet.']),
    '## Result',
    'None yet.',
  ]);
}

/**
 * An epic's file with one section changed and every other line as it was.
 * @param {string} text an epic file `readEpicFile` reads @param {string} heading @param {(held: string[]) => string[]} change
 * @returns {string}
 */
function withSection(text, heading, change) {
  // split as the readers do, or a Windows line ending hides the section from this one alone
  const lines = text.split(/\r?\n/);
  const { start, end } = sectionSpan(lines, heading);
  const held = lines.slice(start + 1, end).join('\n').trim();
  const out = page([lines.slice(0, start).join('\n').trimEnd(), heading,
    change(held === '' || held === 'None yet.' ? [] : held.split('\n')).join('\n') || 'None yet.',
    ...(end < lines.length ? [lines.slice(end).join('\n').trimEnd()] : [])]);
  return text.includes('\r\n') ? out.replaceAll('\n', '\r\n') : out;
}

/** @param {string} text @param {(held: string[]) => string[]} change */
const withDecisions = (text, change) => withSection(text, '## Decisions', change);

/** The Result lines a script writes, in the order they're written. */
const RESULT_KINDS = Object.freeze(['Base', 'Commits', 'Resized', 'Review', 'Fix round', 'Done differently']);
const kindOf = (/** @type {string} */ line) => (CHECK_LINE.test(line) ? 'Check' : RESULT_KINDS.find((k) => line.startsWith(`- ${k}: `)) ?? null);

/**
 * A story with Result's lines of these kinds replaced, the script's lines in their own order after any other, and its
 * status when given.
 * @param {string} text a story file `readStoryFile` reads
 * @param {{kind: string, line: string}[]} lines each a whole line, `kind` one of RESULT_KINDS or `Check`
 * @param {string} [status]
 */
export function renderStoryResult(text, lines, status) {
  const kinds = new Set(lines.map((l) => l.kind));
  const order = (/** @type {string} */ l) => { const k = kindOf(l); return k === 'Check' ? RESULT_KINDS.length : RESULT_KINDS.indexOf(/** @type {string} */ (k)); };
  const out = withSection(text, '## Result', (held) => {
    // a kind given an empty line is taken out
    const mine = [...held.filter((l) => kindOf(l) !== null && !kinds.has(/** @type {string} */ (kindOf(l)))), ...lines.map((l) => l.line).filter(Boolean)];
    // a stable sort, so check lines stay in the order they came
    return [...held.filter((l) => kindOf(l) === null), ...mine.sort((x, y) => order(x) - order(y))];
  });
  // the frontmatter's own line, spaced or not as the reader allows, never a "status:" further down the file
  return status === undefined ? out
    : out.replace(FRONTMATTER_RE, (block) => block.replace(/^status:[ \t]*\S+[ \t]*$/m, `status: ${status}`));
}

/** An epic or story whose status changed, its frontmatter's own line and no other. @param {string} text @param {string} status */
export const withStatus = (text, status) => text.replace(FRONTMATTER_RE, (block) => block.replace(/^status:[ \t]*\S+[ \t]*$/m, `status: ${status}`));

/** A story sized again, its frontmatter's own line and no other. @param {string} text @param {string} size */
export const withSize = (text, size) => text.replace(FRONTMATTER_RE, (block) => block.replace(/^size:[ \t]*\S+[ \t]*$/m, `size: ${size}`));

/** An M with its plan written, one line per task. @param {string} text an M's story file @param {string[]} tasks */
export const renderStoryPlan = (text, tasks) => withSection(text, '## Plan', () => tasks.map((t, i) => `- Task ${i + 1}: ${t}`));

/** The check lines for these checks. @param {import('./agile-read.mjs').Check[]} checks */
export const checkLines = (checks) => checks.map((c) => ({ kind: 'Check', line: `- Check ${c.n}: \`${c.command}\` - ${c.result}` }));

/** The user's answers, each under its question, over any earlier answer to it. @param {string} text @param {{question: string, answer: string}[]} answers */
export function renderAnswers(text, answers) {
  return withDecisions(text, (held) => {
    const lines = [...held];
    for (const { question, answer } of answers) {
      const at = lines.findIndex((l) => l.startsWith(`- **${question}** `));
      lines.splice(at < 0 ? lines.length : at, at < 0 ? 0 : 1, `- **${question}** ${answer}`);
    }
    return lines;
  });
}

/** An epic the user didn't accept yet, what's missing in its Decisions. @param {string} text @param {string} missing */
export const renderNotYet = (text, missing) => withDecisions(text, (held) => [...held, `- Not yet: ${missing}`]);

/**
 * An accepted epic's retrospective: the Evidence a script read, then the three sections the user approved.
 * @param {{id: string, name: string, date: string, evidence: string[], went_well: string[], do_better: string[], change_next: string[]}} r
 */
export function renderRetro(r) {
  const list = (/** @type {string[]} */ lines, numbered = false) => (lines.length ? lines.map((l, i) => `${numbered ? `${i + 1}.` : '-'} ${l}`).join('\n') : 'None.');
  return page([`# ${r.id} ${r.name} retrospective`, `Accepted ${r.date}.`, '## Evidence', r.evidence.join('\n'),
    '## What went well', list(r.went_well), '## What could we do better', list(r.do_better), '## Change next', list(r.change_next, true)]);
}

/** @typedef {{from: string, line: number, text: string, outcome: string, how: string}} Lesson */

/** A Change next line's record under the refined epic's Decisions, as `LESSON_RECORD` reads it. @param {Lesson} l */
export const lessonRecord = (l) => `Change next from ${l.from}, ${l.line}: ${l.outcome === 'standing' ? 'applied, standing' : l.outcome} - ${l.how}`;

const STANDING = '## Standing rules';

/** The Standing rules heading's line, -1 when there's none, and the line its section ends before. @param {string[]} lines */
function standingSpan(lines) {
  const fenced = fenceScanner();
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (fenced(lines[i])) continue;
    // whole and unindented, so a heading a design planted in the brief, indented or fenced, is never taken for this one
    if (start < 0) { if (lines[i] === STANDING) start = i; } else if (/^## /.test(lines[i])) { end = i; break; }
  }
  return { start, end };
}

/**
 * A new release's project.md with the Standing rules of the one it replaces, as they stand: the rest comes from the new
 * design, and the rules are what the earlier releases learned.
 * @param {string} text the new project.md @param {string | null} was the one it replaces, or null when there's none
 * @returns {string}
 */
export function withStandingRules(text, was) {
  const lines = (was ?? '').split(/\r?\n/);
  const { start, end } = standingSpan(lines);
  const block = start < 0 ? '' : lines.slice(start + 1, end).join('\n').trim();
  return block === '' ? text : page([text.trimEnd(), STANDING, block]);
}

/**
 * project.md with its Standing rules matching these lines: a standing one held once, under the retrospective's own
 * words, and one no longer standing taken out. The section is made at the end when it isn't there.
 * @param {string} text project.md @param {Lesson[]} lessons @returns {string} the text itself when nothing changes
 */
export function renderStandingRules(text, lessons) {
  const lines = text.split(/\r?\n/);
  const { start, end } = standingSpan(lines);
  const tag = (/** @type {Lesson} */ l) => ` (${l.from}, Change next ${l.line})`;
  const block = start < 0 ? '' : lines.slice(start + 1, end).join('\n').trim();
  const held = block === '' || block === 'None yet.' ? [] : block.split('\n');
  const kept = held.filter((h) => !lessons.some((l) => h.endsWith(tag(l))));
  const rules = [...kept, ...lessons.filter((l) => l.outcome === 'standing').map((l) => `- ${l.text}${tag(l)}`)];
  if (JSON.stringify(rules) === JSON.stringify(held)) return text;
  const out = start < 0 ? page([lines.join('\n').trimEnd(), STANDING, rules.join('\n')])
    : page([lines.slice(0, start).join('\n').trimEnd(), STANDING, rules.join('\n') || 'None yet.',
      ...(end < lines.length ? [lines.slice(end).join('\n').trimEnd()] : [])]);
  return text.includes('\r\n') ? out.replaceAll('\n', '\r\n') : out;
}

/**
 * An epic's file once its stories are approved: in progress, with the decisions under any it already holds, its
 * requirements line rewritten only when the ask changed, and the Done when lines a split took gone.
 * @param {string} text @param {string[]} decisions @param {string[] | null} requirements @param {string[]} [moved]
 * @returns {string}
 */
export function renderRefinedEpic(text, decisions, requirements, moved = []) {
  const status = text.replace(/^status:.*/m, 'status: in-progress');
  const turned = requirements ? status.replace(/^requirements:.*/m, `requirements: ${requirements.join(', ')}`) : status;
  const kept = moved.length ? withSection(turned, '## Done when', (held) => held.filter((l) => !moved.includes(l.replace(/^[-*] /, '').trim()))) : turned;
  return withDecisions(kept, (held) => [...held, ...decisions.map((d) => `- ${d}`)]);
}

/** @typedef {{id: string, name: string, outcome: string, requirements: string[], done_when: string[]}} Rest */

/**
 * The epic a split makes of the rest: it builds on the one it came from and keeps its Boundaries and Spine decisions.
 * `split_from` is how a split cut short is told from the design's own epics.
 * @param {Rest} rest @param {{id: string, boundaries: string, spine: string}} from @returns {string}
 */
export function renderSplitEpic(rest, from) {
  return page([
    ['---', `epic: ${rest.id}`, `title: ${rest.name}`, 'status: backlog', `builds_on: ${from.id}`,
      `requirements: ${rest.requirements.join(', ')}`, `split_from: ${from.id}`, '---'].join('\n'),
    `# ${rest.id}: ${rest.name}`,
    '## Outcome',
    rest.outcome,
    '## Boundaries',
    from.boundaries || 'None.',
    '## Done when',
    rest.done_when.map((c) => `- ${c}`).join('\n'),
    '## Spine decisions',
    from.spine || 'None.',
    '## Decisions',
    'None yet.',
  ]);
}

/** release.md with the rest listed right after the epic it came from, so it's built next. @param {string} text @param {string} after @param {Rest} rest */
export function renderReleaseSplit(text, after, rest) {
  const lines = text.split(/\r?\n/);
  lines.splice(lines.findIndex((l) => l.startsWith(`- ${after}: `)) + 1, 0, `- ${rest.id}: ${rest.name}`);
  return lines.join(text.includes('\r\n') ? '\r\n' : '\n');
}
