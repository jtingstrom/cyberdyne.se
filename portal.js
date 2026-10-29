/* =====================================================================
   CYBERDYNE SPEL – PORTALENS STARTSIDA
   Visar inloggningen, spelen i spel.json och en gemensam topplista.
   Nytt spel: lägg till ett block i spel.json, ingen kod behöver ändras.
   ===================================================================== */
(function () {
  'use strict';
  const K = window.CyberKonto;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id) => document.getElementById(id);
  let mode = 'login', boardKind = 'week', games = [];

  function toast(msg) {
    const t = $('toast'); t.className = 'toast show note'; t.textContent = msg;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast'; }, 3500);
  }
  function gemSVG(color, size) {
    const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 + f)).toString(16).padStart(2, '0')).join(''); };
    const G = ['..XXXX..', '.XHLLLX.', 'XHLLLLLX', 'XLLLLLDX', '.XLLLDX.', '..XLDX..', '...XX...'];
    const col = { X: '#0b0a10', H: '#ffffff', L: color, D: shade(color, -0.35) };
    let r = '';
    G.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch !== '.') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${col[ch]}"/>`; }));
    return `<svg width="${size}" height="${size * 7 / 8}" viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }

  /* ---------- inloggning ---------- */
  function renderAcct(s) {
    const box = $('acct');
    if (!K || !K.online) { box.innerHTML = '<p class="muted">Inloggning är inte inställd än (konto/config.js).</p>'; return; }
    if (s) {
      box.innerHTML = `<p>Inloggad som <b>${esc(s.name)}</b> (åk ${esc(s.grade)}). Du är inloggad i alla spel.</p><button class="btn ghost sm" id="logout">Logga ut</button>`;
      $('logout').onclick = async () => { await K.logout(); renderAcct(null); loadBoard(); };
      return;
    }
    const isNew = mode === 'new';
    box.innerHTML = `
      <form id="aform" autocomplete="${isNew ? 'off' : 'on'}">
        <label class="fld"><span>Smeknamn</span><input id="aname" maxlength="16" required autocomplete="username"></label>
        <label class="fld"><span>Lösenord</span><input id="apw" type="password" required minlength="4" maxlength="64" autocomplete="${isNew ? 'new-password' : 'current-password'}"></label>
        ${isNew ? `<label class="fld" style="flex:0 1 110px"><span>Årskurs</span><select id="agrade">${[3, 4, 5, 6].map((g) => `<option value="${g}"${g === 4 ? ' selected' : ''}>åk ${g}</option>`).join('')}</select></label>` : ''}
        <button class="btn" type="submit">${isNew ? 'Skapa konto' : 'Logga in'}</button>
      </form>
      <label class="check"><input type="checkbox" id="aremember"> Håll mig inloggad på den här enheten</label>
      <p id="aerr" class="small errtxt" hidden></p>
      <button class="link" id="aswitch">${isNew ? 'Har du redan ett konto? Logga in' : 'Ny här? Skapa ett konto'}</button>
      ${isNew ? '<p class="muted small" style="width:100%">Välj ett påhittat smeknamn, inte ditt riktiga namn. Smeknamnet syns på topplistorna.</p>' : ''}`;
    $('aswitch').onclick = () => { mode = isNew ? 'login' : 'new'; renderAcct(null); };
    $('aform').onsubmit = async (e) => {
      e.preventDefault();
      const err = $('aerr'), btn = e.target.querySelector('button'), name = $('aname').value.trim().replace(/\s+/g, ' ');
      const remember = $('aremember').checked;
      btn.disabled = true; err.hidden = true;
      try {
        let s;
        if (isNew) {
          const p = K.nameProblem(name); if (p) throw Object.assign(new Error(p), { text: p });
          s = await K.register(name, $('apw').value, Number($('agrade').value), remember);
        } else s = await K.login(name, $('apw').value, remember);
        renderAcct(s); loadBoard();
      } catch (x) { err.textContent = x.text || K.message(x.code); err.hidden = false; btn.disabled = false; }
    };
  }

  /* ---------- spel ---------- */
  function renderGames() {
    $('games').innerHTML = games.map((g) => {
      const soon = g.status !== 'klar';
      return `<article class="game${soon ? ' soon' : ''}">
        <div class="game-top">${gemSVG(g.farg || '#b58cff', 40)}<h2>${esc(g.namn)}</h2></div>
        <p>${esc(g.beskrivning)}</p>
        <div class="tags">${[g.amne, g.arskurs, g.topplista ? 'Topplista' : ''].filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        ${soon ? '<span class="btn ghost" aria-disabled="true">Kommer snart</span>' : `<a class="btn" href="${esc(g.adress)}">Spela</a>`}
      </article>`;
    }).join('') || '<p class="muted">Inga spel än.</p>';
  }

  /* ---------- gemensam topplista ---------- */
  async function loadBoard() {
    const box = $('board');
    if (!K || !K.online) { box.hidden = true; return; }
    const tabs = [['week', 'Veckans poäng'], ['total', 'All-time']];
    box.innerHTML = `<h2>Topplista, alla spel</h2>
      <div class="chips">${tabs.map(([id, n]) => `<button class="chip${boardKind === id ? ' on' : ''}" data-kind="${id}">${n}</button>`).join('')}</div>
      <div id="brows"><p class="muted">Hämtar…</p></div>`;
    box.querySelectorAll('[data-kind]').forEach((b) => { b.onclick = () => { boardKind = b.dataset.kind; loadBoard(); }; });
    const s = K.session();
    try {
      const rows = await K.rpc('get_leaderboard', { p_spel: 'alla', p_kind: boardKind, p_token: (s && s.token) || null });
      $('brows').innerHTML = rows && rows.length
        ? `<ol class="board">${rows.map((r) => `<li class="${r.r_me ? 'me' : ''}${r.r_rank <= 3 ? ' top' + r.r_rank : ''}"><span class="b-rank">${r.r_rank}</span><span class="b-name">${esc(r.r_name)}${r.r_me ? ' <small>(du)</small>' : ''}</span><span class="b-score">${r.r_score}</span></li>`).join('')}</ol>
           <p class="muted small">Summan av poängen i alla spel med topplista.${boardKind === 'week' ? ' Veckan nollställs varje måndag.' : ''}</p>`
        : '<p class="muted">Ingen har poäng här än. Bli först!</p>';
    } catch (e) { $('brows').innerHTML = '<p class="muted">Kunde inte hämta topplistan just nu.</p>'; }
  }

  /* ---------- start ---------- */
  (async function start() {
    try { games = await (await fetch('spel.json', { cache: 'no-cache' })).json(); } catch (e) { games = []; }
    renderGames();
    renderAcct(K && K.online ? K.session() : null);
    if (K && K.online && K.session()) renderAcct(await K.info());
    loadBoard();
  })();
})();
