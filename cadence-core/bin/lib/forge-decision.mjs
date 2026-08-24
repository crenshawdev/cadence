// @ts-check
// forge-decision.mjs - the pure, testable core of the setup-time forge question
// (FRG-01). Zero-dep (node builtins only, and it uses none): one frozen
// provider table plus two TOTAL functions that decide, from a persisted forge
// record and a caller's own "does this name resolve" answer, WHAT the setup
// step in workflows/new-project.md and workflows/adopt.md should do next.
// It never touches the filesystem, never spawns anything, never emits and never
// reads `process` - bin/forge.mjs supplies the live readings and the workflow
// prose asks the questions. Mirrors lib/issue-decision.mjs's discipline:
// unknown or missing inputs never throw.
//
// NOTHING HERE PROMPTS AND NOTHING HERE WRITES (CONTEXT D-12). A seam that
// blocked on stdin inside a Bash tool call would hang the workflow that ran it,
// so the question is asked in prose through the ask-user seam and the answers
// come back through `config.mjs set`. This module's whole job is to say which
// of three things is true, so that the prose has exactly one value to branch
// on - the way `/cad-land` step 1 branches on `decideIssueCheck`'s `action`.
//
// WHY THE PERSISTED RECORD IS CONSULTED BEFORE THE INSTALLED LIST. The two
// acceptance criteria pull in opposite directions: AC2 says a repository whose
// forge keys are already set is asked NOTHING on a second run, and AC5 says a
// machine with no forge CLI refuses. Asking about the binaries first would
// refuse an already-configured repository on a machine that happens not to have
// the CLI installed right now - re-opening a settled question because of a
// state that setup does not need. Setup persists a choice; it is land time that
// needs a binary, and issue-check.mjs already has its own named line for a CLI
// that is not on PATH.
//
// "INSTALLED" IS `onPath` AND NOTHING ELSE (CONTEXT D-06). No `--version`
// call, no `tea login list`, no auth probe: this phase resolves WHERE issue
// writes will go and never asks whether the user is logged in. That is what
// keeps AC1's "no subprocess is spawned during detection" assertion true, and
// it is why this module takes a PREDICATE rather than doing the lookup - the
// production resolver stays `lib/on-path.mjs`, one rule with one implementation.
'use strict';

/**
 * The three providers Cadence can drive, each with the ONE binary name that
 * drives it, in the fixed order every caller reports them in.
 *
 * The KEYS are the vocabulary `HOST_TABLE` in lib/issue-decision.mjs already
 * uses for its rows and `git.forge_provider`'s enum already carries. There is
 * deliberately no second spelling anywhere: the persisted provider value is
 * used directly as a `HOST_TABLE` key at land time, so a synonym here would be
 * a lookup miss there rather than a naming preference.
 *
 * The ORDER is load-bearing in the small way a menu is: `installedProviders`
 * walks it, so the choices the setup step offers come out the same on every
 * machine instead of following whatever order a config or a directory listing
 * happened to have.
 */
export const PROVIDER_TABLE = Object.freeze({
  forgejo: 'tea',
  github: 'gh',
  gitlab: 'glab',
});

/** The binaries this module looks for, in table order - the list a refusal
 * names, so the sentence a user reads and the lookup that produced it cannot
 * drift apart. */
const BINARIES = Object.freeze(Object.values(PROVIDER_TABLE));

/** A persisted config value as a usable string, or null. Anything that is not
 * a non-empty string after trimming is UNASKED, not an error: `null` is what
 * templates/config.json ships and what a user's own edit is most likely to
 * leave behind, and this module has no envelope to refuse into.
 * @param {unknown} v @returns {string|null} */
