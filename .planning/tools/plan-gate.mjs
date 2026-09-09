#!/usr/bin/env node
// plan-gate.mjs — rule 9 (Coverage) and rule 8 (Wiring) check over a PLAN.md,
// run after the planner returns and before /cad-execute.
//
//   node .planning/tools/plan-gate.mjs .planning/phases/<N>/PLAN-<k>.md [more plans]
//
// Reads each plan's "## Coverage" table (function | unit ACs | wiring ACs) and
// the phase's CONTEXT.md, and refuses when:
//   - the Coverage section or table is missing,
//   - a row has an empty unit or wiring cell,
//   - a cited AC id does not exist in CONTEXT.md,
//   - a wiring criterion's text does not name a caller, a callee and a literal
//     value (two backticked identifiers, a call verb, and a literal),
//   - a wiring AC is cited as a unit AC or vice versa in the same row.
//   - a criterion in the frontmatter `requirements:` list is owned by no
//     Coverage row (an out-of-scope criterion, rule 1).
//
// A wiring cell may read `trait:<Name>` for a trait-impl method, whose call site
// is the trait dispatch rather than a by-name caller. The tree gate honours it.
//
// Scaffolding for the hand-driven 4.0 rewrite. Phase 11 implements this in the
// binary; this script is its executable spec until then. Exit 1 on any refusal.
// Rules: docs/rationale/acceptance-criteria.md, "## The eleven rules".

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const plans = process.argv.slice(2);
if (plans.length === 0) { console.error("usage: plan-gate.mjs PLAN.md [PLAN.md ...]"); process.exit(2); }

const failures = [];
const fail = (plan, msg) => failures.push(`${path.relative(process.cwd(), plan)}: ${msg}`);

