import { PEOPLE } from '../data.js';
import { infer, grade, ALL_ON, ALL_OFF, supportCheck } from '../policy.js';
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
for (const p of PEOPLE) {
  const off = infer(p, ALL_OFF), on = infer(p, ALL_ON);
  const go = grade(p, off.list), gn = grade(p, on.list);
  console.log(`\n${p.name}\n  all off: ${off.list.map((g) => `${g.name} (${g.score.toFixed(1)})`).join(' | ')}\n  all on : ${on.list.map((g) => `${g.name} (${g.score.toFixed(2)})`).join(' | ')}`);
  console.log(`  dropped: ${on.dropped.map((g) => g.name + ':' + g.why).join(', ')}`);
  console.log(`  useful top4 off ${go.useful}/${go.slots.length}, on ${gn.useful}/${gn.slots.length}; covered ${gn.covered}/${gn.real}`);
  ok(gn.useful >= go.useful, `${p.name}: policy useful slots >= baseline`);
  // every event in the log is a real line, and every item has labels
  ok(p.log.every((e) => e.items.every((i) => p.journeys[i.j] && p.facets[i.f])), `${p.name}: labels resolve`);
  ok(p.log.every((e, i) => i === 0 || p.log[i - 1].d >= e.d), `${p.name}: log is newest first`);
  for (const c of p.chips) { const r = supportCheck(p, c); console.log(`  check "${c}": ${r.verdict} ${r.found}/${r.total} days ${r.days}`); }
}
ok(infer(PEOPLE[2], ALL_ON).list.length === 0, 'Ivy: empty list under the full policy');
// each rule must change something for at least one person, otherwise it is decoration
for (const id of Object.keys(ALL_ON)) {
  const changed = PEOPLE.some((p) => JSON.stringify(infer(p, { ...ALL_ON, [id]: false }).list.map((g) => g.name)) !== JSON.stringify(infer(p, ALL_ON).list.map((g) => g.name)));
  ok(changed, `rule ${id} changes at least one list`);
}
console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
