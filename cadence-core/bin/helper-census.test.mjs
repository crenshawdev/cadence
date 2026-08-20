// The helper-definition census (COR-01, AC4): each shared contract below is
// DEFINED exactly once under cadence-core/bin/, and the census names where that
// one home is. Four rows are the helpers phase 3 extracted out of copies; the
// rest arrived from the other direction - a rule two seams had each written
// their own way until they disagreed about a declaration.
//
// TREE-WIDE, over every .mjs file under cadence-core/bin/ - bins, lib/ and test
// files alike. That is a deliberate deviation from the per-file `redactUrl`
// precedent (git-publish.test.mjs, planning.test.mjs), which counts occurrences
// inside ONE named file: a re-copy into a SIXTH file is invisible to any
// file-scoped count, and the twelve copies this phase deleted accumulated in
// exactly that way - five `flag`, two `flagValue`, three `readText`, three
// branch readers, none of which any test could see.
//
// It matches DEFINITIONS, never call sites (D-16). The bins keep reading flags
// after importing the contract, and each bridges with a one-line adapter
// binding over lib/arg-contract.mjs's reader, which is not a definition either
// - a call-site census would redden on every legitimate use, so the patterns
// below are the BODY IDIOM of each contract. Matching the body rather than the
// name is also what makes a paste-back under a new name fail here: a copy is a
// copy of the body.
//
// The rules are LEXICAL, which means a rule can match its own source - the
// discipline lib/merge-warnings.mjs states, where the fix belongs at the
// mention or in the pattern and never in a second exclusion list. Every pattern
// below is therefore built from an escaped string: the text a rule matches does
// not appear verbatim anywhere in this file, so this file is censused by the
// same walk as every other and needs no exemption.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = dirname(fileURLToPath(import.meta.url));

/** Every .mjs file under `dir`, recursively, as paths relative to BIN. */
function everyModule(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...everyModule(full));
    else if (entry.name.endsWith('.mjs')) out.push(relative(BIN, full));
  }
  return out;
}

/**
 * The helpers, each as the body idiom of its own contract, the
 * ONE file that may hold it, and what a failure means. `note` is appended to
 * the assertion message so a contributor who tripped it is told where to import
 * from - and, for readText, why a second reader elsewhere is not an oversight.
 */
