/* =====================================================================
   KRISTALLGRUVAN – LÄRARSIDAN
   Visar anonym statistik över vilka uppgifter eleverna gör fel på.
   Statistiken är inte kopplad till några användarnamn.
   ===================================================================== */
(function () {
  'use strict';
  const Q = window.KGQ;
  const $app = document.getElementById('app');
  const cfg = window.CYBER_CONFIG || {};
  const URL_ = String(cfg.supabaseUrl || '').trim().replace(/\/+$/, '');
  const KEY = String(cfg.supabaseKey || '').trim();
  const SPEL = 'kristallgruvan';
  const TKEY = 'cyberdyne.teacher';
  let token = null, days = 30, grade = '', data = null;
  try { token = sessionStorage.getItem(TKEY); } catch (e) { token = null; }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const areaName = (id) => (Q.AREAS.find((a) => a.id === id) || {}).name || id;
  const pct = (w, a) => (a ? Math.round((w / a) * 100) : 0);
  const fmtN = (n) => Number(n || 0).toLocaleString('sv-SE');
  function view(html) { $app.innerHTML = html; const f = $app.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30); }

  async function rpc(fn, body) {
    const h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(KEY)) h.Authorization = 'Bearer ' + KEY;
    let r;
    try { r = await fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(body) }); }
    catch (e) { throw Object.assign(new Error('offline'), { code: 'offline' }); }
    const t = await r.text();
    if (!r.ok) { const code = ['not_logged_in', 'weak_password', 'not_found'].find((c) => t.indexOf(c) >= 0) || 'server'; throw Object.assign(new Error(t), { code }); }
    return t ? JSON.parse(t) : null;
  }

  /* ---------- inloggning ---------- */
  function showLogin(msg) {
    view(`
<header class="phead"><div><p class="eyebrow">Kristallgruvan</p><h1>Lärarsidan</h1></div><a class="btn ghost" href="./">Till spelet</a></header>
<section class="panel">
  ${URL_ && KEY ? `<p class="muted">Här ser du vilka uppgifter eleverna oftast gör fel på. Statistiken är anonym och inte kopplad till några namn.</p>
  <form id="tform" class="row" autocomplete="on">
    <input type="text" name="username" value="lärare" autocomplete="username" hidden>
    <label class="fld"><span>Lärarlösenord</span><input id="tpw" type="password" required autocomplete="current-password" autofocus></label>
    <button class="btn" type="submit">Logga in</button>
  </form>
  <p id="err" class="small errtxt" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>` : '<p>Lärarsidan behöver Supabase. Fyll i <code>konto/config.js</code> först (se README).</p>'}
</section>`);
    const f = document.getElementById('tform');
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = f.querySelector('button'); b.disabled = true;
      try {
        const r = await rpc('teacher_login', { p_password: document.getElementById('tpw').value });
        if (r && r.token) { token = r.token; try { sessionStorage.setItem(TKEY, token); } catch (x) { /* */ } load(); return; }
        const m = { wrong_login: 'Fel lösenord.', locked: 'För många försök. Vänta 15 minuter och försök igen.', no_teacher_password: 'Inget lärarlösenord är satt än. Kör set_teacher_password i Supabase (se README).' }[r && r.error] || 'Kunde inte logga in.';
        showLogin(m);
      } catch (err) { showLogin('Kunde inte nå servern. Försök igen om en stund.'); }
    });
  }

  /* ---------- statistik ---------- */
  async function load() {
    view('<p class="muted" style="padding-top:20vh;text-align:center">Hämtar statistik…</p>');
    try {
      data = await rpc('teacher_stats', { p_token: token, p_spel: SPEL, p_days: days, p_grade: grade ? Number(grade) : null });
      render();
    } catch (e) {
      if (e.code === 'not_logged_in') { token = null; try { sessionStorage.removeItem(TKEY); } catch (x) { /* */ } showLogin('Du har blivit utloggad. Logga in igen.'); }
      else showLogin('Kunde inte hämta statistiken. Försök igen om en stund.');
    }
  }

  function bars(rows, labelFn) {
    // en serie (felprocent) -> en färg, värdet skrivs ut vid varje stapel
    const max = Math.max(10, ...rows.map((r) => pct(r.wrong, r.attempts)));
    return `<div class="hbars" role="list">${rows.map((r) => {
      const p = pct(r.wrong, r.attempts);
      return `<div class="hbar${r.attempts < 10 ? ' few' : ''}" role="listitem" tabindex="0" title="${esc(labelFn(r))}: ${p} % fel (${fmtN(r.wrong)} av ${fmtN(r.attempts)} svar)">
        <span class="hb-l">${esc(labelFn(r))}</span>
        <span class="hb-track"><span class="hb-fill" style="width:${Math.max(1, (p / max) * 100)}%"></span></span>
        <span class="hb-v">${p} %</span>
        <span class="hb-n">${fmtN(r.attempts)} svar${r.attempts < 10 ? ' · för få svar för att säga något' : ''}</span></div>`;
    }).join('')}</div>`;
  }

  function render() {
    const d = data || {}, t = d.totals || { attempts: 0, wrong: 0 };
    const areas = (d.areas || []).slice().sort((a, b) => pct(b.wrong, b.attempts) - pct(a.wrong, a.attempts));
    const levels = d.levels || [];
    const skills = d.skills || [];
    const activeDays = (d.days || []).filter((x) => x.attempts > 0).length;
    view(`
<div class="parent">
<header class="phead">
  <div><p class="eyebrow">Kristallgruvan</p><h1>Lärarsidan</h1></div>
  <div class="row"><a class="btn ghost" href="./">Till spelet</a><button class="btn ghost" data-t="logout">Logga ut</button></div>
</header>
<section class="panel filters">
  <label class="fld inline"><span>Period</span><select id="fdays">${[[7, 'Senaste 7 dagarna'], [30, 'Senaste 30 dagarna'], [90, 'Senaste 90 dagarna'], [365, 'Senaste året']].map(([v, n]) => `<option value="${v}" ${v === days ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <label class="fld inline"><span>Årskurs</span><select id="fgrade"><option value="">Alla</option>${[3, 4, 5, 6].map((g) => `<option value="${g}" ${String(g) === grade ? 'selected' : ''}>åk ${g}</option>`).join('')}</select></label>
</section>
<section class="panel">
  <div class="sumgrid">
    <div><p class="eyebrow">Svar</p><p class="big-v">${fmtN(t.attempts)}</p></div>
    <div><p class="eyebrow">Andel fel</p><p class="big-v">${pct(t.wrong, t.attempts)} %</p><p class="muted small">${fmtN(t.wrong)} felaktiga svar</p></div>
    <div><p class="eyebrow">Dagar med spel</p><p class="big-v">${activeDays}</p><p class="muted small">sedan ${esc(d.since || '')}</p></div>
  </div>
  ${t.attempts < 50 ? '<p class="muted small">Det finns lite data än, så siffrorna kan svänga mycket.</p>' : ''}
</section>
${t.attempts ? `
<section class="panel">
  <h2>Andel fel per område</h2>
  ${bars(areas, (r) => areaName(r.area))}
  <details><summary>Visa som tabell</summary><div class="tablewrap"><table><thead><tr><th>Område</th><th class="num">Svar</th><th class="num">Fel</th><th class="num">Andel fel</th></tr></thead><tbody>
    ${areas.map((r) => `<tr><td>${esc(areaName(r.area))}</td><td class="num">${fmtN(r.attempts)}</td><td class="num">${fmtN(r.wrong)}</td><td class="num">${pct(r.wrong, r.attempts)} %</td></tr>`).join('')}
  </tbody></table></div></details>
</section>
<section class="panel">
  <h2>Andel fel per svårighetsnivå</h2>
  ${bars(levels, (r) => Q.LEVEL_LABELS[r.level] || 'nivå ' + r.level)}
  <p class="muted small">Spelet anpassar nivån efter varje elev, så ungefär en tredjedel fel är normalt. Mycket högre än så kan betyda att nivån är för svår.</p>
</section>
<section class="panel">
  <h2>Vanligaste felen</h2>
  <p class="muted small">Färdigheter med högst andel fel (minst 5 svar). Exemplen är de senaste felaktiga svaren.</p>
  ${skills.length ? skills.map((s) => `
  <details class="skill">
    <summary><span class="sk-name">${esc(s.skill || 'övrigt')}</span> <span class="muted">· ${esc(areaName(s.area))}</span><span class="sk-p">${pct(s.wrong, s.attempts)} % fel</span><span class="muted small sk-n">${fmtN(s.wrong)} av ${fmtN(s.attempts)}</span></summary>
    ${(s.common_given || []).length ? `<p class="small">Vanliga felsvar: ${s.common_given.map((c) => `<span class="pill none">${esc(c.given)} · ${c.n} st</span>`).join(' ')}</p>` : ''}
    ${s.dunno ? `<p class="small muted">"Vet inte": ${fmtN(s.dunno)} gånger</p>` : ''}
    ${(s.examples || []).length ? `<div class="tablewrap"><table class="ans"><thead><tr><th>Nivå</th><th>Uppgift</th><th>Elevens svar</th><th>Rätt svar</th></tr></thead><tbody>
      ${s.examples.map((x) => `<tr class="miss"><td>${esc(Q.LEVEL_LABELS[x.level] || '')}</td><td>${esc(x.question)}</td><td><span class="mark">✗</span> ${esc(x.given)}</td><td>${esc(x.correct)}</td></tr>`).join('')}
    </tbody></table></div>` : ''}
  </details>`).join('') : '<p class="muted">Inga fel med tillräckligt många svar än.</p>'}
</section>` : '<section class="panel"><p class="muted">Inga svar under den här perioden.</p></section>'}
<section class="panel">
  <h2>Ge en elev ett nytt lösenord</h2>
  <p class="muted small">Om en elev har glömt sitt lösenord. Lösenordet gäller kontot i alla spel, och eleven loggas ut från alla enheter.</p>
  <form id="rform" class="row" autocomplete="off">
    <label class="fld"><span>Elevens smeknamn</span><input id="rname" required maxlength="16"></label>
    <label class="fld"><span>Nytt lösenord (minst 4 tecken)</span><input id="rpw" required minlength="4" maxlength="64"></label>
    <button class="btn" type="submit">Spara</button>
  </form>
  <p id="rmsg" class="small" hidden></p>
</section>
</div>`);
    document.getElementById('fdays').addEventListener('change', (e) => { days = Number(e.target.value); load(); });
    document.getElementById('fgrade').addEventListener('change', (e) => { grade = e.target.value; load(); });
    const rf = document.getElementById('rform');
    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const m = document.getElementById('rmsg'); m.hidden = false;
      try {
        await rpc('teacher_reset_password', { p_token: token, p_name: document.getElementById('rname').value.trim(), p_new: document.getElementById('rpw').value });
        m.className = 'small okmsg'; m.textContent = 'Klart. Eleven kan logga in med det nya lösenordet.'; rf.reset();
      } catch (err) {
        m.className = 'small errtxt';
        m.textContent = { not_found: 'Hittade ingen elev med det smeknamnet.', weak_password: 'Lösenordet ska ha minst 4 tecken.', not_logged_in: 'Du har blivit utloggad. Ladda om sidan.' }[err.code] || 'Det gick inte att spara. Försök igen.';
      }
    });
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    if (b.dataset.t === 'logout') {
      try { await rpc('teacher_logout', { p_token: token }); } catch (x) { /* */ }
      token = null; try { sessionStorage.removeItem(TKEY); } catch (x) { /* */ }
      showLogin();
    }
  });

  if (token) load(); else showLogin();
})();
