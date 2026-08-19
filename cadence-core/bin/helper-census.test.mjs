// The helper-definition census (COR-01, AC4): each of the four helpers phase 3
// extracted is DEFINED exactly once under cadence-core/bin/, and the census
// names where that one home is. A fifth row joined them when the lease grammar
// got one home: same contract, arrived at from the other direction - not a
// helper extracted out of copies, but a rule two seams had each written their
// own way until they disagreed about a declaration.
//
// TREE-WIDE, over every .mjs file under cadence-core/bin/ - bins, lib/ and test
// files alike. That is a deliberate deviation from the per-file `redactUrl`
// precedent (git-publish.test.mjs, planning.test.mjs), which counts occurrences
// inside ONE named file: a re-copy into a SIXTH file is invisible to any
// file-scoped count, and the twelve copies this phase deleted accumulated in
// exactly that way - five `flag`, two `flagValue`, three `readText`, three
// branch readers, none of which any test could see.
//
// It matches DEFINITIONS, never call sites (D-16). The five bins keep calling
// their flag reader after importing it, and each bridges with a one-line
// adapter binding (`const flag = (name) => optionalFlag(argv, name)`) which is
// not a definition either - a call-site census would redden on every legitimate
// use, so the patterns below are the BODY IDIOM of each contract. Matching the
// body rather than the name is also what makes a paste-back under a new name
// fail here: a copy is a copy of the body.
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
    name: 'the non-throwing positional flag reader (optionalFlag)',
    home: 'lib/seam-input.mjs',
    // The ternary the five bin copies shared, byte for byte.
    re: new RegExp('i >= 0 \\? argv\\[i \\+ 1\\] : undefined', 'g'),
    note: 'Import { optionalFlag } from ./lib/seam-input.mjs and bridge with '
      + 'const flag = (name) => optionalFlag(argv, name) - that binding is an '
      + 'adapter, not a definition, and this census does not count it.',
  },
  {
    name: 'the throwing flag-value reader (flagValue)',
    home: 'lib/seam-input.mjs',
    // The refusal itself: a missing, empty or flag-shaped value throws a seam
    // object whose two fields the callers' catch arms emit.
    re: new RegExp("throw \\{ seam: 'missing-flag-value'", 'g'),
    note: 'Import { flagValue } from ./lib/seam-input.mjs. It stays SEPARATE '
      + 'from optionalFlag on purpose: the two readers answer differently for '
      + 'a present-but-valueless flag, and the flags that legitimately default '
      + '(--branch, --base, --remote, --merged, --version, --date, '
      + '--timeout-ms) still resolve through `|| fallback`. --dir reads '
      + 'through flagValue at every seam (phase 2 D-01), each of which holds '
      + 'its own e.seam catch arm for the refusal.',
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
];

const MODULES = everyModule(BIN);
const SOURCE = new Map(MODULES.map((f) => [f, readFileSync(join(BIN, f), 'utf8')]));

test('the census walks the whole bin tree, lib/ and test files included', () => {
  // A walk that silently reached nothing would make every arm below vacuous.
  assert.ok(MODULES.length > 60, `only ${MODULES.length} .mjs files found`);
  for (const expected of ['lib/seam-input.mjs', 'lib/git-head.mjs', 'git-guard.mjs',
    'lib/lease-grammar.mjs', 'helper-census.test.mjs']) {
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
