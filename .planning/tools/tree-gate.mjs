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
// Test code = paths under tests/, files named *_tests.rs or tests.rs, functions
// carrying #[test] / #[tokio::test], and anything inside a #[cfg(test)] module.
// Test-ness is resolved against the file at <head> by brace-matching each
// #[cfg(test)] mod block, NOT against the diff, so a function added inside a
// test module that already existed is correctly excluded. Trait-impl methods
// have no by-name caller; the Coverage table declares them.
//
// Scaffolding for the hand-driven 4.0 rewrite; the phase that owns closing a
// phase implements this in the binary. Exit 1 on any refusal.
// Rules: docs/rationale/acceptance-criteria.md, "## The eleven rules".

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [range, ...plans] = process.argv.slice(2);
if (!range || !/\.\./.test(range)) { console.error("usage: tree-gate.mjs <base>..<head> [PLAN.md ...]"); process.exit(2); }
const head = range.split("..").pop();
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 << 20 });

const isTestPath = (p) => /(^|\/)tests\//.test(p) || /(_tests|\/tests)\.rs$/.test(p);
const FN = /^\+\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)/;

// 1. Added functions in non-test code.
//
// Test-ness is resolved against the FILE AT <head>, not against the diff. A
// function added inside a #[cfg(test)] module that already existed shows no
// cfg(test) line in the diff, and a diff-scoped flag would call it production
// (and, being sticky, would call everything after a cfg(test) line test).
// Both errors were live before this was rewritten.

// Line ranges (1-based, inclusive) covered by a #[cfg(test)] item. The item may
// be a mod, an impl, a struct, a trait or a bare fn: gap158 puts test doubles in
// `#[cfg(test)] impl ... {}` blocks outside any test module, so restricting this
// to `mod` misses them and their methods read as production code.
function testRanges(text) {
  const lines = text.split("\n");
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*#\[cfg\(test\)\]/.test(lines[i])) continue;
    // skip further attributes, comments and blank lines to reach the item
    let j = i + 1;
    while (j < lines.length && /^\s*(#\[|\/\/|$)/.test(lines[j])) j++;
    if (j >= lines.length) continue;
    const strip = (s) => s.replace(/"(\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, "");
    // an item with no brace on its first line and a trailing ; covers one line
    if (!/\{/.test(strip(lines[j])) && /;\s*$/.test(strip(lines[j]))) {
      ranges.push([i + 1, j + 1]);
      continue;
    }
    let depth = 0, started = false, k = j;
    for (; k < lines.length; k++) {
      for (const ch of strip(lines[k])) {
        if (ch === "{") { depth++; started = true; }
        else if (ch === "}") depth--;
      }
      if (started && depth <= 0) break;
    }
    if (!started) { ranges.push([i + 1, j + 1]); continue; }
    ranges.push([i + 1, Math.min(k, lines.length - 1) + 1]);
  }
  return ranges;
}

const headFile = new Map();
function fileAtHead(path) {
  if (headFile.has(path)) return headFile.get(path);
  let text = "";
  try { text = git("show", `${head}:${path}`); } catch { text = ""; }
  headFile.set(path, text);
  return text;
}

// Is the line where an added function was defined inside test code at <head>?
// Anchored by LINE, not by name: several distinct functions in one file can
// share a name (three `fn read` in review_service.rs), so a name-based check
// mixes a production definition with a test one and mis-classifies both.
const rangeCache = new Map();
function testRangesAtHead(path) {
  if (!rangeCache.has(path)) rangeCache.set(path, testRanges(fileAtHead(path)));
  return rangeCache.get(path);
}
function isTestLine(path, lineNo) {
  const text = fileAtHead(path);
  if (!text) return false;                       // gone at head; treat as production
  if (testRangesAtHead(path).some(([a, b]) => lineNo >= a && lineNo <= b)) return true;
  const lines = text.split("\n");
  return lines
    .slice(Math.max(0, lineNo - 4), lineNo - 1)
    .some((l) => /^\s*#\[(tokio::)?test\b/.test(l));
}

const diff = git("diff", "--unified=0", range, "--", "crates/*/src/*.rs", "crates/*/src/**/*.rs");
const seen = new Set();
const added = [];
let file = null, newLine = 0;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) { file = line.slice(6); continue; }
  const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (hunk) { newLine = Number(hunk[1]); continue; }
  if (line.startsWith("---") || line.startsWith("+++")) continue;
  if (line.startsWith("-")) continue;            // old side: no new-file line consumed
  if (!line.startsWith("+")) { newLine++; continue; }
  const at = newLine++;
  const m = line.match(FN);
  if (!m) continue;
  const name = m[1];
  const key = `${file}::${name}::${at}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (isTestPath(file) || isTestLine(file, at)) continue;
  added.push({ name, file, line: at });
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
