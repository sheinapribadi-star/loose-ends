// The written policy from the post, run as plain rules on a hand-labeled log.
// No model runs here. See README for what is and isn't simulated.

export const WEIGHTS = { search: 5, save: 5, comment: 3, like: 2, click: 1 };
export const HALF_LIFE_DAYS = 90;
export const MAX_JOURNEYS = 12;
export const SLOTS = 4;

export const RULES = [
  { id: 'weights', label: 'Rank by engagement strength', quote: 'search/save > comment > like > click > dislike' },
  { id: 'recency', label: 'Weight recent activity', quote: 'Recency' },
  { id: 'consolidate', label: 'One goal, one journey', quote: 'Cabinets, countertops, and backsplash are one kitchen, not three journeys' },
  { id: 'oneoffs', label: 'Drop one-off outliers', quote: 'drop one-off outliers' },
  { id: 'dislikes', label: 'Suppress what they keep hiding', quote: 'suppress a journey whose support is predominantly dislikes' },
  { id: 'specific', label: 'Name it specifically, ignore auto-tags', quote: '\u2018Mid-Century Coffee Table\u2019, not \u2018Furniture\u2019' },
];

export const ALL_ON = Object.fromEntries(RULES.map((r) => [r.id, true]));
export const ALL_OFF = Object.fromEntries(RULES.map((r) => [r.id, false]));

const DAY = 86400000;
const age = (today, d) => Math.max(0, (Date.parse(today) - Date.parse(d)) / DAY);
const title = (s) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

export function flatten(person) {
  const out = [];
  person.log.forEach((ev, ei) => ev.items.forEach((it, ii) => out.push({ ...it, ei, ii, a: ev.a, d: ev.d })));
  return out;
}

export function isGeneric(name) {
  return name.trim().split(/\s+/).length === 1;
}

export function infer(person, rules) {
  const items = flatten(person);
  const groups = new Map();
  for (const it of items) {
    const key = rules.consolidate ? it.j : it.f;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  const kept = [];
  const dropped = [];
  for (const [key, its] of groups) {
    // With the dislike rule off, a hide is just another keyword hit, the way the old pipeline counted it.
    const pos = rules.dislikes ? its.filter((x) => x.a !== 'dislike') : its;
    const neg = rules.dislikes ? its.filter((x) => x.a === 'dislike') : [];
    const decay = (x) => (rules.recency ? 0.5 ** (age(person.today, x.d) / HALF_LIFE_DAYS) : 1);
    const w = (x) => (rules.weights ? WEIGHTS[x.a] || 1 : 1);

    const score = pos.reduce((s, x) => s + w(x) * decay(x), 0);

    const days = new Set(pos.map((x) => x.d)).size;
    const strong = pos.some((x) => x.a === 'search' || x.a === 'save');

    // which goal is this group mostly about (used only for scoring the list, never for ranking)
    const jc = {};
    its.forEach((x) => (jc[x.j] = (jc[x.j] || 0) + 1));
    const j = Object.entries(jc).sort((a, b) => b[1] - a[1])[0][0];

    let name;
    if (rules.specific) {
      name = rules.consolidate ? person.journeys[j].name : person.facets[key];
    } else {
      // name by the most frequent keyword, auto-tags included (the legacy naming step)
      const counts = new Map();
      const order = [];
      for (const x of its) {
        for (const k of x.tags.length ? x.tags : [x.t]) {
          if (!counts.has(k)) { counts.set(k, 0); order.push(k); }
          counts.set(k, counts.get(k) + 1);
        }
      }
      const best = order.reduce((b, k) => (counts.get(k) > counts.get(b) ? k : b), order[0]);
      name = title(best);
    }

    const last = its.reduce((m, x) => (x.d > m ? x.d : m), '');
    const g = { key, j, name, score, days, strong, last, events: [...new Set(its.map((x) => x.ei))], pos: pos.length, neg: neg.length };

    if (rules.dislikes && neg.length > pos.length && !strong) { dropped.push({ ...g, why: 'mostly dislikes' }); continue; }
    if (rules.oneoffs && days < 2) { dropped.push({ ...g, why: 'one-off' }); continue; }
    if (score <= 0) { dropped.push({ ...g, why: 'no positive support' }); continue; }
    kept.push(g);
  }

  kept.sort((a, b) => b.score - a.score || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) || a.name.localeCompare(b.name));

  // dedupe names case-insensitively, first occurrence wins (the post's output contract)
  const seen = new Set();
  const list = [];
  for (const g of kept) {
    const k = g.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(g);
  }
  return { list: list.slice(0, MAX_JOURNEYS), dropped };
}

export function grade(person, list) {
  const seen = new Set();
  const slots = list.slice(0, SLOTS).map((g) => {
    const truth = person.journeys[g.j];
    const flags = [];
    if (truth.kind !== 'real') flags.push({ pushed: 'they hide it', ended: 'ended', noise: 'noise' }[truth.kind]);
    else if (seen.has(g.j)) flags.push('fragment');
    if (isGeneric(g.name)) flags.push('generic');
    seen.add(g.j);
    return { ...g, flags, useful: flags.length === 0 };
  });
  const realIds = Object.entries(person.journeys).filter(([, v]) => v.kind === 'real').map(([k]) => k);
  const covered = realIds.filter((id) => slots.some((s) => s.useful && s.j === id)).length;
  return {
    slots,
    useful: slots.filter((s) => s.useful).length,
    wasted: slots.filter((s) => !s.useful).length,
    covered,
    real: realIds.length,
  };
}

// ---- support check: is each word of a name somewhere in the positive activity? ----
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'my', 'your', 'vs', '&']);
const FRAMING = new Set(['making', 'learning', 'ideas', 'inspiration', 'beginner', 'guide', 'setup', 'living', 'planning', 'diy']);

const stem = (w) => {
  w = w.toLowerCase();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
};
const words = (s) => s.toLowerCase().split(/[^a-z0-9$]+/).filter(Boolean);
const match = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

export function supportCheck(person, name) {
  const lines = person.log.map((ev, ei) => ({ ei, a: ev.a, d: ev.d, toks: ev.items.flatMap((it) => [...words(it.t), ...it.tags.flatMap(words)]).map(stem) }));
  const ws = words(name).filter((w) => !STOP.has(w));
  const res = ws.map((w) => {
    if (FRAMING.has(w)) return { w, framing: true, lines: [], neg: [] };
    const s = stem(w);
    const hit = lines.filter((l) => l.toks.some((t) => match(t, s)));
    return { w, framing: false, lines: hit.filter((l) => l.a !== 'dislike').map((l) => l.ei), neg: hit.filter((l) => l.a === 'dislike').map((l) => l.ei) };
  });
  const content = res.filter((r) => !r.framing);
  const found = content.filter((r) => r.lines.length).length;
  const ev = [...new Set(content.flatMap((r) => r.lines))].sort((a, b) => a - b);
  const days = new Set(ev.map((ei) => person.log[ei].d)).size;
  let verdict = 'empty';
  if (content.length) verdict = found === content.length ? 'supported' : found * 2 >= content.length ? 'partly' : 'unsupported';
  const onlyNeg = content.some((r) => !r.lines.length && r.neg.length);
  return { words: res, found, total: content.length, verdict, evidence: ev, days, onlyNeg, generic: content.length === 1 && isGeneric(name) };
}
