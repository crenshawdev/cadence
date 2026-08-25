// @ts-check
// planning/task-record.mjs - `task-record`: the artifact a /cad-task run leaves
// behind (FST-01).
'use strict';

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RISK_DIFF_MAX_BUFFER, fail, ok, resolveRange, riskRef } from './core.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { emit } from '../lib/seam-io.mjs';
import {
  MAX_SLUG_LENGTH, RECORD_FILE, TASKS_DIR, insideRoot, isTaskSlug, renderTaskRecord,
} from '../lib/task-record.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';
import { appendEvent } from '../lib/trace.mjs';

// ---------------------------------------------------------------------------
// task-record - the artifact a `/cad-task` run leaves behind (FST-01).
//
// THE HOLE IT FILLS. The fast path is the one most real work takes, and until
// now it left commits and nothing else: no artifact the recall corpus could
// index and nothing `/cad-why` could join a commit back to. The phase spine got
// the design attention because Cadence's own work is always the heavy kind.
//
// CODE WRITES IT, never workflow prose holding `Write`/`Edit` (D-07).
// lib/capture-file.mjs's header records what that shape cost this queue: five
// filed bullets were lost because a model wrote them below a heading the recall
// walk does not visit, and nothing could fail. `cmdCiteCount` and
// `cmdRiskCheckRun` are the in-code precedents, down to appending their own
// `outcome` event before the envelope is emitted.
//
// EVERY FIGURE IS DERIVED FROM THE RANGE, never retyped onto a flag. The
// commits table comes from one `git log` and the declared-files line from one
// `git diff --name-only`, both over the ids `resolveRange` resolved - so a
// re-run over an unchanged range rewrites byte-identical bytes, which is what
// makes the record evidence rather than a claim about the range.
//
// WHERE IT LANDS is lib/task-record.mjs's, and so is what it looks like: the
// writer here, the recall walk in `cmdRecall` and `/cad-why`'s task tier are
// three readers of one fact, which is exactly the split that lost those five
// bullets.
// ---------------------------------------------------------------------------

