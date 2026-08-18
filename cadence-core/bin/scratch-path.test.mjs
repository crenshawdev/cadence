// Zero-dep tests for lib/scratch-path.mjs - the per-run scratch rule
// self-verify runs over every prose surface (check 21). Run:
//   node --test cadence-core/bin/scratch-path.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// This file owns the RULE and the six sites SCR-01 was filed against, in BOTH
// directions: every site as it shipped must be reported by name, and the exact
// converted form this phase writes must be clean. That pairing is the point.
// A checker proved only against the broken form passes a conversion it cannot
// read; a checker proved only against the fixed form is a green test that
// cannot go red. self-verify.test.mjs owns the CLI wiring and the assertion
// that the live tree is clean, which is why nothing here reads a shipped file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scratchPathIssues, CODES } from './lib/scratch-path.mjs';

const X = 'cadence-core/workflows/x.md';
/** The kinds reported over one synthetic surface, in the order they are found. */
const kinds = (text) => scratchPathIssues(X, text).map((i) => i.kind);

// --- the six sites, before and after ----------------------------------------

/**
 * One entry per site in phase-1 CONTEXT D-11. `before` is the site's shipped
 * text, quoted verbatim; `after` is the converted form tasks 2-6 write.
 */
const SITES = [
  {
    id: 'triage-gate.md - the blocking re-arm cap',
    reported: [CODES.sharedPath, CODES.sharedPath, CODES.unguardedReadback],
    before: [
      `node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render --phase <N> > "\${TMPDIR:-/tmp}/cad-rearm.json"`,
      `node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((r.outcomes||[]).filter((o)=>o.event==="rearm"&&o.trigger===process.argv[2]&&o.corr===r.corr).length)' "\${TMPDIR:-/tmp}/cad-rearm.json" "<trigger>"`,
    ].join('\n'),
    after: [
      `D="$(mktemp -d "\${TMPDIR:-/tmp}/cad-rearm-XXXXXX")" \\`,
      `  && node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render --phase <N> > "$D/render.json" \\`,
      `  && node -e 'const f=require("fs");let r;try{r=JSON.parse(f.readFileSync(process.argv[1],"utf8"))}catch(e){console.error("scratch-unreadable: "+process.argv[1]+": "+e.message);process.exit(1)}if(!Array.isArray(r.outcomes)){console.error("scratch-shape: outcomes is not an array in "+process.argv[1]);process.exit(1)}console.log(r.outcomes.filter((o)=>o.event==="rearm"&&o.trigger===process.argv[2]&&o.corr===r.corr).length)' "$D/render.json" "<trigger>"`,
    ].join('\n'),
  },
  {
    id: 'progress.md - the --trace step',
    reported: [CODES.sharedPath, CODES.sharedPath, CODES.unguardedReadback],
    before: [
      `node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render --phase <current> > "\${TMPDIR:-/tmp}/cad-trace.json"`,
      `node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(JSON.stringify({counts:r.counts,roles:r.roles,unpaired:r.unpaired,capped:r.capped}))' "\${TMPDIR:-/tmp}/cad-trace.json"`,
    ].join('\n'),
    after: [
      `D="$(mktemp -d "\${TMPDIR:-/tmp}/cad-trace-XXXXXX")" \\`,
      `  && node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render --phase <current> > "$D/render.json" \\`,
      `  && node -e 'const f=require("fs");let r;try{r=JSON.parse(f.readFileSync(process.argv[1],"utf8"))}catch(e){console.error("scratch-unreadable: "+process.argv[1]+": "+e.message);process.exit(1)}const miss=["counts","roles","unpaired","capped"].filter((k)=>r[k]===undefined);if(miss.length){console.error("scratch-shape: "+miss.join(", ")+" absent from "+process.argv[1]);process.exit(1)}console.log(JSON.stringify({counts:r.counts,roles:r.roles,unpaired:r.unpaired,capped:r.capped}))' "$D/render.json"`,
    ].join('\n'),
  },
  {
    id: 'report.md - the split read_record / compose pair',
    reported: [CODES.sharedPath, CODES.sharedPath, CODES.unguardedReadback],
    before: [
      `node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render [--phase <N>] > "\${TMPDIR:-/tmp}/cad-record.json"`,
      `node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const b of r.brackets)console.log([b.role,b.plan,b.event,b.ms,b.tokens,b.turns].join("\\t"))' "\${TMPDIR:-/tmp}/cad-record.json"`,
    ].join('\n'),
    after: [
      `D="$(mktemp -d "\${TMPDIR:-/tmp}/cad-record-XXXXXX")" && T="$$-$(date +%s)" && printf '%s' "$T" > "$D/run-token" \\`,
      `  && node "\${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render [--phase <N>] > "$D/render.json" \\`,
      `  && echo "scratch dir: $D  run token: $T"`,
      `node -e 'const f=require("fs");const d=process.argv[1];let tok;try{tok=f.readFileSync(d+"/run-token","utf8")}catch(e){console.error("scratch-stale: no run token in "+d);process.exit(1)}if(tok!==process.argv[2]){console.error("scratch-stale: "+d+" belongs to another run");process.exit(1)}let r;try{r=JSON.parse(f.readFileSync(d+"/render.json","utf8"))}catch(e){console.error("scratch-unreadable: "+d+"/render.json: "+e.message);process.exit(1)}if(!Array.isArray(r.brackets)){console.error("scratch-shape: brackets is not an array in "+d+"/render.json");process.exit(1)}for(const b of r.brackets)console.log([b.role,b.plan,b.event,b.ms,b.tokens,b.turns].join("\\t"))' "<the echoed scratch directory>" "<the echoed run token>"`,
    ].join('\n'),
  },
  {
    id: 'review-triggers.md - the cross-model artifact redirect',
    reported: [CODES.sharedPath],
    before: `  git diff <base_ref>..<head_ref> > "\${TMPDIR:-/tmp}/cad-artifact.txt"`,
    after: `    && git diff <base_ref>..<head_ref> > "$D/artifact.txt" \\`,
  },
  {
    id: 'review-triggers.md - the cross-model payload and its --payload consumer',
    reported: [CODES.sharedPath, CODES.unguardedReadback, CODES.sharedPath],
    before: [
      `  node -e 'const f=require("fs"),d=process.env.TMPDIR||"/tmp";f.writeFileSync(d+"/cad-payload.json",JSON.stringify({instruction:f.readFileSync(process.argv[1],"utf8")+"\\n\\n"+process.argv[2],artifact:f.readFileSync(process.argv[3],"utf8")}))' "\${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md" "<instruction>" "\${TMPDIR:-/tmp}/cad-artifact.txt"`,
      `    --payload "\${TMPDIR:-/tmp}/cad-payload.json" \\`,
    ].join('\n'),
    after: [
      `    && node -e 'const f=require("fs");const rd=(p)=>{try{return f.readFileSync(p,"utf8")}catch(e){console.error("scratch-unreadable: "+p+": "+e.message);process.exit(1)}};const brief=rd(process.argv[1]),art=rd(process.argv[3]);if(art===""){console.error("scratch-unreadable: "+process.argv[3]+" is empty");process.exit(1)}f.writeFileSync(process.argv[4],JSON.stringify({instruction:brief+"\\n\\n"+process.argv[2],artifact:art}))' "\${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md" "<instruction>" "$D/artifact.txt" "$D/payload.json" \\`,
      `  [ "$(cat "<the echoed scratch directory>/run-token" 2>/dev/null)" = "<the echoed run token>" ] || { echo "scratch-stale: that directory is not this run's" >&2; exit 1; }`,
      `    --payload "<the echoed scratch directory>/payload.json" \\`,
    ].join('\n'),
  },
  {
    id: 'task.md - the inline risk_surface diff',
    reported: [CODES.sharedPath],
    before: '  `${TMPDIR:-/tmp}/cadence-risk-task-{slug}.diff` and fire with THAT path -',
    after: '  run\'s own directory - `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-risk-XXXXXX")"` - write',
  },
];

