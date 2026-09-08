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
//
// A wiring cell may read `trait:<Name>` for a trait-impl method, whose call site
// is the trait dispatch rather than a by-name caller. The tree gate honours it.
//
// Scaffolding for the hand-driven 4.0 rewrite. Phase 11 implements this in the
// binary; this script is its executable spec until then. Exit 1 on any refusal.
// Rules: docs/rationale/acceptance-criteria.md, "## The nine rules".

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
  }
  if (!failures.some((f) => f.startsWith(path.relative(process.cwd(), plan))))
    console.log(`PASS ${path.relative(process.cwd(), plan)}: ${rows.length} functions, each with unit and wiring coverage`);
}

if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  for (const f of failures) console.log("  " + f);
  process.exit(1);
}