const HELPERS = [
  {
    name: 'the defaulting disposition (fallback)',
    home: 'lib/arg-contract.mjs',
    // What used to be a second flag READER is a declared disposition (ARG-06):
    // the arm answering "this spelling carries nothing usable, so read it as
    // absent and let the caller's own `|| default` apply". The five bin copies
    // of the positional ternary this replaced are gone with it. Anchored at the
    // line start, since the same object is a legitimate early return elsewhere.
    re: new RegExp("\\n  return \\{ ok: true, value: undefined, detail: '' \\};", 'g'),
    note: 'Do not write a positional flag reader. Declare the flag with the '
      + 'fallback disposition in this module\'s CONTRACTS table and read it '
      + 'through evaluateFlag or requireFlag - the seam bins bridge with a '
      + 'one-line adapter binding, which is not a definition and is not '
      + 'counted here. A hand-written reader also returns the NEXT FLAG as a '
      + 'value, which is the D-13 defect the disposition closed.',
  },
  {
    name: 'the throwing flag-value reader (flagValue)',
    home: 'lib/seam-input.mjs',
    // The refusal object itself, matched at its CONSTRUCTION rather than at the
    // throw: lib/arg-contract.mjs's `requireFlag` raises the same object for a
    // row that refuses on the value axis, so two files throw it and exactly one
    // builds it. Its two fields are what the callers' catch arms emit.
    re: new RegExp("return \\{ seam: 'missing-flag-value', detail: flag \\};", 'g'),
    note: 'Do not build this object a second time. lib/seam-input.mjs is where '
      + 'the absent-versus-nothing-usable line is drawn for the whole seam '
      + 'layer, and lib/arg-contract.mjs CONSULTS it rather than re-spelling '
      + 'it: requireFlag raises this same object for a row that refuses, and '
      + 'every bin reading one holds its own e.seam catch arm, without which '
      + 'the refusal surfaces as detail "[object Object]" (D-09).',
  },
  {
    name: "the ''-on-failure file reader (readText)",
    home: 'lib/seam-input.mjs',
    // The try/catch pair, not the readFileSync call alone: the '' is the
    // contract, and the null-returning readers elsewhere are different ones.
    re: new RegExp("return readFileSync\\(file, 'utf8'\\);[\\s\\S]{0,20}?catch \\{ return ''; \\}", 'g'),
    note: 'Import { readText } from ./lib/seam-input.mjs. Two OTHER file '
      + 'readers in this tree are deliberately not it and are not exemptions: '
      + 'lib/include-consumers.mjs returns null behind an isFile() guard and '
      + "planning.mjs's read() returns null, because both callers act on the "
      + "difference between absent and empty that '' collapses (D-04).",
  },
  {
    name: 'the current-branch reader (readCurrentBranch)',
    home: 'lib/git-head.mjs',
    // The spawn itself - the quoted argument pair as it appears in an
    // execFileSync argument array, so git-branch.mjs's prose header naming the
    // same git command in words is not a definition.
    re: new RegExp("'rev-parse',\\s*'--abbrev-ref'", 'g'),
    note: 'Import { readCurrentBranch } from ./lib/git-head.mjs. It degrades '
      + 'to "" rather than throwing because git-guard.mjs is a PreToolUse hook '
      + 'that swallows every throw (D-05); a reader that threw would make the '
      + 'guard stop guarding in silence.',
  },
  {
    name: 'the lease-grammar containment predicate (covers)',
    home: 'lib/lease-grammar.mjs',
    // The directory-lease arm's body, which is the whole containment
    // expression's distinguishing half - the other arm is a bare equality any
    // file may write. Matching the BODY and not the name is what makes a
    // paste-back under a new name fail here: `plan-overlap` and `lease-check`
    // each carried their own copy of this rule until they disagreed about a
    // declaration, which is the defect a second copy re-opens.
    re: new RegExp('return path\\.startsWith\\(declaration\\);', 'g'),
    note: 'Import { covers, intersects } from ./lib/lease-grammar.mjs. A '
      + 'second copy of this rule is what let plan-overlap admit a plan pair '
      + 'lease-check then refused to separate: the pre-flight gate compared '
      + 'declarations by exact equality while enforcement read a trailing '
      + 'slash as a directory prefix. Ask the module, do not re-derive it.',
  },
  {
    name: 'the executable-resolution predicate (onPath / executableIn)',
    home: 'lib/on-path.mjs',
    // The access probe itself, which is the whole contract: "can this NAME be
    // run from here". The PATH walk around it is the cheap half - a second
    // copy would re-derive THIS line, under whatever name, and answer for the
    // driver of a lint command differently from the way the land seam answers
    // for a forge CLI.
    //
    // `X_O[K]` is a one-character class rather than the plain literal, for the
    // reason every other pattern here is an escaped string: the text a rule
    // matches must not appear verbatim in this file, and a bracket is the only
    // escape a bare identifier admits.
    re: new RegExp('accessSync\\(join\\(dir, name\\), constants\\.X_O[K]\\)', 'g'),
    note: 'Import { onPath, executableIn } from ./lib/on-path.mjs. It reads no '
      + 'CADENCE_* variable on purpose: issue-check.mjs promises a test injects '
      + 'a stub by prepending a directory to the CHILD\'s PATH so the '
      + 'PRODUCTION resolver runs, and detect-commands keeps its own gated '
      + 'override at its call site instead. A second copy would also drop the '
      + 'PATHEXT arm, which is the only reason npm/npx/tsc resolve on win32.',
  },
  {
    name: 'the rotated-report name grammar (rotatedSource / isReportName)',
    home: 'lib/report-rotation.mjs',
    // The pattern SOURCE, not either exported name: `rotationTarget` scans a
    // reports/ directory for a free suffix and `cmdLeaseCheck` asks whether a
    // staged name is this plan's report, and both build their RegExp from this
    // one string. Matching the body is what makes a paste-back under a new name
    // fail here - the suffix class and the two anchors are the whole grammar,
    // and a copy is a copy of them.
    re: new RegExp("\\\\\\\\\\.\\(\\[1-9\\]\\[0-9\\]\\*\\)\\\\\\\\\\.md\\$", 'g'),
    note: 'Import { isReportName } from ./lib/report-rotation.mjs. A second '
      + 'copy here is not a style point: the picker that MINTS a rotated name '
      + 'and the lease gate that EXEMPTS one would then hold two statements of '
      + 'the same grammar, and a name one produced is a name the other refuses '
      + '- the executor blocked with undeclared-files for obeying its own '
      + 'contract, which is the same failure the covers row records for '
      + 'plan-overlap and lease-check. The anchors are load-bearing: the '
      + 'trailing extension and the dot before the suffix are what keep '
      + 'plan-11.md from reading as plan 1 rotated once. The FLAG is the '
      + "caller's, and the two callers differ on purpose - the scan is "
      + 'case-insensitive so a rename cannot destroy a report, the lease '
      + 'question is byte-exact so a spelling no executor writes is not '
      + 'exempted from a parallel-safety gate.',
  },
  {
    name: 'the worker-key grammar (requirePlanKey)',
    home: 'lib/plan-key.mjs',
    // The outer-whitespace clause, which is the arm that distinguishes this
    // grammar from every other string guard in the tree: it REFUSES rather
    // than normalizing, because trimming would mint a second spelling of one
    // key and the record and the receipt would stop joining.
    re: new RegExp('if \\(raw !== raw\\.trim\\(\\)\\) return \\{ ok: false \\};', 'g'),
    note: 'Import { requirePlanKey } from ./lib/plan-key.mjs. Two copies of '
      + 'this rule are the RSK-03 defect itself one spelling over: risk-check '
      + 'run guarded --plan with requireInt while risk-check status derived '
      + 'what it demanded from the lifecycle brackets, so a fix pass bracketed '
      + '`1-fix` left a blocking gate no argv could satisfy. lease-check --plan '
      + 'is NOT a caller: it names a plan FILE on disk and stays numeric.',
  },
];