test('the six sites SCR-01 was filed against are each reported as they shipped', () => {
  assert.equal(SITES.length, 6, 'the site count is CONTEXT D-11\'s own claim');
  for (const s of SITES) {
    assert.deepEqual(kinds(s.before), s.reported, s.id);
  }
});

test('the converted form of every one of the six is clean', () => {
  for (const s of SITES) {
    assert.deepEqual(scratchPathIssues(X, s.after), [], s.id);
  }
});

// --- the rules, one row each -------------------------------------------------

test('the code table is frozen', () => {
  assert.equal(Object.isFrozen(CODES), true);
  assert.throws(() => { CODES.sharedPath = 'x'; }, TypeError);
});

test('a TMPDIR line is judged by whether it also makes the directory', () => {
  assert.deepEqual(kinds('cp x "${TMPDIR:-/tmp}/cad.json"'), [CODES.sharedPath]);
  assert.deepEqual(kinds('D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")"'), []);
  // Line-local: the mktemp two lines above does not reach the line that uses it.
  assert.deepEqual(kinds('D="$(mktemp -d)"\ncp x "${TMPDIR:-/tmp}/cad.json"'), [CODES.sharedPath]);
});

test('a redirect at a spelled-out tmp path is reported however it is quoted', () => {
  assert.deepEqual(kinds('render > /tmp/cad-record.json'), [CODES.fixedTarget]);
  assert.deepEqual(kinds('render > "/tmp/cad-record.json"'), [CODES.fixedTarget]);
  assert.deepEqual(kinds('render >> "/var/tmp/cad-record.json"'), [CODES.fixedTarget]);
  assert.deepEqual(kinds('render > "$D/cad-record.json"'), []);
  const one = scratchPathIssues(X, 'render > /tmp/cad-record.json');
  assert.match(one[0].detail, /\/tmp\/cad-record\.json/);
});

