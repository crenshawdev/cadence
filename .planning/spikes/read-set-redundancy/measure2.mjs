// Throwaway, second pass. The first pass grouped by agent-DAY, which cannot
// tell "re-read inside one dispatch" from "read once in each of 20 dispatches".
// This one joins reads to real dispatch brackets via joinReads, so C2 and C3
// measure what #167 actually asked about: per-role redundancy WITHIN a dispatch.
import { readFileSync } from 'node:fs';
import { joinReads } from '../../../cadence-core/bin/lib/read-trace.mjs';
import { renderTrace } from '../../../cadence-core/bin/lib/trace.mjs';

const records = [];
for (const line of readFileSync('.planning/reads.jsonl', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t) continue;
  try { records.push(JSON.parse(t)); } catch { /* partial tail */ }
}
const valid = records.filter((r) => r && typeof r === 'object');
const brackets = renderTrace('.planning').brackets;
const { rows, ...counts } = joinReads(valid, brackets);
console.log('join counts:', JSON.stringify(counts));

// rows[] is 1:1 with `valid` in order, so zip to recover each read's files.
const perBracket = new Map(); // bracket corr+role+ts -> Map(file -> touches)
let joinedWithFiles = 0;
for (let i = 0; i < valid.length; i++) {
  const rec = valid[i];
  const row = rows[i];
  if (!row || row.status !== 'joined' || !row.bracket) continue;
  if (!Array.isArray(rec.files) || !rec.files.length) continue;
  joinedWithFiles++;
  const b = row.bracket;
  const key = `${b.corr}|${b.role || row.role}|${b.ts}`;
  if (!perBracket.has(key)) perBracket.set(key, { role: row.role, files: new Map() });
  const files = perBracket.get(key).files;
  for (const f of rec.files) {
    if (typeof f === 'string' && f) files.set(f, (files.get(f) || 0) + 1);
  }
}
console.log('joined reads carrying files:', joinedWithFiles);
console.log('dispatch brackets with file reads:', perBracket.size);

// --- C2 restated: per-role redundancy computed WITHIN each dispatch ---------
const byRole = new Map();
for (const { role, files } of perBracket.values()) {
  const touches = [...files.values()].reduce((a, b) => a + b, 0);
  const distinct = files.size;
  if (!distinct) continue;
  if (!byRole.has(role)) byRole.set(role, { touches: 0, distinct: 0, dispatches: 0, maxRepeat: 0 });
  const acc = byRole.get(role);
  acc.touches += touches;
  acc.distinct += distinct;      // summed PER dispatch, so the ratio is in-dispatch
  acc.dispatches++;
  acc.maxRepeat = Math.max(acc.maxRepeat, ...files.values());
}
console.log('\nC2 in-dispatch fileRedundancy (touches / distinct, summed per dispatch)');
console.log('role                       dispatches  touches  distinct  redundancy  maxRepeat');
const out = [...byRole.entries()]
  .map(([role, a]) => ({ role, ...a, red: a.touches / a.distinct }))
  .sort((x, y) => y.touches - x.touches);
for (const r of out) {
  console.log(
    r.role.padEnd(25),
    String(r.dispatches).padStart(10),
    String(r.touches).padStart(8),
    String(r.distinct).padStart(9),
    r.red.toFixed(2).padStart(11),
    String(r.maxRepeat).padStart(10),
    r.touches >= 50 ? ' <- substantial' : '');
}

// --- C3 restated: worst single-file repeat inside ONE dispatch --------------
const worst = [];
for (const [key, { role, files }] of perBracket) {
  for (const [f, n] of files) if (n >= 2) worst.push({ key, role, f, n });
}
worst.sort((a, b) => b.n - a.n);
console.log('\nC3 most re-read file within ONE dispatch bracket');
for (const w of worst.slice(0, 12)) {
  console.log(String(w.n).padStart(4), (w.role || '?').padEnd(24), w.f);
}
const pairs = [...perBracket.values()].reduce((n, b) => n + b.files.size, 0);
const over3 = worst.filter((w) => w.n >= 3).length;
console.log(`\nC3 file/dispatch pairs re-read >=3 times: ${over3} of ${pairs}`);
