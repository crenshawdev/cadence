// Throwaway. Reads .planning/reads.jsonl and answers C1/C2/C3 of SPIKE.md.
// Not project source; discard after the verdict is recorded.
import { readFileSync } from 'node:fs';

const records = [];
for (const line of readFileSync('.planning/reads.jsonl', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t) continue;
  try { records.push(JSON.parse(t)); } catch { /* partial tail */ }
}

// --- C1: coverage of the file half -----------------------------------------
const withFiles = records.filter((r) => Array.isArray(r.files) && r.files.length);
console.log('C1 total records      :', records.length);
console.log('C1 records with files :', withFiles.length);
console.log('C1 coverage (all time):', (withFiles.length / records.length).toFixed(3));

// The recorder gained `files` partway through, so all-time coverage understates
// what it captures NOW. Scope to the window from the first file-carrying record.
const firstIdx = records.findIndex((r) => Array.isArray(r.files) && r.files.length);
const window = records.slice(firstIdx);
const winWithFiles = window.filter((r) => Array.isArray(r.files) && r.files.length);
console.log('C1 window start       :', window[0]?.ts);
console.log('C1 window records     :', window.length);
console.log('C1 coverage (window)  :', (winWithFiles.length / window.length).toFixed(3));

// --- C2: per-role file redundancy ------------------------------------------
const byRole = new Map();
for (const r of winWithFiles) {
  const role = r.agent || 'coordinator';
  if (!byRole.has(role)) byRole.set(role, new Map());
  const files = byRole.get(role);
  for (const f of r.files) {
    if (typeof f === 'string' && f) files.set(f, (files.get(f) || 0) + 1);
  }
}
console.log('\nC2 per-role fileRedundancy (touches / distinct files)');
console.log('role                        touches  distinct  redundancy');
const rows = [];
for (const [role, files] of byRole) {
  const touches = [...files.values()].reduce((a, b) => a + b, 0);
  const distinct = files.size;
  rows.push({ role, touches, distinct, red: distinct ? touches / distinct : null });
}
rows.sort((a, b) => b.touches - a.touches);
for (const r of rows) {
  console.log(
    r.role.padEnd(26),
    String(r.touches).padStart(7),
    String(r.distinct).padStart(9),
    (r.red === null ? 'n/a' : r.red.toFixed(2)).padStart(11),
    r.touches >= 50 ? '  <- substantial (>=50)' : '');
}

// --- C3: re-reads INSIDE a single dispatch ---------------------------------
// A dispatch is approximated by tool_use_id's owning agent run: group by agent
// plus a contiguous time run, since reads.jsonl carries no bracket id. Use the
// coarsest honest grouping available - per agent per calendar day - and report
// the max single-file repeat inside one such group.
const groups = new Map();
for (const r of winWithFiles) {
  const key = `${r.agent || 'coordinator'}|${(r.ts || '').slice(0, 10)}`;
  if (!groups.has(key)) groups.set(key, new Map());
  const files = groups.get(key);
  for (const f of r.files) {
    if (typeof f === 'string' && f) files.set(f, (files.get(f) || 0) + 1);
  }
}
const worst = [];
for (const [key, files] of groups) {
  for (const [f, n] of files) worst.push({ key, f, n });
}
worst.sort((a, b) => b.n - a.n);
console.log('\nC3 most re-read file within one agent-day group');
for (const w of worst.slice(0, 12)) {
  console.log(String(w.n).padStart(4), w.key.padEnd(34), w.f);
}
const over3 = worst.filter((w) => w.n >= 3).length;
console.log(`\nC3 file/group pairs re-read >=3 times: ${over3} of ${worst.length}`);