test('the UAT fixture paths under /tmp are not transports and are never reported', () => {
  // references/acceptance-criteria.md's demonstration-fixture recipe, verbatim.
  // The rule watches REDIRECT TARGETS, not every mention of /tmp, and this is
  // the one shape in the tree that would otherwise need an exemption list.
  const recipe = [
    '- `/tmp/cadence-phase5-fixture/fail/.planning` - `/cad-audit` must FAIL, naming',
    '- `/tmp/cadence-phase5-fixture/pass/.planning` - `/cad-audit` must PASS.',
    '`/tmp` is reaped, so the recipe rather than the tree is what ships here. Both',
    '1. `mkdir -p /tmp/cadence-phase5-fixture/{fail,pass}/.planning/phases/1`.',
  ].join('\n');
  assert.deepEqual(scratchPathIssues('cadence-core/references/acceptance-criteria.md', recipe), []);
});

test('a read-back needs BOTH a reason on stderr and a non-zero exit', () => {
  const body = (guard) => `node -e 'const f=require("fs");const r=f.readFileSync(process.argv[1],"utf8");${guard}console.log(r)' "$D/render.json"`;
  assert.deepEqual(kinds(body('')), [CODES.unguardedReadback]);
  assert.deepEqual(kinds(body('if(!r){console.error("scratch-shape");}')), [CODES.unguardedReadback]);
  assert.deepEqual(kinds(body('if(!r){process.exit(1)}')), [CODES.unguardedReadback]);
  assert.deepEqual(kinds(body('if(!r){console.error("scratch-shape");process.exit(1)}')), []);
  assert.deepEqual(kinds(body('if(!r){console.error("scratch-shape");process.exitCode=1;return}')), []);
});

test('the missing half is NAMED, so a half-guarded read-back says which half', () => {
  const noExit = scratchPathIssues(X, `node -e 'const f=require("fs");f.readFileSync(process.argv[1]);console.error("x")'`);
  assert.equal(noExit.length, 1);
  assert.match(noExit[0].detail, /non-zero exit/);
  assert.doesNotMatch(noExit[0].detail, /console\.error/);
});

test('a `node -e` that reads no argv-named file is not a read-back', () => {
  // The composer's own writes, and any inline script the transport never touched.
  assert.deepEqual(kinds(`node -e 'console.log(JSON.stringify({ok:true}))'`), []);
  assert.deepEqual(kinds(`node -e 'require("fs").writeFileSync(process.argv[1],"x")' "$D/t"`), []);
});

test('prose that merely NAMES the shape prescribes nothing and is never reported', () => {
  assert.deepEqual(kinds('needs it - a `node -e` field read, the shape workflows/progress.md uses'), []);
  assert.deepEqual(kinds('The same `node -e` step reads it, for the same reason it reads the artifact:'), []);
});

test('every issue is filed against the surface it was found in', () => {
  const out = scratchPathIssues('cadence-core/workflows/y.md', 'cp x "${TMPDIR:-/tmp}/cad.json"');
  assert.equal(out.length, 1);
  assert.equal(out[0].file, 'cadence-core/workflows/y.md');
  assert.match(out[0].detail, /conventions\.md/);
});
