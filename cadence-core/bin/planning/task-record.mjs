// @ts-check
// planning/task-record.mjs - `task-record`: the artifact a /cad-task run leaves behind
'use strict';

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RISK_DIFF_MAX_BUFFER, fail, ok, resolveRange, riskRef } from './core.mjs';
import { insideRoot } from '../lib/contained.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { emit } from '../lib/seam-io.mjs';
import {
  MAX_SLUG_LENGTH, RECORD_FILE, TASKS_DIR, isTaskSlug, renderTaskRecord,
} from '../lib/task-record.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';
import { appendEvent } from '../lib/trace.mjs';

// the fast path is the one most real work takes, and it used to leave commits and nothing else: nothing the recall corpus could index and nothing /cad-why could join a commit back to
// code writes the record and never workflow prose holding Write/Edit: five filed bullets were lost when a model wrote them below a heading the recall walk doesn't visit, and nothing could fail
// every figure comes from the range and none is retyped onto a flag, so a re-run over an unchanged range rewrites the same bytes
// where it lands and what it looks like is lib/task-record.mjs's, so the writer, the recall walk and /cad-why's task tier all read one fact

function cmdTaskRecord(dir, opts) {
  // the slug is a path segment, refused and never sanitised: milestone-prune --label was only trimmed before being joined onto a path and escaped the tree. Judged first, with nothing written
  if (!isTaskSlug(opts.slug)) {
    return fail('bad-args',
      'task-record --slug must be ONE path segment of lowercase letters, digits and '
      + `single hyphens, at most ${MAX_SLUG_LENGTH} characters: --slug <name>`,
      'send a short kebab-case name for the task - `fix-login-redirect` - with no slashes, dots or'
      + ' spaces; it becomes the directory this record is written into');
  }
  const slug = String(opts.slug);

  // both required and neither defaulted, like risk-check run: a defaulted head is a range the caller never stated, and this record is the evidence of what shipped
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  if (!base || !head) {
    return fail('bad-args',
      'task-record needs --base <ref> and --head <ref>, neither opening with `-`',
      'name both ends of what this task shipped, as refs this repository can resolve, then re-run'
      + ' this record');
  }

  // --text-file is what workflows use: --text "<value>" puts caller-derived prose inside a double-quoted shell word, where a $(...) runs before Node starts. --text stays for a human at a shell
  const resolvedText = resolveTextFlag(opts, 'text', 'task-record');
  if (!resolvedText.ok) {
    return fail('bad-args', resolvedText.detail,
      'pass --text or --text-file, never both, and point --text-file at a readable, non-empty file');
  }
  const text = resolvedText.value !== undefined
    ? resolvedText.value
    // parseArgs mints the boolean true for a valueless flag, so a bare --text would record the word "true"
    : (typeof opts.text === 'string' ? opts.text.trim() : '');
  if (!text) {
    return fail('bad-args', 'task-record needs what shipped: --text-file <path> '
      + '(workflows) or --text "<text>" (typed by hand)',
      'write a sentence or two saying what this task changed and pass it through --text-file, or'
      + ' --text at a shell - it is what a later /cad-why reads back off this range');
  }

  // one git call per figure, never per commit
  // %x1f separates the fields because a subject can carry a tab or a pipe, and splitting on the first one only keeps a subject that carries another
  // --reverse puts the oldest commit first, and the trailing -- ends the revision list so a ref that also names a path can't become a pathspec
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
      // redactUrl first: a git failure detail can carry a remote URL with credentials in it
      rangeError = redactUrl(e && e.message ? e.message : String(e));
    }
  }

  const recordDir = join(dir, TASKS_DIR, slug);
  const recordPath = join(recordDir, RECORD_FILE);
  let written = false;
  let reason;
  let writeError = null;
  // a missing planning root isn't created here, and neither is tasks/: with no .planning/ the fast path scaffolds nothing, so it answers written: false with a reason
  // a non-directory at that path takes the same arm, because there's no root to write into either way
  let rootIsDir = false;
  try { rootIsDir = statSync(dir).isDirectory(); } catch { /* absent is the ordinary case */ }
  if (rangeError !== null) {
    reason = 'the range did not resolve, so no record could be derived from it';
  } else if (!rootIsDir) {
    reason = `no planning root at ${dir}, and this command creates neither it nor tasks/`;
  } else {
    try {
      mkdirSync(recordDir, { recursive: true });
      // isTaskSlug refuses a slug that traverses but says nothing about tasks/<slug> already being a symlink, and git carries those
      // mkdir -p follows it and atomicWrite only lstats its own temp path, so the record would land where taskRecordsIn refuses to read it back
      // checked after the mkdir because that's when the directory exists to resolve
      if (!insideRoot(dir, recordDir)) {
        throw new Error(`task-record refused: ${recordDir} resolves outside ${dir}`);
      }
      // overwriting is right here, unlike cmdAdjudication: this record is derived wholly from the range and the text, so a re-run rewrites the same bytes and a wider range is the correction the caller meant
      atomicWrite(recordPath, renderTaskRecord({
        slug,
        // the title is the slug and not a flag, since a typed title would be a second name for the record
        title: slug,
        body: text,
        commits,
        files,
      }));
      written = true;
    } catch (e) {
      // not through redactUrl: this is an fs error over a path the caller just named, so the only string it can echo is one they already hold. The git catch above is wrapped because a remote can send back a credential nobody typed
      writeError = e && e.message ? e.message : String(e);
      reason = writeError;
    }
  }

  // appended before the envelope and on every path past argument validation, so even a refusal records that a task record was attempted
  // that's why this writes the trace itself and isn't a reader with a separate trace append beside it: two extra invocations and every figure retyped between them
  // phase is 0 because the fast path carries no roadmap phase, and a --phase would be one more thing for a caller to misstate
  // no role and no tokens: this opens no bracket and bills no worker, and token counts come off a subagent return this seam doesn't have
  // appendEvent never throws and never speaks, so it can't change the verdict, and its {written, reason} rides the envelope as trace
  const res = appendEvent(dir, {
    phase: 0,
    family: 'outcome',
    event: 'task_record',
    slug,
    // both spellings and both ids, written even when null so a run that resolved nothing is visibly unidentifiable and not silently missing a field
    base,
    head,
    base_id: range.ok ? range.base : null,
    head_id: range.ok ? range.head : null,
    commits: commits.length,
    files: files.length,
    written,
  });
  const trace = { written: res.written, ...(res.reason ? { reason: res.reason } : {}) };

  // a range that couldn't be read is never ok, so a caller can't take "git refused" for "the task touched nothing"
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
    // always present: written: false beside a reason is the answer on a tree with no planning root, and a caller shouldn't have to infer it from a missing record
    written,
    ...(reason ? { reason } : {}),
    trace,
  });
}

export { cmdTaskRecord };