const MODULES = everyModule(BIN);
const SOURCE = new Map(MODULES.map((f) => [f, readFileSync(join(BIN, f), 'utf8')]));

test('the census walks the whole bin tree, lib/ and test files included', () => {
  // A walk that silently reached nothing would make every arm below vacuous.
  assert.ok(MODULES.length > 60, `only ${MODULES.length} .mjs files found`);
  for (const expected of ['lib/seam-input.mjs', 'lib/arg-contract.mjs', 'lib/git-head.mjs',
    'git-guard.mjs', 'lib/lease-grammar.mjs', 'helper-census.test.mjs']) {
    assert.ok(MODULES.includes(expected), `${expected} missing from the walk`);
  }
});

for (const helper of HELPERS) {
  test(`exactly one definition of ${helper.name}`, () => {
    const found = [];
    for (const [file, text] of SOURCE) {
      const n = (text.match(helper.re) || []).length;
      if (n) found.push(`${file} (x${n})`);
    }
    assert.deepEqual(found, [`${helper.home} (x1)`],
      `${helper.name} must be defined exactly once, in ${helper.home}; found in `
      + `${found.join(', ') || 'NO file - the census pattern is dead, not the copy'}. `
      + `A second copy is what silently drifts. ${helper.note}`);
  });
}
