import { PEOPLE, AUTO_TAGS } from './data.js';
import { RULES, ALL_ON, ALL_OFF, SLOTS, infer, grade, supportCheck } from './policy.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const auto = new Set(AUTO_TAGS);
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const params = new URLSearchParams(location.search);
let person = PEOPLE.find((p) => p.id === params.get('p')) || PEOPLE[0];
let rules = { ...ALL_ON };
if (params.has('off')) params.get('off').split(',').forEach((id) => { if (id in rules) rules[id] = false; });

/* ---------- people ---------- */
function drawPeople() {
  const box = $('.people');
  box.replaceChildren(...PEOPLE.map((p) => {
    const b = el('button', 'person');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(p === person));
    b.append(el('span', 'person__name', p.name), el('span', 'person__blurb', p.blurb));
    b.addEventListener('click', () => { person = p; sync(); renderAll(); });
    return b;
  }));
}

/* ---------- log ---------- */
function drawLog() {
  $('#log-meta').textContent = `${person.log.length} lines · as of ${fmtDate(person.today)}`;
  $('#log-profile').textContent = person.boards.length ? `Boards: ${person.boards.join('; ')}` : 'Boards: none';
  $('#log-note').textContent = person.note;
  const ol = $('#log-lines');
  const nowYear = person.today.slice(0, 4);
  const rows = [];
  person.log.forEach((ev, ei) => {
    const y = ev.d.slice(0, 4);
    if (y !== nowYear && (ei === 0 || person.log[ei - 1].d.slice(0, 4) !== y)) rows.push(el('li', 'line__year', y));
    const li = el('li', `line line--${ev.a}`);
    li.dataset.ei = ei;
    li.append(el('span', 'line__date', ev.d.slice(5).replace('-', '/')), el('span', 'line__act', ev.a));
    const pins = el('span', 'line__pins');
    ev.items.forEach((it, i) => {
      if (i) pins.append(el('span', 'sep', '; '));
      pins.append(el('span', 'pin', it.t));
      it.tags.forEach((t) => { pins.append(el('span', 'sep', ', ')); pins.append(el('span', auto.has(t) ? 'tag tag--auto' : 'tag', t)); });
    });
    li.append(pins);
    li.title = fmtDate(ev.d);
    rows.push(li);
  });
  ol.replaceChildren(...rows);
}

/* ---------- clauses ---------- */
function drawClauses() {
  const ol = $('#clauses');
  ol.replaceChildren(...RULES.map((r, i) => {
    const li = el('li', `clause${rules[r.id] ? '' : ' is-off'}`);
    const id = `rule-${r.id}`;
    const input = el('input');
    input.type = 'checkbox'; input.id = id; input.checked = rules[r.id];
    input.addEventListener('change', () => { rules[r.id] = input.checked; sync(); renderRules(); });
    const label = el('label');
    label.htmlFor = id;
    const body = el('span', 'clause__body');
    body.append(el('span', 'clause__label', r.label), el('span', 'clause__quote', `\u201C${r.quote}\u201D`));
    label.append(el('span', 'clause__no', String(i + 1)), body, el('span', 'clause__state', rules[r.id] ? 'on' : 'off'));
    li.append(input, label);
    return li;
  }));
  const on = RULES.filter((r) => rules[r.id]).length;
  $('#rule-count').textContent = `${on} of ${RULES.length} on ·`;
}

/* ---------- lists ---------- */
function drawList(box, result, graded, isYours) {
  const body = $('.list__body', box);
  const parts = [];
  if (!result.list.length) {
    const empty = el('div', 'empty');
    empty.append(el('p', 'empty__big', 'Empty list.'), el('p', null, 'Nothing journey-specific today. The post counts this as a successful answer: better to send nothing than a generic \u201CArt\u201D.'));
    parts.push(empty);
  } else {
    const ol = el('ol', 'slots');
    result.list.forEach((g, i) => {
      const gr = graded.slots[i];
      const li = el('li', `slot${i < SLOTS ? ' slot--top' : ''}${gr && gr.useful ? ' is-useful' : ''}`);
      li.tabIndex = 0;
      li.dataset.events = g.events.join(',');
      li.append(el('span', 'slot__rank', String(i + 1)));
      const main = el('span', 'slot__main');
      main.append(el('span', 'slot__name', g.name));
      const meta = el('span', 'slot__meta', `score ${g.score.toFixed(g.score < 10 ? 1 : 0)} · ${g.days} day${g.days === 1 ? '' : 's'}`);
      main.append(meta);
      li.append(main);
      if (gr) {
        const stamps = el('span', 'stamps');
        (gr.useful ? ['useful'] : gr.flags).forEach((f) => stamps.append(el('span', `stamp stamp--${f.replace(/\s+/g, '-')}`, f)));
        li.append(stamps);
      }
      if (i === SLOTS - 1 && result.list.length > SLOTS) li.classList.add('slot--fold');
      ol.append(li);
    });
    parts.push(ol);
  }
  const score = el('div', 'score');
  const n = el('p', 'score__n');
  if (result.list.length) n.append(el('b', null, String(graded.useful)), document.createTextNode(` of ${Math.min(SLOTS, result.list.length)} top slots useful`));
  else n.append(el('b', null, '0'), document.createTextNode(' slots spent'));
  score.append(n);
  if (graded.real) score.append(el('p', 'score__sub', `${graded.covered} of ${graded.real} real goals reached`));
  else score.append(el('p', 'score__sub', result.list.length ? 'No real goal in this log, so every slot here is spent on noise.' : 'No real goal in this log, so an empty list is the right answer.'));
  parts.push(score);
  if (isYours && result.dropped.length) {
    const d = el('p', 'dropped');
    d.append(el('span', 'dropped__label', 'Left out '));
    d.append(document.createTextNode(result.dropped.map((g) => `${g.name} (${g.why})`).join(', ')));
    parts.push(d);
  }
  body.replaceChildren(...parts);
}