function text(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Which providers this machine can drive, folded through the caller's own
 * resolver.
 *
 * The predicate is the caller's - bin/forge.mjs passes `onPath` from
 * lib/on-path.mjs - so the production lookup is what runs and a test injects a
 * stub the same way every other seam does, by prepending a directory to the
 * child's PATH. A predicate that throws is not caught: a resolver that cannot
 * answer is a fault in the caller, not a provider that is absent, and silently
 * reading a throw as `false` would report a machine bare that is not.
 *
 * @param {(bin: string) => unknown} resolves does this BINARY NAME resolve?
 * @returns {{provider: string, bin: string}[]} in PROVIDER_TABLE order
 */
export function installedProviders(resolves) {
  if (typeof resolves !== 'function') return [];
  const out = [];
  for (const [provider, bin] of Object.entries(PROVIDER_TABLE)) {
    if (resolves(bin)) out.push({ provider, bin });
  }
  return out;
}

/**
 * Is the persisted forge record COMPLETE - is there nothing left to ask?
 *
 * Provider and slug always; on `forgejo`, the instance host as well (CONTEXT
 * D-08). A Forgejo row that cannot name its instance is NOT configured: `tea`
 * addresses an instance through a login name, the host is what resolves that
 * name, and it is never derivable from the origin URL - on a split SSH endpoint
 * the origin's host is the SSH hostname (`ssh.jcrenshaw.dev`) and not the
 * instance the user reaches in a browser (`git.jcrenshaw.dev`), which is the
 * shape this repository itself has. `github` and `gitlab` need no such key:
 * their hosts are fixed, so the key stays null there and its absence is not a
 * gap.
 *
 * An UNKNOWN provider string is incomplete rather than complete: the value is
 * used as a `HOST_TABLE` key at land time, so honouring a spelling no row
 * carries would persist a record nothing can read.
 *
 * @param {{provider?: unknown, repo?: unknown, host?: unknown}} record
 * @returns {boolean}
 */
export function forgeRecordComplete({ provider, repo, host } = {}) {
  const p = text(provider);
  if (!p || !Object.prototype.hasOwnProperty.call(PROVIDER_TABLE, p)) return false;
  if (!text(repo)) return false;
  if (p === 'forgejo' && !text(host)) return false;
  return true;
}

/**
 * What should the setup step do about the forge?
 *
 * Modelled on `decideIssueCheck`'s return, which the workflows already branch
 * on by `action` alone: `{action, reason}` and, on the one refusing action, a
 * `hint`. THREE actions and nothing else, because prose that has to distinguish
 * a fourth state is prose that will get one of them wrong:
 *   configured  the persisted record answers every question - say nothing, ask
 *               nothing (AC2)
 *   ask         at least one provider resolved - put the question to the user,
 *               carrying whatever of the record is already answered so only the
 *               gaps are asked
 *   refuse      no provider resolved - a forge is a PRECONDITION (FRG-02), so
 *               this is a stop with a reason and a hint, not a no-tracker mode
 *
 * The reason and hint live here rather than in the seam for the reason
 * `decideIssueCheck`'s do: the sentence a user reads is the thing worth
 * testing, and testing it through a subprocess would prove the spawn instead.
 *
 * TOTAL. Every field is optional and an absent one means "not answered", so a
 * caller that read nothing at all gets `ask` or `refuse` rather than a throw.
 *
 * @param {{provider?: unknown, repo?: unknown, host?: unknown,
 *   installed?: unknown}} args `installed` as `installedProviders` returns it
 * @returns {{action: 'configured'|'ask'|'refuse', reason: string, hint?: string}}
 */
export function decideForge({ provider, repo, host, installed } = {}) {
  if (forgeRecordComplete({ provider, repo, host })) {
    return {
      action: 'configured',
      reason: `this repository's forge is already set to ${text(provider)}: nothing to ask`,
    };
  }
  const found = Array.isArray(installed) ? installed : [];
  if (found.length > 0) {
    return {
      action: 'ask',
      reason: `${found.map((e) => e.bin).join(', ')} resolved on PATH: ask which forge hosts this repository`,
    };
  }
  return {
    action: 'refuse',
    reason: `no forge CLI is installed: none of ${BINARIES.join(', ')} resolves on PATH, and Cadence needs one to reach an issue tracker`,
    hint: 'install the CLI for the forge you use - tea for a Forgejo or Gitea instance, gh for GitHub, glab for GitLab - then re-run this setup step',
  };
}
