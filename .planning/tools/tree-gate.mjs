#!/usr/bin/env node
// tree-gate.mjs — rule 8 (Wiring) and rule 9 (Coverage) checked against the
// tree, run after /cad-execute and before /cad-verify.
//
//   node .planning/tools/tree-gate.mjs <base>..<head> [PLAN.md ...]
//
// Lists every Rust function the range ADDS in non-test code, then refuses when:
//   - a function has no caller outside test code at <head> (rule 8: unwired or
//     not needed), unless a plan's Coverage table marks it `trait:<Name>`;
//   - plans were given and a function is absent from every Coverage table
//     (rule 9: shipped without a listed criterion).
//
// Test code = paths under tests/, files named *_tests.rs or tests.rs, and any
// function whose preceding added line is #[test] / #[tokio::test]. Inline
// #[cfg(test)] modules are excluded only when the diff shows the attribute in
// the same file before the function; a function added deep inside an existing
// test module can slip past. Trait-impl methods have no by-name caller; the
// Coverage table declares them.
//
// Scaffolding for the hand-driven 4.0 rewrite; the phase that owns closing a
// phase implements this in the binary. Exit 1 on any refusal.
// Rules: docs/rationale/acceptance-criteria.md, "## The nine rules".

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [range, ...plans] = process.argv.slice(2);
if (!range || !/\.\./.test(range)) { console.error("usage: tree-gate.mjs <base>..<head> [PLAN.md ...]"); process.exit(2); }
const head = range.split("..").pop();
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 << 20 });

const isTestPath = (p) => /(^|\/)tests\//.test(p) || /(_tests|\/tests)\.rs$/.test(p);
const FN = /^\+\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)/;

// 1. Added functions in non-test code.
const diff = git("diff", "--unified=0", range, "--", "crates/*/src/*.rs", "crates/*/src/**/*.rs");
const added = [];
let file = null, inTestMod = false, prevAttrTest = false;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) { file = line.slice(6); inTestMod = false; prevAttrTest = false; continue; }
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  if (/^\+\s*#\[cfg\(test\)\]/.test(line)) { inTestMod = true; continue; }
  if (/^\+\s*#\[(tokio::)?test\b/.test(line)) { prevAttrTest = true; continue; }
  const m = line.match(FN);
  if (m) {
    if (!(isTestPath(file) || inTestMod || prevAttrTest)) added.push({ name: m[1], file });
    prevAttrTest = false;
    continue;
  }
  if (!/^\+\s*#\[/.test(line) && !/^\+\s*$/.test(line)) prevAttrTest = false;
}

// 2. Coverage tables from any plans given.
const covered = new Map(); // fn -> wiring cell
for (const plan of plans) {
  const text = readFileSync(plan, "utf8");
  const sec = text.match(/^## Coverage\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  if (!sec) continue;
  for (const l of sec[1].split("\n")) {
    if (!/^\s*\|/.test(l)) continue;
    const c = l.split("|").slice(1, -1).map((s) => s.trim());
    if (c.length < 3 || /^function$/i.test(c[0]) || /^-+$/.test(c[0])) continue;
    covered.set(c[0].replace(/`/g, "").replace(/^.*::/, ""), c[2]);
  }
}

// 3. Callers at <head>, outside test code, excluding the definition itself.
function callers(name) {
  let out = "";
  // -P for \b and \s; a bare "crates" pathspec, because a glob pathspec against a
  // tree-ish matches nothing here. The src/ filter is applied below instead.
  try { out = git("grep", "-n", "-P", `\\b${name}\\s*\\(`, head, "--", "crates"); }
  catch (e) { if (e.status !== 1) throw e; }
  return out.split("\n").filter(Boolean).filter((l) => {
    const p = l.replace(/^[^:]*:/, "").split(":")[0];
    if (!/\/src\//.test(p) || isTestPath(p)) return false;
    return !new RegExp(`\\bfn\\s+${name}\\s*[(<]`).test(l);
  });
}

const failures = [];
const rows = [];
for (const f of added) {
  const c = callers(f.name);
  const cell = covered.get(f.name);
  const trait = cell && /^trait:/.test(cell);
  let note = "";
  if (c.length === 0 && !trait) { note = "NO CALLER outside test code (rule 8)"; failures.push(`${f.file}: fn ${f.name}: ${note}`); }
  if (plans.length && cell === undefined) { failures.push(`${f.file}: fn ${f.name}: not in any Coverage table (rule 9)`); note += (note ? "; " : "") + "not in Coverage"; }
  rows.push(`${String(c.length).padStart(3)}  ${f.name.padEnd(40)} ${f.file}${note ? "   <- " + note : ""}`);
}

console.log(`range ${range}: ${added.length} functions added in non-test code` + (plans.length ? `, ${covered.size} rows in Coverage tables` : ", no plans given so rule 9 not checked"));
console.log("callers  function                                 file");
for (const r of rows) console.log(r);
if (failures.length) { console.log(`\nFAIL (${failures.length})`); for (const f of failures) console.log("  " + f); process.exit(1); }
console.log("\nPASS");
