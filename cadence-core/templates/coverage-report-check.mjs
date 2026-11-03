#!/usr/bin/env node
// coverage-report-check.mjs - enforces the accepted coverage thresholds for the
// stacks whose own tool cannot: Python (coverage.py JSON), Go (`go tool cover
// -func`) and Rust on nightly (LCOV). Copied into a project, so it imports
// `node:` builtins only and cannot reach cadence-core/.
//
//   node coverage-report-check.mjs --format python|go|lcov --report <path> [--policy <path>]
//
// Thresholds, scope and accepted commands come from the policy file (default
// .github/cadence/coverage-policy.json). One line per metric; exit 1 when any
// metric fails, naming each failing one. A metric is never estimated: a missing,
// empty or unusable report fails, a threshold above 0 with no data fails, and a
// threshold of 0 prints as disabled, never as satisfied.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const format = flag('--format');
const reportPath = flag('--report');
const policyPath = flag('--policy') || '.github/cadence/coverage-policy.json';

const lines = [];
let failed = false;
const say = (text) => lines.push(text);
const fail = (text) => { failed = true; lines.push(`FAIL ${text}`); };
const finish = () => {
  console.log(lines.join('\n'));
  process.exit(failed ? 1 : 0);
};

const read = (path, what) => {
  try { return readFileSync(path, 'utf8'); } catch { fail(`${what}: cannot read ${path}`); return finish(); }
};

if (!['python', 'go', 'lcov'].includes(format) || !reportPath) {
  fail('usage: --format python|go|lcov --report <path> [--policy <path>]');
  finish();
}

let policy;
try { policy = JSON.parse(read(policyPath, 'policy')).coverage; } catch { policy = undefined; }
if (!policy || typeof policy !== 'object') { fail(`policy: ${policyPath} is not a usable coverage policy`); finish(); }
const threshold = (m) => (Number.isFinite(policy[m]) ? policy[m] : 0);

const text = read(reportPath, 'report');
if (!text.trim()) { fail(`report: ${reportPath} is empty`); finish(); }

// metrics: name -> [covered, total], or a string naming why the format has none.
// zeroBranchesOk: true when a zero branch total may read as "not applicable".
const metrics = {};
let zeroBranchesOk = false;

if (format === 'python') {
  let report;
  try { report = JSON.parse(text); } catch { report = null; }
  const t = report && report.totals;
  if (!t || typeof t.covered_lines !== 'number' || typeof t.num_statements !== 'number' || !report.files || typeof report.files !== 'object') {
    fail(`report: ${reportPath} is not a coverage.py JSON report`);
    finish();
  }
  metrics.lines = [t.covered_lines, t.num_statements];
  metrics.statements = 'coverage.py reports lines, not statements';
  if (report.meta && report.meta.branch_coverage === true && typeof t.num_branches === 'number') {
    metrics.branches = [t.covered_branches || 0, t.num_branches];
    zeroBranchesOk = true;
  } else {
    metrics.branches = 'branch measurement is off in this report (run with --cov-branch)';
  }
  const { include = [], exclude = [] } = policy;
  if (include.length) {
    const tracked = execFileSync('git', ['ls-files', '--', ...include.map((g) => `:(glob)${g}`),
      ...exclude.map((g) => `:(glob,exclude)${g}`)], { encoding: 'utf8' })
      .split('\n').filter((f) => f.endsWith('.py'));
    const have = new Set(Object.keys(report.files).map((f) => f.replaceAll('\\', '/')));
    const absent = tracked.filter((f) => !have.has(f));
    if (absent.length) fail(`files: in scope but absent from the report: ${absent.join(', ')}`);
  }
} else if (format === 'go') {
  const m = /^total:\s+\(statements\)\s+([\d.]+)%/m.exec(text);
  if (!m) { fail(`report: ${reportPath} has no "total: (statements)" line`); finish(); }
  // go reports a percentage only; scale to an integer ratio so the comparison stays exact.
  metrics.statements = [Math.round(Number(m[1]) * 100), 10000];
  metrics.lines = 'Go reports statements, not lines';
  metrics.branches = 'Go reports no branches';
} else {
  const sum = (tag) => (text.match(new RegExp(`^${tag}:(\\d+)`, 'gm')) || [])
    .reduce((n, l) => n + Number(l.split(':')[1]), 0);
  if (!/^LF:\d+/m.test(text)) { fail(`report: ${reportPath} has no LCOV line records`); finish(); }
  metrics.lines = [sum('LH'), sum('LF')];
  metrics.statements = 'LCOV reports lines, not statements';
  metrics.branches = [sum('BRH'), sum('BRF')];
  // BRF:0 alone cannot prove instrumentation; --branch in an accepted command does.
  zeroBranchesOk = (policy.commands || []).some((c) => /(^|\s)--branch(\s|=|$)/.test(String(c)));
}

for (const name of ['lines', 'branches', 'statements']) {
  const want = threshold(name);
  const got = metrics[name];
  if (want === 0) { say(`${name}: disabled (threshold 0)`); continue; }
  if (typeof got === 'string') { fail(`${name}: threshold ${want} but ${got}`); continue; }
  const [covered, total] = got;
  if (total === 0) {
    if (name === 'branches' && zeroBranchesOk) say('branches: not applicable—zero branches');
    else fail(`${name}: threshold ${want} but the report holds no ${name} to measure`);
    continue;
  }
  const pct = (covered * 100) / total;
  if (covered * 100 >= want * total) say(`${name}: ${pct.toFixed(2)}% meets ${want}`);
  else fail(`${name}: ${pct.toFixed(2)}% is below ${want}`);
}
finish();
