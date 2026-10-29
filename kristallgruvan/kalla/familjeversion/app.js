/* =====================================================================
   KRISTALLGRUVAN – GRÄNSSNITT
   Använder KGQ (uppgifter) och KGStore (lagring). Ingen lagringskod här.
   ===================================================================== */
(function () {
  'use strict';
  const Q = window.KGQ, S = window.KGStore;
  const $app = document.getElementById('app');
  const FAMILY = 'familj-1'; // förberett för flera familjer
  let game = null;
  let store = null, kids = [], kid = null, session = null, cur = null, busy = false;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const richText = (t) => String(t).replace(/\{(-?[\d?]+)\/(\d+)\}/g, '<span class="fr"><span>$1</span><span>$2</span></span>');
  const areaById = (id) => Q.AREAS.find((a) => a.id === id);
  const hasAnswers = (s) => Object.values(s.areas || {}).some((a) => a.asked && a.asked.length);
  const doneCount = (s) => Q.AREAS.filter((a) => s.areas[a.id] && s.areas[a.id].done).length;
  const dateTxt = (iso) => { try { return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } };

  /* ---------- pixelkonst ---------- */
  const MOSSA = [
    '......pP........',
    '.....pPPP.......',
    '......PPp.......',
    '..KKKKKKKKKKKK..',
    '.KLLLGGGGGgGGGK.',
    '.KLGGGGgGGGGGGK.',
    '.KGGGGGGGGGgGGK.',
    '.KGGabGGGGabGGK.',
    '.KGGcdGGGGcdGGK.',
    '.KGBBGGGGGGBBGK.',
    '.KGGGGGMMGGGGGK.',
    '.KGgGGGGGGGGgGK.',
    '.KGGGGgGGGGGGGK.',
    '..KKKKKKKKKKKK..',
    '...KK......KK...',
    '................',
  ];
  const MCOL = { K: '#1d2b17', G: '#6cbf4a', L: '#93dd6a', g: '#4c9a35', P: '#9b6bff', p: '#d6c2ff', B: '#f08aa0', M: '#2c4a20', W: '#ffffff', E: '#1d2b17' };
  function mossaSVG(awake, cls) {
    const eyes = awake ? { a: 'W', b: 'E', c: 'E', d: 'E' } : { a: 'G', b: 'G', c: 'E', d: 'E' };
    let r = '';
    MOSSA.forEach((row, y) => row.split('').forEach((ch, x) => {
      const k = eyes[ch] || ch; if (k === '.') return;
      r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${MCOL[k]}"/>`;
    }));
    return `<span class="mossa ${awake ? 'awake' : 'sleep'} ${cls || ''}"><svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>${awake ? '' : '<span class="zzz" aria-hidden="true">z<i>z</i><b>z</b></span>'}</span>`;
  }
  const GEM = ['..XXXX..', '.XHLLLX.', 'XHLLLLLX', 'XLLLLLDX', '.XLLLDX.', '..XLDX..', '...XX...'];
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
  function gemSVG(color, on, size) {
    const col = on ? { X: '#0b0a10', H: '#ffffff', L: color, D: shade(color, -0.35) } : { X: '#0b0a10', H: '#4a4459', L: '#38334a', D: '#2a2638' };
    let r = '';
    GEM.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch !== '.') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${col[ch]}"/>`; }));
    return `<svg class="gem${on ? ' on' : ''}" width="${size || 32}" height="${(size || 32) * 7 / 8}" viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }

  /* ---------- hjälp ---------- */
  function view(html) { $app.innerHTML = html; window.scrollTo(0, 0); const f = $app.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30); }
  let toastT = null;
  function toast(msg, kind) {
    const t = document.getElementById('toast');
    t.className = 'toast show ' + (kind || '');
    t.innerHTML = msg;
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, kind === 'note' ? 3600 : 1300);
  }
  const storeNote = () => store.mode === 'claude'
    ? 'Resultaten sparas i ditt Claude-konto.'
    : 'Resultaten sparas bara i den här webbläsaren. Öppna sidan inloggad på claude.ai för att spara dem i kontot.';

  /* ---------- startsida ---------- */
  function showStart() {
    if (game) game.reset();
    kid = null; session = null; cur = null;
    const list = kids.slice().sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    view(`
<header class="hero">
  <span class="holdzone" data-hold="parent">${mossaSVG(false, 'big')}</span>
  <div class="hero-txt">
    <p class="eyebrow">Ett matteuppdrag</p>
    <h1>Kristallgruvan</h1>
    <p class="lead">Mossa har somnat djupt nere i gruvan. I varje gång ligger en kristall. Lös uppgifterna, hitta kristallerna och väck Mossa!</p>
  </div>
</header>
<section class="panel">
  <h2>Vem spelar?</h2>
  ${list.length ? `<div class="kid-list">${list.map((k) => `<button class="btn kid" data-act="kid" data-id="${esc(k.id)}">${esc(k.name)}</button>`).join('')}</div>` : '<p class="muted">Ingen spelare än. Skapa en nedan.</p>'}
  <form id="newkid" class="newkid" autocomplete="off">
    <h3>${list.length ? 'Ny spelare' : 'Skapa spelare'}</h3>
    <div class="row">
      <label class="fld"><span>Smeknamn</span><input id="kname" maxlength="20" required placeholder="t.ex. Blockkungen"></label>
      <label class="fld"><span>Årskurs</span><select id="kgrade">${[3, 4, 5, 6].map((g) => `<option value="${g}"${g === 4 ? ' selected' : ''}>åk ${g}</option>`).join('')}</select></label>
      <button class="btn" type="submit">Skapa</button>
    </div>
  </form>
</section>
<footer class="foot">
  <span class="muted small">${esc(storeNote())}</span>
</footer>`);
    document.getElementById('newkid').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('kname').value.trim();
      if (!name) return;
      const k = { id: S.uid('k_'), familyId: FAMILY, name, grade: Number(document.getElementById('kgrade').value), createdAt: new Date().toISOString() };
      kids.push(k);
      try { await store.saveKid(k); } catch (err) { toast('Kunde inte spara spelaren. Försök igen.', 'note'); }
      openKid(k.id);
    });
  }

  async function openKid(id) {
    kid = kids.find((k) => k.id === id);
    if (!kid) return showStart();
    const sessions = (await store.listSessions(kid.id)).filter(hasAnswers);
    const fin = sessions.find((s) => s.finishedAt);
    if (fin) return game.open(kid, fin); // kartläggningen klar -> spelet
    const open = sessions.find((s) => !s.finishedAt);
    if (open) { session = open; return showMap(); }
    newSession();
  }
  async function openTest(k) {
    kid = k;
    const sessions = (await store.listSessions(kid.id)).filter(hasAnswers);
    const open = sessions.find((s) => !s.finishedAt), fin = sessions.find((s) => s.finishedAt);
    if (open) { session = open; return showMap(); }
    if (fin) { session = fin; return showKidResults(); }
    newSession();
  }

  function newSession() {
    const lvl = Q.startLevel(kid.grade);
    const now = new Date().toISOString();
    session = { id: S.uid('s_'), kidId: kid.id, familyId: FAMILY, schema: S.SCHEMA, startedAt: now, updatedAt: now, finishedAt: null, startLevel: lvl, grade: kid.grade, areas: {} };
    Q.AREAS.forEach((a) => { session.areas[a.id] = { level: lvl, done: false, asked: [], result: null }; });
    showIntro(); // sparas först vid första svaret
  }

  /* ---------- intro ---------- */
  function showIntro() {
    view(`
<section class="panel intro">
  ${mossaSVG(false)}
  <h2>Hej ${esc(kid.name)}!</h2>
  <p>Gruvan har <b>${Q.AREAS.length} gångar</b>. I varje gång får du 4 eller 5 uppgifter. Uppgifterna blir svårare när det går bra och lättare när det känns knepigt, så det är helt normalt att inte kunna allt.</p>
  <div class="paper">
    <svg viewBox="0 0 10 10" width="36" height="36" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="7" height="10" fill="#f1ecf8"/><rect x="2" y="2" width="5" height="1" fill="#aaa2bf"/><rect x="2" y="4" width="5" height="1" fill="#aaa2bf"/><rect x="2" y="6" width="3" height="1" fill="#aaa2bf"/><rect x="7" y="5" width="2" height="5" fill="#ffd166"/><rect x="7" y="9" width="2" height="1" fill="#1d2b17"/></svg>
    <p><b>Ta fram papper och penna.</b> Räkna gärna på papperet och skriv sedan in svaret.</p>
  </div>
  <ul class="tips">
    <li>Det finns ingen klocka. Ta den tid du behöver.</li>
    <li>Om du inte vet, tryck på <b>Vet inte</b>. Det är också ett bra svar.</li>
    <li>Du kan pausa när du vill och fortsätta en annan dag.</li>
  </ul>
  <button class="btn big" data-act="map" autofocus>Gå ner i gruvan</button>
</section>`);
  }

  /* ---------- karta ---------- */
  function showMap() {
    cur = null;
    const n = doneCount(session), total = Q.AREAS.length;
    if (n === total) return showKidResults();
    const next = Q.AREAS.find((a) => !session.areas[a.id].done);
    view(`
<header class="maphead">
  ${mossaSVG(n >= total, 'mid')}
  <div class="grow">
    <p class="eyebrow">${esc(kid.name)} · kristaller</p>
    <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${n}"><span style="width:${(n / total) * 100}%"></span></div>
    <p class="muted small">${n} av ${total} hittade. ${n === 0 ? 'Börja var du vill!' : n < total / 2 ? 'Mossa rör lite på sig…' : 'Mossa håller på att vakna!'}</p>
  </div>
</header>
<section class="tunnels">
  ${Q.AREAS.map((a, i) => {
    const st = session.areas[a.id], started = st.asked.length > 0 && !st.done;
    return `<button class="tunnel${st.done ? ' done' : ''}${a === next ? ' next' : ''}" data-act="area" data-id="${a.id}" ${st.done ? 'disabled' : ''}>
      ${gemSVG(a.gem, st.done, 34)}
      <span class="t-name"><small>Gång ${i + 1}</small>${esc(a.name)}</span>
      <span class="t-state">${st.done ? 'Klar' : started ? 'Fortsätt' : a === next ? 'Nästa' : 'Gå in'}</span>
    </button>`;
  }).join('')}
</section>
<footer class="foot">
  <button class="link" data-act="home">Pausa och gå till startsidan</button>
</footer>`);
  }

  /* ---------- frågor ---------- */
  function askedSet() {
    const s = new Set();
    Object.values(session.areas).forEach((a) => a.asked.forEach((x) => s.add(x.q)));
    return s;
  }
  function nextQuestion(areaId) {
    const st = session.areas[areaId];
    if (Q.areaDone(st.asked)) return showGem(areaId);
    const q = Q.generate(areaId, st.level, askedSet());
    cur = { areaId, q, shownAt: Date.now() };
    showQuestion();
  }
  function showQuestion() {
    const { areaId, q } = cur, a = areaById(areaId), st = session.areas[areaId];
    const idx = st.asked.length;
    const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < idx ? (st.asked[i].ok ? 'ok' : 'miss') : i === idx ? 'now' : ''}${i === 4 ? ' maybe' : ''}"></i>`).join('');
    let inputHtml;
    if (q.kind === 'choice') {
      inputHtml = `<div class="choices">${q.choices.map((c, i) => `<button class="btn choice" data-act="choice" data-i="${i}">${richText(c)}</button>`).join('')}</div>`;
    } else {
      const hint = q.kind === 'frac' ? 'Skriv bråk med snedstreck, t.ex. 3/4' : q.kind === 'time' ? 'Skriv som 14:05' : 'Skriv bara talet';
      inputHtml = `<form id="ansform" class="ansform" autocomplete="off">
        <label class="sr" for="ans">Ditt svar</label>
        <div class="ansrow"><input id="ans" ${q.kind === 'num' ? 'inputmode="decimal"' : 'inputmode="text"'} autocomplete="off" autocorrect="off" spellcheck="false" autofocus aria-describedby="anshint">${q.unit ? `<span class="unit">${esc(q.unit)}</span>` : ''}</div>
        <p id="anshint" class="muted small">${hint}</p>
        <button class="btn big" type="submit">Svara</button>
      </form>`;
    }
    view(`
<header class="qhead">
  <button class="link" data-act="map">Pausa</button>
  <span class="qarea" style="--gem:${a.gem}">${gemSVG(a.gem, true, 20)} ${esc(a.name)}</span>
  <span class="dots" aria-label="Uppgift ${idx + 1}">${dots}</span>
</header>
<section class="panel qcard">
  <p class="qtext${/^[\d−\-{0,(]/.test(q.text) && q.text.length < 40 ? ' expr' : ''}">${richText(q.text)}${/^[\d−\-{0,(]/.test(q.text) && q.text.length < 40 && !/[?.]$/.test(Q.plain(q.text)) ? ' =' : ''}</p>
  ${q.fig || ''}
  ${inputHtml}
  <button class="link dunno" data-act="dunno">Vet inte</button>
</section>
<p class="muted small center">Räkna gärna på papper.</p>`);
    const f = document.getElementById('ansform');
    if (f) f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = document.getElementById('ans').value;
      if (!v.trim()) { toast('Skriv ett svar eller tryck på Vet inte.', 'note'); return; }
      answer(v);
    });
  }

  function answer(raw, dunno) {
    if (!cur || busy) return;
    busy = true;
    const { areaId, q } = cur, st = session.areas[areaId];
    const ok = !dunno && Q.check(q, raw);
    const given = dunno ? '(vet inte)' : q.kind === 'choice' ? Q.plain(q.choices[Number(raw)]) : String(raw).trim();
    st.asked.push({ level: q.level, q: Q.plain(q.text), given, correct: Q.answerText(q), ok, ms: Date.now() - cur.shownAt, skill: q.skill || '', at: new Date().toISOString() });
    st.level = Q.nextLevel(q.level, ok);
    if (Q.areaDone(st.asked)) { st.done = true; st.result = Q.estimate(st.asked); }
    session.updatedAt = new Date().toISOString();
    if (doneCount(session) === Q.AREAS.length) session.finishedAt = session.updatedAt;
    store.saveSession(session).catch(() => {});
    toast(ok ? '<b>Rätt!</b> Snyggt.' : dunno ? '<b>Helt okej!</b> Vi tar en annan.' : '<b>Inte riktigt.</b> Bra kämpat, vi går vidare.', ok ? 'good' : 'soft');
    setTimeout(() => { busy = false; nextQuestion(areaId); }, ok ? 900 : 1300);
  }

  function showGem(areaId) {
    cur = null;
    const a = areaById(areaId), n = doneCount(session), total = Q.AREAS.length;
    view(`
<section class="panel found">
  <div class="gemstage">${gemSVG(a.gem, true, 112)}</div>
  <p class="eyebrow">Kristall ${n} av ${total}</p>
  <h2>Du hittade kristallen i gången ${esc(a.name)}!</h2>
  ${mossaSVG(n === total, n === total ? 'mid' : '')}
  <p class="muted">${n === total ? 'Alla kristaller är hittade. Mossa vaknar!' : n >= total - 3 ? 'Mossa gäspar stort. Bara några kristaller kvar!' : 'Mossa vände sig i sömnen. Fortsätt leta!'}</p>
  <button class="btn big" data-act="${n === total ? 'results' : 'map'}" autofocus>${n === total ? 'Väck Mossa' : 'Tillbaka till gruvan'}</button>
</section>`);
  }

  /* ---------- barnets resultat ---------- */
  function showKidResults() {
    const done = doneCount(session) === Q.AREAS.length;
    view(`
<header class="hero won">
  ${mossaSVG(true, 'big')}
  <div class="hero-txt">
    <p class="eyebrow">${esc(kid.name)}</p>
    <h1>${done ? 'Mossa är vaken!' : 'Bra jobbat så här långt'}</h1>
    <p class="lead">Varje rad visar hur djupt ner i gruvan du kom. Fler lysande kristaller betyder svårare uppgifter som du klarade.</p>
  </div>
</header>
<section class="panel">
  <ul class="depth">
    ${Q.AREAS.map((a) => {
      const r = session.areas[a.id].result, lv = r ? r.level : 0;
      return `<li><span class="d-name">${esc(a.name)}</span><span class="d-gems" aria-label="${lv} av 5">${[1, 2, 3, 4, 5].map((i) => gemSVG(a.gem, i <= lv, 22)).join('')}</span></li>`;
    }).join('')}
  </ul>
</section>
<div class="actions">
  ${done ? '<button class="btn big" data-act="play" autofocus>Till spelet</button><button class="btn ghost" data-act="again">Gör en ny kartläggning</button>' : '<button class="btn" data-act="map">Fortsätt leta</button>'}
  <button class="btn ghost" data-act="home">Byt spelare</button>
</div>`);
  }

  /* ---------- föräldravy ---------- */
  let pKid = null, pSessions = [], pSession = null;
  async function showParent(kidId, sessionId) {
    pKid = kids.find((k) => k.id === kidId) || kids[0] || null;
    pSessions = pKid ? (await store.listSessions(pKid.id)).filter(hasAnswers) : [];
    pSession = pSessions.find((s) => s.id === sessionId) || pSessions[0] || null;
    let body = '';
    if (!pKid) body = '<section class="panel"><p>Inga spelare än. När ett barn har gjort uppgifter syns resultaten här.</p></section>';
    else if (!pSession) body = `<section class="panel"><p>${esc(pKid.name)} har inte startat någon kartläggning än.</p></section>`;
    else body = parentSession(pSession);
    view(`
<div class="parent">
  <header class="phead">
    <div><p class="eyebrow">För vuxna</p><h1>Resultat</h1></div>
    <button class="btn ghost" data-act="home">Till startsidan</button>
  </header>
  ${kids.length > 1 ? `<div class="chips">${kids.map((k) => `<button class="chip${pKid && k.id === pKid.id ? ' on' : ''}" data-act="pkid" data-id="${esc(k.id)}">${esc(k.name)}</button>`).join('')}</div>` : ''}
  ${pSessions.length > 1 ? `<label class="fld inline"><span>Kartläggning</span><select id="psel">${pSessions.map((s) => `<option value="${esc(s.id)}"${s.id === pSession.id ? ' selected' : ''}>${esc(dateTxt(s.startedAt))}${s.finishedAt ? '' : ' (pågår)'}</option>`).join('')}</select></label>` : ''}
  ${body}
  ${pKid ? await game.parentSection(pKid) : ''}
  <section class="panel">
    <h2>Data och flytt</h2>
    <p class="muted">${esc(storeNote())} All data kan tas ut som JSON, till exempel för att flytta till en egen server senare.</p>
    <button class="btn ghost" data-act="export">Visa all data som JSON</button>
    <div id="exportbox" hidden><textarea id="exportta" readonly rows="10"></textarea><button class="btn ghost" data-act="copy">Kopiera</button></div>
  </section>
</div>`);
    const sel = document.getElementById('psel');
    if (sel) sel.addEventListener('change', () => showParent(pKid.id, sel.value));
    game.bindParent();
  }

  function parentSession(s) {
    const rows = Q.AREAS.map((a) => ({ a, st: s.areas[a.id] || { asked: [] }, r: s.areas[a.id] && (s.areas[a.id].result || (s.areas[a.id].asked.length ? Q.estimate(s.areas[a.id].asked) : null)) }));
    const finished = rows.filter((x) => x.st.done);
    const levels = finished.map((x) => x.r.level).sort((a, b) => a - b);
    const median = levels.length ? levels[Math.floor((levels.length - 1) / 2)] : null;
    const ranked = finished.slice().sort((x, y) => (y.r.level - x.r.level) || (y.r.correct / y.r.total - x.r.correct / x.r.total));
    const strong = ranked.slice(0, 3), weak = ranked.slice(-3).reverse();
    const allAns = rows.flatMap((x) => x.st.asked);
    const tableMs = rows.find((x) => x.a.id === 'tabell').st.asked.filter((x) => x.ok).map((x) => x.ms);
    const tAvg = tableMs.length ? tableMs.reduce((a, b) => a + b, 0) / tableMs.length / 1000 : null;
    const sec = (ms) => (ms ? (ms / 1000).toFixed(ms < 10000 ? 1 : 0).replace('.', ',') + ' s' : '–');
    const pill = (r, st) => !r ? '<span class="pill none">ej börjad</span>' : !st.done ? '<span class="pill mid">pågår</span>' : r.level === 0 ? '<span class="pill low">öva grunder</span>' : r.secure ? '<span class="pill good">säker</span>' : '<span class="pill mid">på väg</span>';

    return `
<section class="panel">
  <div class="sumgrid">
    <div><p class="eyebrow">Spelare</p><p class="big-v">${esc(pKid.name)} <small>åk ${esc(s.grade || pKid.grade)}</small></p></div>
    <div><p class="eyebrow">Status</p><p class="big-v">${s.finishedAt ? 'Klar' : `${finished.length} av ${Q.AREAS.length}`}</p><p class="muted small">Start ${esc(dateTxt(s.startedAt))}</p></div>
    <div><p class="eyebrow">Samlad nivå</p><p class="big-v">${median === null ? '–' : esc(Q.LEVEL_LABELS[median])}</p><p class="muted small">median av klara områden</p></div>
    <div><p class="eyebrow">Svar</p><p class="big-v">${allAns.filter((x) => x.ok).length} av ${allAns.length} rätt</p>${tAvg ? `<p class="muted small">tabellerna: ${tAvg.toFixed(1).replace('.', ',')} s per rätt svar</p>` : ''}</div>
  </div>
  ${finished.length >= 3 ? `<div class="sw">
    <div><h3>Starkast</h3><ul>${strong.map((x) => `<li>${esc(x.a.name)} <span class="muted">· ${esc(x.r.label)}</span></li>`).join('')}</ul></div>
    <div><h3>Att öva mer på</h3><ul>${weak.map((x) => `<li>${esc(x.a.name)} <span class="muted">· ${esc(x.r.label)}</span></li>`).join('')}</ul></div>
  </div>` : ''}
</section>
<section class="panel">
  <h2>Per område</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Område</th><th>Nivå</th><th>Läge</th><th class="num">Rätt</th><th class="num">Snitt-tid</th></tr></thead>
    <tbody>${rows.map(({ a, st, r }) => `<tr><td>${gemSVG(a.gem, !!st.done, 16)} ${esc(a.name)}</td><td>${r ? esc(r.label) : '–'}</td><td>${pill(r, st)}</td><td class="num">${r ? `${r.correct}/${r.total}` : '–'}</td><td class="num">${r ? sec(r.avgMs) : '–'}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="muted small">Nivå = den svåraste nivån där barnet klarade minst hälften av uppgifterna. <b>Säker</b> = alla rätt på den nivån. Med 4–5 uppgifter per område är det en fingervisning, inte ett betyg.</p>
</section>
<section class="panel">
  <h2>Alla svar</h2>
  ${rows.filter((x) => x.st.asked.length).map(({ a, st }) => `<details><summary>${esc(a.name)} <span class="muted">(${st.asked.length} uppgifter)</span></summary>
    <div class="tablewrap"><table class="ans">
      <thead><tr><th>Nivå</th><th>Uppgift</th><th>Svar</th><th>Rätt svar</th><th class="num">Tid</th></tr></thead>
      <tbody>${st.asked.map((x) => `<tr class="${x.ok ? 'ok' : 'miss'}"><td>${esc(Q.LEVEL_LABELS[x.level])}</td><td>${esc(x.q)}${x.skill ? `<br><span class="muted small">${esc(x.skill)}</span>` : ''}</td><td><span class="mark">${x.ok ? '✓' : '✗'}</span> ${esc(x.given)}</td><td>${esc(x.correct)}</td><td class="num">${sec(x.ms)}</td></tr>`).join('')}</tbody>
    </table></div></details>`).join('') || '<p class="muted">Inga svar än.</p>'}
</section>`;
  }

  /* ---------- händelser ---------- */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'kid') openKid(b.dataset.id);
    else if (act === 'map') showMap();
    else if (act === 'area') nextQuestion(b.dataset.id);
    else if (act === 'choice') answer(b.dataset.i);
    else if (act === 'dunno') answer('', true);
    else if (act === 'results') showKidResults();
    else if (act === 'play') openKid(kid.id);
    else if (act === 'again') newSession();
    else if (act === 'home') showStart();
    else if (act === 'parent') showParent();
    else if (act === 'pkid') showParent(b.dataset.id);
    else if (act === 'export') {
      const data = await store.exportAll();
      document.getElementById('exportbox').hidden = false;
      document.getElementById('exportta').value = JSON.stringify(data, null, 2);
    } else if (act === 'copy') {
      const ta = document.getElementById('exportta');
      try { await navigator.clipboard.writeText(ta.value); toast('Kopierat', 'good'); } catch (err) { ta.focus(); ta.select(); toast('Markerat. Kopiera med Cmd+C eller Ctrl+C.', 'note'); }
    }
  });

  /* ---------- start ---------- */
  (async function boot() {
    view('<div class="loading">' + mossaSVG(false, 'big') + '<p class="muted">Tänder lyktorna…</p></div>');
    store = await S.initStore();
    store.onError = () => toast('Kunde inte spara just nu. Det sparas igen vid nästa svar.', 'note');
    try { kids = await store.listKids(); } catch (e) { kids = []; }
    game = window.KGGame({
      store, view, toast, esc, richText, gemSVG, mossaSVG, shade, openTest,
      rerenderParent: async () => { const y = window.scrollY; await showParent(pKid && pKid.id, pSession && pSession.id); window.scrollTo(0, y); },
    });
    if (location.hash === '#vuxen') showParent(); else showStart();
  })();

  /* ---------- dold väg till föräldravyn ----------
     1) håll fingret/musen på Mossa på startsidan i 3 sekunder, eller
     2) öppna länken med #vuxen på slutet */
  let holdT = null;
  const stopHold = () => { clearTimeout(holdT); holdT = null; };
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('[data-hold="parent"]')) return;
    stopHold();
    holdT = setTimeout(() => { holdT = null; showParent(); }, 3000);
  });
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, stopHold, true));
  document.addEventListener('pointerleave', (e) => { if (e.target.matches && e.target.matches('[data-hold]')) stopHold(); }, true);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
  window.addEventListener('hashchange', () => { if (location.hash === '#vuxen' && store) showParent(); });
})();