function renderRules() {
  drawClauses();
  const off = infer(person, ALL_OFF);
  const on = infer(person, rules);
  drawList($('#list-off'), off, grade(person, off.list), false);
  drawList($('#list-on'), on, grade(person, on.list), true);
  const n = RULES.filter((r) => rules[r.id]).length;
  $('#yours-sub').textContent = n === RULES.length ? 'all six clauses, as the post describes them' : n === 0 ? 'every clause switched off' : `${RULES.length - n} clause${RULES.length - n === 1 ? '' : 's'} switched off`;
}

/* ---------- hover a slot, mark the log ---------- */
function mark(evs) {
  document.querySelectorAll('.line').forEach((l) => l.classList.toggle('is-marked', evs.includes(+l.dataset.ei)));
  $('#log-lines').classList.toggle('has-marks', evs.length > 0);
}
document.addEventListener('pointerover', (e) => { const s = e.target.closest('.slot'); if (s) mark(s.dataset.events.split(',').map(Number)); });
document.addEventListener('pointerout', (e) => { const s = e.target.closest('.slot'); if (s && !s.contains(e.relatedTarget)) mark([]); });
document.addEventListener('focusin', (e) => { const s = e.target.closest('.slot'); mark(s ? s.dataset.events.split(',').map(Number) : []); });

/* ---------- support check ---------- */
function drawCheck(name) {
  const out = $('#check-out');
  const text = name.trim();
  if (!text) { out.replaceChildren(); return; }
  const r = supportCheck(person, text);
  const head = el('p', `verdict verdict--${r.verdict}`);
  const words = el('span', 'verdict__words');
  r.words.forEach((w, i) => {
    if (i) words.append(document.createTextNode(' '));
    words.append(el('span', `w ${w.framing ? 'w--framing' : w.lines.length ? 'w--found' : 'w--missing'}`, w.w));
  });
  const label = { supported: 'Every word is in the log', partly: 'Partly in the log', unsupported: 'Not in the log', empty: 'Nothing to check' }[r.verdict];
  head.append(words, el('span', 'verdict__label', r.total ? `${label} · ${r.found} of ${r.total} words` : label));
  const notes = [];
  if (r.verdict === 'unsupported') notes.push('Nothing positive in the log backs this up. However fluent it sounds, this is the one output the policy never allows.');
  if (r.onlyNeg) notes.push('Some words appear only in things they hid. That is evidence against, not for.');
  if (r.verdict !== 'unsupported' && r.generic) notes.push('Backed up, but one word. The post\u2019s evaluator also scores granularity, and generic names like this underperform as notification titles.');
  if (r.verdict !== 'unsupported' && !r.generic && r.days === 1) notes.push('Backed by a single day of activity. The policy would drop this as a one-off.');
  if (/modern farmhouse kitchen/i.test(text) && person.id === 'dana') notes.push('This is the post\u2019s own example output. \u201CModern\u201D is not in its sample log either, which is why a word match is a floor and the post uses a model judge for support.');
  if (r.verdict === 'partly' && !/modern farmhouse kitchen/i.test(text)) notes.push('A judge would have to decide whether the missing words are a fair reading or an invention.');
  const parts = [head, ...notes.map((t) => el('p', 'note', t))];
  if (r.evidence.length) {
    const ul = el('ul', 'evidence');
    r.evidence.slice(0, 6).forEach((ei) => {
      const ev = person.log[ei];
      const li = el('li');
      li.append(el('span', 'line__date', ev.d.slice(5).replace('-', '/')), el('span', 'line__act', ev.a), el('span', null, ev.items.map((it) => it.t).join('; ')));
      ul.append(li);
    });
    parts.push(ul);
    if (r.evidence.length > 6) parts.push(el('p', 'note', `and ${r.evidence.length - 6} more lines`));
  }
  out.replaceChildren(...parts);
}

function drawChips() {
  const p = $('#check-chips');
  p.replaceChildren(el('span', 'chips__label', 'Try '), ...person.chips.map((c) => {
    const b = el('button', 'chip', c);
    b.type = 'button';
    b.addEventListener('click', () => { $('#check-in').value = c; drawCheck(c); });
    return b;
  }));
  document.querySelectorAll('.who').forEach((n) => (n.textContent = person.name));
  $('#check-in').placeholder = person.chips[0];
}

$('#check-form').addEventListener('submit', (e) => { e.preventDefault(); drawCheck($('#check-in').value); });
$('#all-on').addEventListener('click', () => { rules = { ...ALL_ON }; sync(); renderRules(); });
$('#all-off').addEventListener('click', () => { rules = { ...ALL_OFF }; sync(); renderRules(); });

function sync() {
  const q = new URLSearchParams();
  if (person !== PEOPLE[0]) q.set('p', person.id);
  const off = RULES.filter((r) => !rules[r.id]).map((r) => r.id);
  if (off.length) q.set('off', off.join(','));
  history.replaceState(null, '', `${location.pathname}${q.toString() ? '?' + q : ''}`);
}

function renderAll() {
  drawPeople();
  drawLog();
  renderRules();
  drawChips();
  $('#check-in').value = person.chips[0];
  drawCheck(person.chips[0]);
}
renderAll();
