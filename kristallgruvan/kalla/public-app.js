/* =====================================================================
   KRISTALLGRUVAN PUBLIK – INLOGGNING, KONTO OCH TOPPLISTA
   Spelet självt finns i game.js (samma som i familjeversionen).
   ===================================================================== */
(function () {
  'use strict';
  const $app = document.getElementById('app');
  const store = new window.KGPublicStore();
  let game = null, profile = null, boardKind = 'week', confirmDelete = false;

  /* ---------- hjälp (samma som i familjeversionen) ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const richText = (t) => String(t).replace(/\{(-?[\d?]+)\/(\d+)\}/g, '<span class="fr"><span>$1</span><span>$2</span></span>');
  const MOSSA = ['......pP........', '.....pPPP.......', '......PPp.......', '..KKKKKKKKKKKK..', '.KLLLGGGGGgGGGK.', '.KLGGGGgGGGGGGK.', '.KGGGGGGGGGgGGK.', '.KGGabGGGGabGGK.', '.KGGcdGGGGcdGGK.', '.KGBBGGGGGGBBGK.', '.KGGGGGMMGGGGGK.', '.KGgGGGGGGGGgGK.', '.KGGGGgGGGGGGGK.', '..KKKKKKKKKKKK..', '...KK......KK...', '................'];
  const MCOL = { K: '#1d2b17', G: '#6cbf4a', L: '#93dd6a', g: '#4c9a35', P: '#9b6bff', p: '#d6c2ff', B: '#f08aa0', M: '#2c4a20', W: '#ffffff', E: '#1d2b17' };
  function mossaSVG(awake, cls) {
    const eyes = awake ? { a: 'W', b: 'E', c: 'E', d: 'E' } : { a: 'G', b: 'G', c: 'E', d: 'E' };
    let r = '';
    MOSSA.forEach((row, y) => row.split('').forEach((ch, x) => { const k = eyes[ch] || ch; if (k !== '.') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${MCOL[k]}"/>`; }));
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
  function view(html) { $app.innerHTML = html; window.scrollTo(0, 0); const f = $app.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30); }
  let toastT = null;
  function toast(msg, kind) {
    const t = document.getElementById('toast');
    t.className = 'toast show ' + (kind || ''); t.innerHTML = msg;
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, kind === 'note' ? 4200 : 1300);
  }
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  /* ---------- smeknamn: samma regler som i databasen ---------- */
  const BAD = ['kuk', 'fitt', 'jävl', 'javl', 'hora', 'neger', 'nazi', 'hitler', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'porn', 'penis', 'slyna', 'bög', 'knull', 'rasist'];
  function nameProblem(n) {
    if (!/^[A-Za-zÅÄÖåäöÉéÜü0-9 _-]{2,16}$/.test(n)) return 'Smeknamnet ska vara 2–16 tecken: bokstäver, siffror, mellanslag, - eller _.';
    const l = n.toLowerCase();
    if (BAD.some((w) => l.includes(w)) || /(^|[^a-zåäö])(sex|fan|skit|arsle)([^a-zåäö]|$)/.test(l)) return 'Välj ett annat smeknamn.';
    return null;
  }

  /* ---------- start och inloggning ---------- */
  const online = () => store.mode === 'online';
  const pwField = (id, label, auto) => `<label class="fld"><span>${label}</span><input id="${id}" type="password" minlength="${online() ? 4 : 0}" maxlength="64" ${online() ? 'required' : ''} autocomplete="${auto}"></label>`;
  function errBox() { return '<p id="err" class="small errtxt" hidden></p>'; }
  function showErr(msg) { const el = document.getElementById('err'); if (el) { el.textContent = msg; el.hidden = false; } }
  function busyBtn(form, on) { const b = form.querySelector('button[type=submit]'); if (b) { b.disabled = on; } }

  function showStart(mode) {
    if (game) game.reset();
    confirmDelete = false;
    const legacy = online() ? store.legacyProfiles() : [];
    if (!mode && legacy.length) mode = 'claim';
    if (!mode) mode = online() || store.localProfiles().length ? 'login' : 'new';
    let panel = '';
    if (mode === 'claim') {
      const lp = legacy[0];
      panel = `<section class="panel">
  <h2>Välj ett lösenord, ${esc(lp.name)}</h2>
  <p class="muted">Nu loggar man in med smeknamn och lösenord. Välj ett lösenord för <b>${esc(lp.name)}</b>, så finns allt du har samlat kvar.</p>
  <form id="claimform" class="newkid" autocomplete="off" style="border:0;padding:0">
    <div class="row">${pwField('pw1', 'Nytt lösenord', 'new-password')}${pwField('pw2', 'Skriv lösenordet igen', 'new-password')}<button class="btn" type="submit">Spara</button></div>
    ${errBox()}
  </form>
  <button class="link" data-act="skipclaim" data-id="${esc(lp.id)}">Det här är inte jag</button>
</section>`;
    } else if (mode === 'login') {
      panel = `<section class="panel">
  <h2>Logga in</h2>
  <form id="loginform" class="newkid" autocomplete="on" style="border:0;padding:0">
    <div class="row">
      <label class="fld"><span>Smeknamn</span><input id="lname" maxlength="16" required autocomplete="username" autofocus></label>
      ${online() ? pwField('lpw', 'Lösenord', 'current-password') : ''}
      <button class="btn" type="submit">Logga in</button>
    </div>
    ${online() ? '<label class="check"><input type="checkbox" id="remember"> Håll mig inloggad på den här enheten</label>' : ''}
    ${errBox()}
  </form>
  <div class="row"><button class="link" data-act="newform">Ny spelare? Skapa ett konto</button></div>
  ${online() ? '<p class="muted small">Glömt lösenordet? Be din lärare eller en vuxen att ge dig ett nytt.</p>' : ''}
</section>`;
    } else {
      panel = `<section class="panel">
  <h2>Ny spelare</h2>
  <form id="newform" class="newkid" autocomplete="off" style="border:0;padding:0">
    <div class="row">
      <label class="fld"><span>Smeknamn</span><input id="pname" maxlength="16" required placeholder="t.ex. Blockkungen" autocomplete="username" autofocus></label>
      <label class="fld" style="flex:0 1 130px"><span>Årskurs</span><select id="pgrade">${[3, 4, 5, 6].map((g) => `<option value="${g}"${g === 4 ? ' selected' : ''}>åk ${g}</option>`).join('')}</select></label>
    </div>
    ${online() ? `<div class="row">${pwField('pw1', 'Lösenord (minst 4 tecken)', 'new-password')}${pwField('pw2', 'Skriv lösenordet igen', 'new-password')}</div>
    <label class="check"><input type="checkbox" id="remember"> Håll mig inloggad på den här enheten</label>` : ''}
    <button class="btn" type="submit" style="align-self:flex-start">Skapa och börja spela</button>
    ${errBox()}
  </form>
  <p class="muted small">Skriv ett påhittat smeknamn, inte ditt riktiga namn. Smeknamnet syns på topplistan.${online() ? ' Kom ihåg ditt lösenord.' : ''}</p>
  <button class="link" data-act="loginform">Har du redan ett konto? Logga in</button>
</section>`;
    }
    view(`
<header class="hero">
  ${mossaSVG(false, 'big')}
  <div class="hero-txt">
    <p class="eyebrow">Ett mattespel för åk 3–6</p>
    <h1>Kristallgruvan</h1>
    <p class="lead">Mossa sover djupt nere i gruvan. Lös matteuppdrag, samla kristaller, kläck egna varelser och bygg din bas. Klättra på topplistan!</p>
    <div class="herobtns"><button class="btn ghost" data-act="board">Se topplistan</button><a class="btn ghost" href="foraldrar.html">För föräldrar</a></div>
  </div>
</header>
${panel}
<footer class="foot"><span class="muted small">${online() ? 'Vi sparar bara ditt smeknamn, ditt lösenord (krypterat), din årskurs, dina poäng och dina framsteg i spelet. Hur många som svarar rätt och fel på olika uppgifter sparas utan namn.' : 'Spelet sparas bara i den här webbläsaren.'}</span><span class="row"><a class="link" href="../">Alla spel</a><a class="link" href="larare.html">För lärare</a></span></footer>`);

    const f = document.getElementById('loginform') || document.getElementById('newform') || document.getElementById('claimform');
    if (!f) return;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const remember = !!(document.getElementById('remember') || {}).checked;
      busyBtn(f, true);
      try {
        if (f.id === 'loginform') {
          const pr = await store.login(document.getElementById('lname').value.trim(), online() ? document.getElementById('lpw').value : '', remember);
          play(pr, remember);
        } else if (f.id === 'newform') {
          const name = document.getElementById('pname').value.trim().replace(/\s+/g, ' ');
          const err = nameProblem(name); if (err) throw Object.assign(new Error(err), { text: err });
          if (online()) {
            const a = document.getElementById('pw1').value, b = document.getElementById('pw2').value;
            if (a.length < 4) throw Object.assign(new Error(), { code: 'weak_password' });
            if (a !== b) throw Object.assign(new Error(), { text: 'Lösenorden är inte likadana.' });
            const pr = await store.register(name, a, Number(document.getElementById('pgrade').value), remember);
            play(pr, remember);
          } else {
            if (store.localProfiles().some((p) => p.name.toLowerCase() === name.toLowerCase())) throw Object.assign(new Error(), { code: 'name_taken' });
            const pr = await store.register(name, '', Number(document.getElementById('pgrade').value));
            store.saveLocalProfile(pr);
            play(pr, false);
          }
        } else {
          const lp = store.legacyProfiles()[0];
          const a = document.getElementById('pw1').value, b = document.getElementById('pw2').value;
          if (a.length < 4) throw Object.assign(new Error(), { code: 'weak_password' });
          if (a !== b) throw Object.assign(new Error(), { text: 'Lösenorden är inte likadana.' });
          const pr = await store.claim(lp.id, a);
          store.markMigrated(lp.id);
          play(pr, false);
        }
      } catch (err) {
        showErr(err.text || window.KGPublicStore.message(err.code));
        busyBtn(f, false);
      }
    });
  }

  async function play(pr, remember) {
    profile = { id: pr.id, name: pr.name, grade: pr.grade || 4, token: pr.token || null };
    store.profile = profile;
    if (online()) store.rememberSession(profile, remember);
    try {
      await game.open({ id: profile.id, familyId: 'public', name: profile.name, grade: profile.grade }, null);
    } catch (e) {
      if (e && e.code === 'not_logged_in') return; // hanteras av onLoggedOut
      console.error(e);
      toast('Något gick fel när spelet skulle laddas. Försök igen.', 'note');
      showStart('login');
    }
  }

  /* ---------- topplista ---------- */
  async function showBoard() {
    const tabs = [['week', 'Veckans poäng'], ['race', 'Vagnrace'], ['total', 'All-time']];
    const back = game.getPlayer() ? '<button class="link" data-g="hub">Tillbaka</button>' : '<button class="link" data-act="start">Tillbaka</button>';
    const head = `<header class="subhead">${back}<h2>Topplista</h2></header>
<div class="chips">${tabs.map(([id, n]) => `<button class="chip${boardKind === id ? ' on' : ''}" data-act="btab" data-id="${id}">${n}</button>`).join('')}</div>`;
    view(head + '<section class="panel"><p class="muted">Hämtar…</p></section>');
    const p = game.getPlayer();
    try { await store.flush(); } catch (e) { /* ingen fara */ }
    let rows = [];
    try { rows = await store.leaderboard(boardKind, p && p.kidId); } catch (e) { rows = null; }
    const note = { week: 'Poäng för rätta svar den här veckan. Svårare uppgifter ger mer. Nollställs varje måndag.', race: 'Flest rätt på 60 sekunder i vagnracet.', total: 'Alla poäng sedan du började spela.' }[boardKind];
    const body = rows === null ? '<p>Kunde inte hämta topplistan just nu. Försök igen om en stund.</p>'
      : !rows.length ? '<p class="muted">Ingen har poäng här än. Bli först!</p>'
      : `<ol class="board">${rows.map((r) => `<li class="${r.me ? 'me' : ''}${r.rank <= 3 ? ' top' + r.rank : ''}"><span class="b-rank">${r.rank}</span><span class="b-name">${esc(r.name)}${r.me ? ' <small>(du)</small>' : ''}</span><span class="b-score">${r.score}</span></li>`).join('')}</ol>`;
    view(head + `<section class="panel">${body}<p class="muted small">${note}${online() ? '' : ' Topplistan visar bara spelare på den här enheten.'}</p></section>`);
  }

  /* ---------- mitt konto ---------- */
  function showAccount() {
    view(`
<header class="subhead"><button class="link" data-g="hub">Tillbaka</button><h2>Mitt konto</h2></header>
<section class="panel">
  <p>Du är inloggad som <b>${esc(profile.name)}</b> (åk ${esc(profile.grade)}). Kontot gäller i alla spel på portalen.</p>
  <div class="actions"><button class="btn ghost" data-act="home">Logga ut</button></div>
</section>
${online() ? `<section class="panel">
  <h3>Byt lösenord</h3>
  <form id="pwform" class="newkid" autocomplete="off" style="border:0;padding:0">
    <div class="row">${pwField('opw', 'Nuvarande lösenord', 'current-password')}${pwField('npw', 'Nytt lösenord', 'new-password')}<button class="btn" type="submit">Byt</button></div>
    ${errBox()}
  </form>
</section>` : ''}
<section class="panel">
  <h3>Radera mig</h3>
  <p class="muted small">Tar bort ditt konto, dina poäng och allt du samlat i alla spel. Det går inte att ångra.</p>
  ${confirmDelete ? '<div class="actions"><button class="btn" style="background:var(--soft)" data-act="delyes">Ja, radera allt</button><button class="btn ghost" data-act="delno">Avbryt</button></div>' : '<button class="btn ghost" data-act="delask">Radera mig</button>'}
</section>`);
    const f = document.getElementById('pwform');
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault(); busyBtn(f, true);
      try { await store.changePassword(document.getElementById('opw').value, document.getElementById('npw').value); toast('Lösenordet är bytt.', 'good'); showAccount(); }
      catch (err) { showErr(window.KGPublicStore.message(err.code)); busyBtn(f, false); }
    });
  }

  /* ---------- händelser ---------- */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'home') { if (game) game.reset(); await store.logout(); profile = null; showStart('login'); }
    else if (act === 'start') showStart();
    else if (act === 'newform') showStart('new');
    else if (act === 'loginform') showStart('login');
    else if (act === 'skipclaim') { store.markMigrated(b.dataset.id); showStart('login'); }
    else if (act === 'board') showBoard();
    else if (act === 'btab') { boardKind = b.dataset.id; showBoard(); }
    else if (act === 'code') { confirmDelete = false; showAccount(); }
    else if (act === 'delask') { confirmDelete = true; showAccount(); }
    else if (act === 'delno') { confirmDelete = false; showAccount(); }
    else if (act === 'delyes') {
      try { if (game) game.reset(); await store.deletePlayer(); profile = null; toast('Allt är raderat.', 'good'); showStart('new'); }
      catch (err) { toast('Kunde inte radera just nu. Försök igen om en stund.', 'note'); }
    }
  });

  /* ---------- start ---------- */
  game = window.KGGame({
    store, view, toast, esc, richText, gemSVG, mossaSVG, shade, publicMode: true,
    openTest: () => {}, rerenderParent: () => {},
    onPoints: (p, n) => { p.pts = p.pts || { pending: 0, week: 0, total: 0, race: 0 }; p.pts.pending += n; },
    onAnswer: (q, ok, given) => {
      if (!online()) return;
      store.addAnswer({ area: q.area, skill: q.skill || '', level: q.level, ok, q: window.KGQ.plain(q.text), given: ok ? '' : String(given).slice(0, 40), correct: ok ? '' : window.KGQ.answerText(q) });
    },
  });
  store.onStatus = (s) => { if (s === 'offline') toast('Kunde inte nå servern. Spelet sparas på enheten så länge.', 'note'); };
  store.onLoggedOut = () => { if (game) game.reset(); profile = null; toast('Du har blivit utloggad. Logga in igen.', 'note'); showStart('login'); };
  const saved = online() ? store.savedSession() : null;
  if (saved && saved.token) play(saved, !!(function () { try { return localStorage.getItem('kristallgruvan.session'); } catch (e) { return null; } })());
  else showStart();
})();