function loadCriteria(contextPath) {
  const text = readFileSync(contextPath, "utf8");
  const map = new Map();
  // "- [ ] AC12: text" possibly wrapped onto indented continuation lines.
  const re = /^- \[[ xX]\] (AC\d+):([\s\S]*?)(?=^- \[[ xX]\] AC\d+:|^## |^\S|\n\n|\n?(?![\s\S]))/gm;
  let m;
  while ((m = re.exec(text))) map.set(m[1], m[2].replace(/\s+/g, " ").trim());
  return map;
}

function coverageRows(planText) {
  const sec = planText.match(/^## Coverage\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  if (!sec) return null;
  const rows = [];
  for (const line of sec[1].split("\n")) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (/^-+$/.test(cells[0].replace(/\s/g, "")) || /^-{2,}/.test(cells[1])) continue; // separator
    if (/^function$/i.test(cells[0])) continue;                                          // header
    rows.push({ fn: cells[0].replace(/`/g, ""), unit: cells[1], wiring: cells[2] });
  }
  return rows;
}

function planRequirements(planText) {
  // The plan's frontmatter declares which criteria it is responsible for.
  const fm = planText.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const sec = fm[1].match(/^requirements:\s*\n((?:\s*-\s*AC\d+\s*\n?)+)/m);
  if (!sec) return null;
  return [...new Set(sec[1].match(/AC\d+/g) || [])];
}

const ids = (cell) => (cell.match(/AC\d+/g) || []);
const isTrait = (cell) => /^trait:\s*\S+/.test(cell.trim());

// Rule 8 shape: two distinct backticked identifiers, a call verb, and a literal
// value (a backticked or quoted token that is not one of the two identifiers).
function wiringShape(text) {
  const idents = [...new Set((text.match(/`([^`]+)`/g) || []).map((s) => s.slice(1, -1)))];
  const verb = /\b(calls?|invokes?|receives?|passes|passed|hands?|with a request whose|is called (by|with|once))\b/i.test(text);
  const literal = /(=\s*(`[^`]+`|"[^"]*"|\d+))|(`[^`]*"[^`]*`)|\bonce\b/.test(text);
  const stubbed = /\bstub/i.test(text);
  const problems = [];
  if (idents.length < 2) problems.push("fewer than two backticked identifiers (caller and callee)");
  if (!verb) problems.push("no call verb (calls/receives/passes/is called with)");
  if (!literal) problems.push("no literal value that crosses the seam");
  if (!stubbed) problems.push("callee not stated as stubbed");
  return problems;
}

// Rule 10 (Boundary): a criterion may not stub the boundary it asserts about.
// Narrow on purpose. It fires only on the class that actually shipped a false
// green: a criterion claiming a value is durable while stubbing the write that
// would make it durable. Measured over 158 phase-9 criteria it flags exactly the
// one defective version and nothing in the repaired one. A looser word-overlap
// check flagged five, four of them topic-word collisions, so it was not shipped.
const WRITE_SEAM = /\b(commit|commits|persist|persistence|persisted|storage|store|stores|write|writes)\b/i;
const DURABLE_CLAIM = /\b(durable|durably|persisted|saved to|stored|read back|from the (real )?store)\b/i;
function stubsItsOwnBoundary(text) {
  const i = text.search(/Boundaries:/i);
  if (i < 0) return null;
  const assertion = text.slice(0, i), bounds = text.slice(i);
  const stubs = [...bounds.matchAll(/stub(?:bed)?\s+([^;]*)/gi)].map((m) => m[1]).join(" | ");
  if (!stubs.trim()) return null;
  if (/exercised for real|for real/i.test(bounds)) return null;   // says outright it is not stubbed
  if (WRITE_SEAM.test(stubs) && DURABLE_CLAIM.test(assertion)) return stubs.trim();
  return null;
}

// Rule 11 (Falsifiability): absence assertions need a demonstrated failing
// variant. That is a run-time obligation, not statically provable from a plan,
// so it is reported rather than refused: the count tells the author how many
// negative controls the execution owes.
const ABSENCE = /\b(forbid|forbidden|no current|without |never |not call|does not|no new |absent|omits|no second)\b/i;

for (const plan of plans) {
  if (!existsSync(plan)) { fail(plan, "file not found"); continue; }
  const text = readFileSync(plan, "utf8");
  const ctx = path.join(path.dirname(plan), "CONTEXT.md");
  if (!existsSync(ctx)) { fail(plan, `no CONTEXT.md beside the plan (${ctx})`); continue; }
  const criteria = loadCriteria(ctx);

  const rows = coverageRows(text);
  if (rows === null) { fail(plan, 'no "## Coverage" section (rule 9)'); continue; }
  if (rows.length === 0) { fail(plan, "Coverage section has no table rows (rule 9)"); continue; }

  for (const r of rows) {
    if (!r.fn) { fail(plan, "Coverage row with an empty function cell"); continue; }
    const u = ids(r.unit), w = ids(r.wiring);
    if (u.length === 0) fail(plan, `${r.fn}: empty unit cell (rule 9)`);
    if (w.length === 0 && !isTrait(r.wiring)) fail(plan, `${r.fn}: empty wiring cell (rule 9); unwired or not needed`);
    for (const id of [...u, ...w]) if (!criteria.has(id)) fail(plan, `${r.fn}: ${id} is not a criterion in ${path.relative(process.cwd(), ctx)}`);
    const both = u.filter((id) => w.includes(id));
    if (both.length) fail(plan, `${r.fn}: ${both.join(", ")} cited as both unit and wiring`);
    for (const id of w) {
      if (!criteria.has(id)) continue;
      const p = wiringShape(criteria.get(id));
      if (p.length) fail(plan, `${r.fn}: ${id} is not a wiring criterion (rule 8): ${p.join("; ")}`);
    }
    for (const id of [...u, ...w]) {
      if (!criteria.has(id)) continue;
      const s = stubsItsOwnBoundary(criteria.get(id));
      if (s) fail(plan, `${r.fn}: ${id} asserts a durable value while stubbing the write that makes it durable (rule 10): stubs "${s}"`);
    }
  }
  // Reverse direction (rule 9): every criterion the plan claims must be owned by
  // a Coverage row. Without this, an out-of-scope criterion with no row passes.
  const declared = planRequirements(text);
  if (declared === null) {
    fail(plan, "no `requirements:` list in the frontmatter (rule 9 reverse check)");
  } else {
    const owned = new Set(rows.flatMap((r) => [...ids(r.unit), ...ids(r.wiring)]));
    const orphans = declared.filter((id) => !owned.has(id));
    if (orphans.length)
      fail(plan, `${orphans.join(", ")} declared in requirements but owned by no Coverage row (rule 9); either give it a row or drop it as out of scope (rule 1)`);
  }

  if (!failures.some((f) => f.startsWith(path.relative(process.cwd(), plan))))
{
    const cited = [...new Set(rows.flatMap((r) => [...ids(r.unit), ...ids(r.wiring)]))];
    const absence = cited.filter((id) => criteria.has(id) && ABSENCE.test(criteria.get(id)));
    console.log(`PASS ${path.relative(process.cwd(), plan)}: ${rows.length} functions, each with unit and wiring coverage`);
    if (absence.length)
      console.log(`  rule 11: ${absence.length} of ${cited.length} criteria assert an absence and owe a demonstrated failing variant: ${absence.join(", ")}`);
  }
}

if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  for (const f of failures) console.log("  " + f);
  process.exit(1);
}