function cmdTaskRecord(dir, opts) {
  // THE SLUG IS A PATH SEGMENT, refused and never sanitised - the VAL-01 lesson
  // from `milestone-prune --label`, which was only TRIMMED before being joined
  // onto a directory path and escaped the tree. Judged FIRST and with nothing
  // written, so a slug that could name a path outside `.planning/tasks/` never
  // reaches a `join`.
  if (!isTaskSlug(opts.slug)) {
    return fail('bad-args',
      'task-record --slug must be ONE path segment of lowercase letters, digits and '
      + `single hyphens, at most ${MAX_SLUG_LENGTH} characters: --slug <name>`,
      'send a short kebab-case name for the task - `fix-login-redirect` - with no slashes, dots or'
      + ' spaces; it becomes the directory this record is written into');
  }
  const slug = String(opts.slug);

  // BOTH required and neither defaulted, `risk-check run`'s rule read through
  // that face's own `riskRef`: a defaulted head is a range the caller never
  // stated, and this record is the evidence of what shipped.
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  if (!base || !head) {
    return fail('bad-args',
      'task-record needs --base <ref> and --head <ref>, neither opening with `-`',
      'name both ends of what this task shipped, as refs this repository can resolve, then re-run'
      + ' this record');
  }

  // The prose, through the ONE reader every `--<field>-file` flag goes through.
  // `--text-file` is the transport a workflow prescribes - `--text "<value>"`
  // puts caller-derived prose inside a double-quoted shell word, where a `$(...)`
  // executes before Node starts - and `--text` stays for a human at a shell.
  const resolvedText = resolveTextFlag(opts, 'text', 'task-record');
  if (!resolvedText.ok) {
    return fail('bad-args', resolvedText.detail,
      'pass --text or --text-file, never both, and point --text-file at a readable, non-empty file');
  }
  const text = resolvedText.value !== undefined
    ? resolvedText.value
    // parseArgs mints the boolean `true` for a valueless flag, so a bare
    // `--text` written through would record the literal word "true" (#42/#45).
    : (typeof opts.text === 'string' ? opts.text.trim() : '');
  if (!text) {
    return fail('bad-args', 'task-record needs what shipped: --text-file <path> '
      + '(workflows) or --text "<text>" (typed by hand)',
      'write a sentence or two saying what this task changed and pass it through --text-file, or'
      + ' --text at a shell - it is what a later /cad-why reads back off this range');
  }

  // ONE git call per figure, never one per commit. `%x1f` separates the fields
  // because a subject can carry anything a commit message can, a tab and a pipe
  // included; the split is on the FIRST separator alone, so a subject carrying
  // one keeps its tail instead of losing it to a third field. `--reverse` puts
  // the oldest commit first, the order a record reads in. The trailing `--`
  // ends the revision list, so a ref that also names a path cannot turn into a
  // pathspec.
  let commits = [];
  let files = [];
  let rangeError = null;
  const range = resolveRange(base, head);
  if (!range.ok) {
    rangeError = range.error;
  } else {
    const git = (/** @type {string[]} */ args) => execFileSync('git', ['-C', range.top, ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: RISK_DIFF_MAX_BUFFER })
      .split('\n').filter(Boolean);
    try {
      commits = git(['log', '--reverse', '--format=%H%x1f%s', `${range.base}..${range.head}`, '--'])
        .map((line) => {
          const at = line.indexOf('\x1f');
          return at === -1
            ? { commit: line, description: '' }
            : { commit: line.slice(0, at), description: line.slice(at + 1) };
        });
      files = git(['diff', '--name-only', range.base, range.head, '--']);
    } catch (e) {
      // redactUrl first, the EXP-01 rail `resolveRange` itself applies: a git
      // failure detail can carry a remote URL with credentials in it.
      rangeError = redactUrl(e && e.message ? e.message : String(e));
    }
  }

  const recordDir = join(dir, TASKS_DIR, slug);
  const recordPath = join(recordDir, RECORD_FILE);
  let written = false;
  let reason;
  let writeError = null;
  // A PLANNING ROOT THAT DOES NOT EXIST IS NOT CREATED HERE, and neither is
  // `tasks/`. The record is a tracked artifact of a project that has one; on a
  // tree with no `.planning/` the fast path's guarantee is that it scaffolds
  // nothing, so this answers `written: false` with a reason rather than minting
  // a planning tree the user never asked for. A non-directory at that path
  // takes the same arm: it is the same answer - there is no root to write into.
  let rootIsDir = false;
  try { rootIsDir = statSync(dir).isDirectory(); } catch { /* absent is the ordinary case */ }
  if (rangeError !== null) {
    reason = 'the range did not resolve, so no record could be derived from it';
  } else if (!rootIsDir) {
    reason = `no planning root at ${dir}, and this command creates neither it nor tasks/`;
  } else {
    try {
      mkdirSync(recordDir, { recursive: true });
      // CONTAINED THE WAY THE LISTER IS, and for the same reason one level
      // earlier. `isTaskSlug` refuses a slug that TRAVERSES; it says nothing
      // about a `tasks/<slug>` that already IS a symlink, and git carries
      // symlinks, so a cloned planning tree ships one. `mkdirSync(recursive)`
      // follows it without complaint and `atomicWrite` does not catch it - it
      // `lstat`s its own TEMP path, which refuses a symlinked destination FILE
      // and is silent about a symlinked parent DIRECTORY. So the record would
      // land in a tree `taskRecordsIn` would then refuse to read it back from:
      // the writer and the reader disagreeing about containment is the
      // asymmetry, and this is the half that was missing. Checked AFTER the
      // mkdir because that is when the directory exists to be resolved.
      if (!insideRoot(dir, recordDir)) {
        throw new Error(`task-record refused: ${recordDir} resolves outside ${dir}`);
      }
      // OVERWRITING IS CORRECT HERE, and is the opposite of `cmdAdjudication`'s
      // refusal: that seam refuses because a second round's rulings must not
      // replace a first's, while this record is derived WHOLLY from the range
      // and the text - a re-run over an unchanged range rewrites the same bytes,
      // and a re-run over a wider range is the correction the caller intended.
      // `atomicWrite` is the symlink-refusing writer FSW-01 put in place.
      atomicWrite(recordPath, renderTaskRecord({
        slug,
        // The heading's title is the SLUG, not a flag: a title a caller could
        // type is a second name for the record, and nothing reads it but this
        // heading.
        title: slug,
        body: text,
        commits,
        files,
      }));
      written = true;
    } catch (e) {
      // NOT through `redactUrl`, and the census in planning.test.mjs states the
      // rule: this is an `fs` error over a path the CALLER just named through
      // `--dir`, so the only string it can echo is one the caller already holds.
      // `redactUrl` targets a credential arriving from a remote the user never
      // typed, which a local write cannot carry. The `git` catch above IS
      // wrapped, for exactly that reason.
      writeError = e && e.message ? e.message : String(e);
      reason = writeError;
    }
  }

  // Appended BEFORE the envelope is emitted and on every path past argument
  // validation - the unresolvable-range path and the absent-root path included -
  // so even a refusal leaves the record saying a task record was ATTEMPTED.
  // `cmdRiskCheckRun`'s precedent exactly, and the reason this is a WRITING seam
  // rather than a reader with a `trace append` beside it: two extra invocations,
  // and every figure retyped between them.
  //
  // `phase` is hardcoded to 0 rather than taken from a `--phase` a caller could
  // misstate: `workflows/task.md` already states the fast path carries no
  // roadmap phase, and 0 is the number it uses for that.
  //
  // NO `role` and NO `tokens`: this opens no bracket and bills no worker, and a
  // token figure is read off a SUBAGENT return this seam does not have
  // (lib/trace.mjs's TOKEN PROVENANCE).
  //
  // The append may NOT change the verdict - `appendEvent` never throws and never
  // speaks - so its `{written, reason}` rides the envelope as `trace: {...}`
  // beside the record's own top-level `{written, reason}`. On a tree with no
  // planning root it writes nothing either, which is the same answer the record
  // gave and not a second failure.
  const res = appendEvent(dir, {
    phase: 0,
    family: 'outcome',
    event: 'task_record',
    slug,
    // Both spellings AND both ids, always: the spelling is what a reader
    // recognises, the id is the range's identity. Written even when null, so a
    // run that resolved nothing is visibly unidentifiable rather than silently
    // absent a field.
    base,
    head,
    base_id: range.ok ? range.base : null,
    head_id: range.ok ? range.head : null,
    commits: commits.length,
    files: files.length,
    written,
  });
  const trace = { written: res.written, ...(res.reason ? { reason: res.reason } : {}) };

  // A range that could not be READ is never ok, `risk-check run`'s `no-diff`
  // rule: a caller must not be able to take "git refused" for "the task touched
  // nothing".
  if (rangeError !== null) {
    return emit({ ok: false, reason: 'no-range', detail: rangeError, slug, base, head,
      written: false, trace,
      hint: 'name a --base and --head this repository can resolve, then re-run this record - no'
        + ' record was written, and this is not saying the task touched nothing' });
  }
  if (writeError !== null) {
    return emit({ ok: false, reason: 'no-record', detail: writeError, slug, base, head,
      written: false, trace,
      hint: 'fix what the detail names about the path and re-run - the commits are in git either'
        + ' way, but nothing has been recorded about them yet' });
  }
  ok({
    slug,
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    record: recordPath,
    commits: commits.length,
    files: files.length,
    // ALWAYS present, both of them: `written: false` beside a reason is the
    // answer on a tree with no planning root, and a caller that had to infer it
    // from an absent `record` field would be inferring.
    written,
    ...(reason ? { reason } : {}),
    trace,
  });
}

export { cmdTaskRecord };
