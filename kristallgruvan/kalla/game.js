/* =====================================================================
   KRISTALLGRUVAN – SPELET (gränssnitt)
   Använder KGQ (uppgifter), KGEngine (regler) och ctx.store (lagring).
   ===================================================================== */
(function (root) {
  'use strict';
  const Q = root.KGQ, E = root.KGEngine;

  root.KGGame = function (ctx) {
    const { view, toast, esc, richText, gemSVG, mossaSVG, shade } = ctx;
    let kid = null, player = null, family = null, R = null, raceTimer = null, saveT = null, shopTab = 'block', buildSel = null, confirmBuy = null;
    const areaName = (id) => (Q.AREAS.find((a) => a.id === id) || {}).name || id;
    const areaGem = (id) => (Q.AREAS.find((a) => a.id === id) || {}).gem || '#ffffff';

    /* ---------- lagring ---------- */
    function save() { clearTimeout(saveT); saveT = null; return ctx.store.savePlayer(player).catch(() => {}); }
    function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 700); }
    async function loadFamily() {
      try { family = await ctx.store.getFamily(kid ? kid.familyId : 'familj-1'); } catch (e) { family = null; }
      if (!family) family = { id: kid ? kid.familyId : 'familj-1', rewards: [] };
      return family;
    }

    /* ---------- pixelgrafik ---------- */
    function grid2svg(rows, pal, vb) {
      let r = '';
      rows.forEach((row, y) => row.split('').forEach((ch, x) => { const c = pal[ch]; if (c) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; }));
      return r;
    }
    function rng(seed) { let a = seed; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
    function noise(seed, p1, p2) { const r = rng(seed); return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => { const v = r(); return v < p1 ? 'b' : v < p1 + p2 ? 'c' : 'a'; }).join('')); }
    const TILES = {
      jord: { rows: noise(11, 0.18, 0.14), pal: { a: '#7a5230', b: '#5e3e22', c: '#93683f' } },
      sten: { rows: noise(23, 0.2, 0.16), pal: { a: '#7d7a86', b: '#5f5c68', c: '#9a97a3' } },
      gras: { rows: ['gggggggg', 'gGgggGgg', 'agaagaga'].concat(noise(5, 0.18, 0.12).slice(3)), pal: { g: '#6cbf4a', G: '#93dd6a', a: '#7a5230', b: '#5e3e22', c: '#93683f' } },
      tra: { rows: ['aaaabaaa', 'aaaabaaa', 'aaaabaaa', 'dddddddd', 'abaaaaaa', 'abaaaaaa', 'abaaaaaa', 'dddddddd'], pal: { a: '#b07a43', b: '#7d5129', d: '#6b4422' } },
      tegel: { rows: ['aaamaaaa', 'aaamaaaa', 'aaamaaaa', 'mmmmmmmm', 'aaaaaama', 'aaaaaama', 'aaaaaama', 'mmmmmmmm'], pal: { a: '#b5523b', m: '#d9c7b0' } },
      glas: { rows: ['wwwwwwww', 'w.....sw', 'w....s.w', 'w...s..w', 'w..s...w', 'w......w', 'w......w', 'wwwwwwww'], pal: { w: '#cfeaff', s: '#ffffff', '.': 'rgba(207,234,255,.18)' } },
      vatten: { rows: ['aaaaaaaa', 'aallaaaa', 'aaaaaall', 'aaaaaaaa', 'aaaallaa', 'llaaaaaa', 'aaaaaaaa', 'aaallaaa'], pal: { a: '#3f7fd6', l: '#6fa6ef' } },
      fackla: { rows: ['........', '...yy...', '...oy...', '...bb...', '...bb...', '...bb...', '...bb...', '........'], pal: { y: '#ffd166', o: '#ff8a3a', b: '#7d5129' } },
      blomma: { rows: ['........', '..r.r...', '...y....', '..r.r...', '...g....', '..gg....', '...g....', '........'], pal: { r: '#ff6b8a', y: '#ffd166', g: '#6cbf4a' } },
      svamp: { rows: ['........', '..rrrr..', '.rwrrwr.', '.rrrrrr.', '...ww...', '...ww...', '..wwww..', '........'], pal: { r: '#e2443a', w: '#f3ead7' } },
      kista: { rows: ['........', '.kkkkkk.', '.bbbbbb.', '.kkyykk.', '.bbbbbb.', '.bbbbbb.', '.kkkkkk.', '........'], pal: { k: '#4a2f17', b: '#a26a35', y: '#ffd166' } },
      lampa: { rows: ['...kk...', '...kk...', '..pppp..', '.pPpppp.', '.ppppPp.', '..pppp..', '...kk...', '........'], pal: { k: '#3a3449', p: '#b58cff', P: '#efe4ff' } },
      guld: { rows: ['dddddddd', 'dallaaad', 'dlaaaaad', 'daaaaaad', 'daaaaaad', 'daaaaaLd', 'daaaaLLd', 'dddddddd'], pal: { a: '#f2c230', d: '#c99a12', l: '#fff1a8', L: '#e0ac1c' } },
      diamant: { rows: ['dddddddd', 'dallaaad', 'dlaaaaad', 'daaaaaad', 'daaaaaad', 'daaaaaLd', 'daaaaLLd', 'dddddddd'], pal: { a: '#5ee0e0', d: '#2aa5b5', l: '#d6ffff', L: '#3cc6d0' } },
    };
    const tileSVG = (id, size) => `<svg class="px" width="${size || 28}" height="${size || 28}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${grid2svg(TILES[id].rows, TILES[id].pal)}</svg>`;
    function creaturePal(c, stage, silhouette) {
      if (silhouette) return { K: '#0b0a10', B: '#2b2738', L: '#322e42', D: '#26222f', A: '#2b2738', W: '#2b2738', E: '#2b2738', P: '#2b2738', p: '#2b2738' };
      const base = areaGem(c.area);
      return { K: '#0b0a10', B: base, L: shade(base, 0.35), D: shade(base, -0.35), A: stage >= 3 ? '#ffd166' : shade(base, -0.2), W: '#ffffff', E: '#0b0a10', P: '#b58cff', p: '#efe4ff' };
    }
    function creatureSVG(c, stage, size, silhouette) {
      const g = E.creatureGrid(c.seed, silhouette ? 1 : stage);
      return `<svg class="px cr st${stage}" width="${size}" height="${size}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${grid2svg(g, creaturePal(c, stage, silhouette))}</svg>`;
    }
    const EGG = ['..kkkk..', '.kwwwwk.', 'kwwswwwk', 'kwwwwswk', 'kwswwwwk', 'kwwwwwwk', '.kwwswk.', '..kkkk..'];
    function eggSVG(size, cracked) {
      const rows = cracked ? EGG.map((r, y) => (y === 3 ? 'kwkwkwwk' : y === 4 ? 'kwskwkwk' : r)) : EGG;
      return `<svg class="px egg${cracked ? ' cracked' : ''}" width="${size}" height="${size}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${grid2svg(rows, { k: '#0b0a10', w: '#f3ead7', s: '#b58cff' })}</svg>`;
    }
    const MEDAL = ['..rrrr..', '...rr...', '..kkkk..', '.kyyyyk.', '.kyYyyk.', '.kyyyyk.', '..kkkk..', '........'];
    const medalSVG = (on, size) => `<svg class="px" width="${size}" height="${size}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${grid2svg(MEDAL, on ? { r: '#ff6b6b', k: '#0b0a10', y: '#ffd166', Y: '#fff1a8' } : { r: '#3a3449', k: '#0b0a10', y: '#2b2738', Y: '#322e42' })}</svg>`;
    const ICE = ['bbbbbbbb', 'bwwbbbbb', 'bwbbbbbb', 'bbbbbbbb', 'bbbbbwbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb'];
    const iceSVG = (size) => `<svg class="px" width="${size}" height="${size}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${grid2svg(ICE, { b: '#8fd3ff', w: '#ffffff' })}</svg>`;

    /* ---------- öppna ---------- */
    async function open(k, testSession) {
      kid = k;
      let p = null;
      try { p = await ctx.store.getPlayer(k.id); } catch (e) { if (e && e.code === 'not_logged_in') return; p = null; }
      if (!p) { p = E.newPlayer(k, testSession); player = p; await save(); }
      player = p;
      E.ensureToday(player);
      await loadFamily();
      showHub();
    }
    function reset() { stopRace(); if (saveT) save(); kid = null; player = null; R = null; }

    /* ---------- hem ---------- */
    function showHub() {
      stopRace(); R = null; buildSel = null; confirmBuy = null;
      E.ensureToday(player);
      const p = player, streak = E.streakAlive(p), today = E.dayKey();
      const goal = p.dailyGoalMin, mins = Math.floor(p.today.ms / 60000), reached = E.goalReached(p);
      const allOwned = E.owned(p) >= E.CREATURES.length, need = E.eggNeed(p);
      const bossDone = p.bossWeek === E.weekKey();
      const pending = p.requests.filter((r) => r.status === 'pending');
      view(`
<header class="hubtop">
  <div class="who">${mossaSVG(true, 'mid')}<div><p class="eyebrow">Kristallgruvan</p><h1>${esc(kid.name)}</h1></div></div>
  <div class="statrow">
    <span class="stat">${gemSVG('#b58cff', true, 26)}<b>${p.crystals}</b><small>kristaller</small></span>
    <span class="stat">${tileSVG('fackla', 26)}<b>${streak}</b><small>${streak === 1 ? 'dag' : 'dagar'} i rad</small></span>
    <span class="stat">${iceSVG(22)}<b>${p.streak.freezes}</b><small>frysblock</small></span>
    ${ctx.publicMode ? `<button class="stat statbtn" data-act="board">${tileSVG('diamant', 26)}<b>Topplista</b><small>se alla spelare</small></button>` : ''}
  </div>
</header>
<section class="panel dayrow">
  <div class="grow">
    ${goal ? `<p><b>Dagsmål:</b> ${Math.min(mins, goal)} av ${goal} minuter</p><div class="meter"><span style="width:${Math.min(100, (p.today.ms / (goal * 60000)) * 100)}%"></span></div>` : '<p><b>Idag:</b> ' + mins + ' minuter</p>'}
    <p class="muted small">${reached ? 'Dagsmålet är klart! Nu ger uppdragen halva kristaller. Kom tillbaka i morgon för full belöning.' : p.chestDay !== today ? 'Dagens kista väntar efter din första tur: +20 kristaller.' : 'Dagens kista är öppnad. Bra jobbat!'}</p>
  </div>
  <div class="chest${p.chestDay !== today ? ' ready' : ''}">${tileSVG('kista', 48)}</div>
</section>
<section class="panel eggrow">
  ${allOwned ? `<p>Du har samlat alla ${E.CREATURES.length} varelser!</p>` : `
  ${eggSVG(64, p.egg.progress >= need * 0.7)}
  <div class="grow"><p><b>Ägget kläcks om ${need - p.egg.progress} rätta svar</b></p><div class="meter egg-m"><span style="width:${(p.egg.progress / need) * 100}%"></span></div><p class="muted small">${E.owned(p)} av ${E.CREATURES.length} varelser hittade</p></div>`}
</section>
${pending.length ? `<section class="panel note"><p><b>Väntar på en vuxen:</b> ${pending.map((r) => esc(r.name)).join(', ')}</p></section>` : ''}
<section class="modes">
  <button class="mode main" data-g="go-tur"><span class="m-t">Gruvtur</span><span class="m-d">8 uppgifter · cirka 5 min</span></button>
  <button class="mode" data-g="go-race">${tileSVG('tra', 30)}<span class="m-t">Vagnrace</span><span class="m-d">60 sekunder tabeller${p.raceBest ? ` · rekord ${p.raceBest}` : ''}</span></button>
  <button class="mode${bossDone ? ' done' : ' hot'}" data-g="go-boss">${creatureSVG({ seed: 777, area: 'geo' }, 3, 30, false)}<span class="m-t">Veckoboss</span><span class="m-d">${bossDone ? 'Besegrad! Ny boss på måndag.' : '5 kluriga uppgifter · +60'}</span></button>
  <button class="mode" data-g="pick-area">${tileSVG('lampa', 30)}<span class="m-t">Träna ett område</span><span class="m-d">Välj själv vad du vill öva på</span></button>
  ${ctx.publicMode ? `<button class="mode" data-act="board">${tileSVG('diamant', 30)}<span class="m-t">Topplista</span><span class="m-d">Veckans poäng, vagnrace och all-time</span></button>` : ''}
</section>
<nav class="navgrid">
  <button class="nav" data-g="collection">${creatureSVG(E.CREATURES[0], 2, 34, E.owned(p) === 0)}<span>Samling</span><small>${E.owned(p)}/${E.CREATURES.length}</small></button>
  <button class="nav" data-g="base">${tileSVG('tegel', 34)}<span>Min bas</span><small>bygg</small></button>
  <button class="nav" data-g="shop">${tileSVG('guld', 34)}<span>Butik</span><small>handla</small></button>
  <button class="nav" data-g="medals">${medalSVG(true, 34)}<span>Medaljer</span><small>${Object.keys(p.medals).length}/${E.MEDALS.length}</small></button>
</nav>
<footer class="foot">
  <button class="link" data-act="home">${ctx.publicMode ? 'Logga ut' : 'Byt spelare'}</button>
  ${ctx.publicMode ? '<button class="link" data-act="code">Mitt konto</button>' : '<button class="link" data-g="test">Kartläggning</button>'}
</footer>`);
    }

    function showAreaPicker() {
      view(`
<header class="subhead"><button class="link" data-g="hub">Tillbaka</button><h2>Träna ett område</h2></header>
<section class="tunnels">
  ${Q.AREAS.filter((a) => !player.disabled.includes(a.id)).map((a) => `<button class="tunnel" data-g="go-area" data-id="${a.id}">${gemSVG(a.gem, true, 30)}<span class="t-name"><small>${esc(Q.LEVEL_LABELS[player.skills[a.id].level])}</small>${esc(a.name)}</span><span class="t-state">${player.focus.includes(a.id) ? 'Fokus' : 'Träna'}</span></button>`).join('')}
</section>`);
    }

    /* ---------- runda ---------- */
    function startRound(mode, areaId) {
      if (mode === 'boss' && player.bossWeek === E.weekKey()) { toast('Veckobossen är redan besegrad. En ny kommer på måndag!', 'note'); return; }
      R = { mode, areaId, qs: E.buildRound(player, mode, areaId), i: 0, results: [], earned: 0, combo: 0, levels: [], hatched: [], evolved: [], waiting: false };
      R.shownAt = Date.now();
      renderQ();
    }
    function roundTitle() { return R.mode === 'boss' ? 'Veckoboss' : R.mode === 'omrade' ? areaName(R.areaId) : 'Gruvtur'; }
    function renderQ(feedback) {
      const q = R.qs[R.i], n = R.qs.length;
      const dots = R.qs.map((_, i) => `<i class="${i < R.results.length ? (R.results[i] ? 'ok' : 'miss') : i === R.i ? 'now' : ''}"></i>`).join('');
      const bossHp = R.mode === 'boss' ? Math.max(0, 3 - R.results.filter(Boolean).length) : 0;
      let input;
      if (feedback) {
        input = `<div class="fb ${feedback.ok ? 'good' : 'soft'}"><p><b>${feedback.ok ? 'Rätt!' : 'Inte riktigt.'}</b> ${feedback.ok ? '' : `Rätt svar: <b>${richText(esc(Q.answerText(q)))}</b>`}</p><button class="btn" data-g="next" autofocus>Fortsätt</button></div>`;
      } else if (q.kind === 'choice') {
        input = `<div class="choices">${q.choices.map((c, i) => `<button class="btn choice" data-g="choice" data-i="${i}">${richText(c)}</button>`).join('')}</div>`;
      } else {
        const hint = q.kind === 'frac' ? 'Skriv bråk med snedstreck, t.ex. 3/4' : q.kind === 'time' ? 'Skriv som 14:05' : '';
        input = `<form id="gform" class="ansform" autocomplete="off"><label class="sr" for="gans">Ditt svar</label>
          <div class="ansrow"><input id="gans" ${q.kind === 'num' ? 'inputmode="decimal"' : 'inputmode="text"'} autocomplete="off" autocorrect="off" spellcheck="false" autofocus>${q.unit ? `<span class="unit">${esc(q.unit)}</span>` : ''}</div>
          ${hint ? `<p class="muted small">${hint}</p>` : ''}<button class="btn big" type="submit">Svara</button></form>`;
      }
      const isExpr = /^[\d−\-{0,(]/.test(q.text) && q.text.length < 40;
      view(`
<header class="qhead">
  <button class="link" data-g="quit">Avsluta</button>
  <span class="qarea">${esc(roundTitle())}</span>
  <span class="dots">${dots}</span>
  <span class="earned">${gemSVG('#b58cff', true, 18)} +${R.earned}</span>
</header>
${R.mode === 'boss' ? `<section class="bossbar">${creatureSVG({ seed: 777, area: 'geo' }, 3, 64)}<div><p class="eyebrow">Stenjätten</p><p class="hearts">${'<i class="on"></i>'.repeat(bossHp)}${'<i></i>'.repeat(3 - bossHp)}</p><p class="muted small">Klara 3 av 5 för att vinna</p></div></section>` : ''}
<section class="panel qcard">
  <p class="eyebrow">${esc(areaName(q.area))}${q.level > player.skills[q.area].level ? ' · utmaning' : ''}</p>
  <p class="qtext${isExpr ? ' expr' : ''}">${richText(q.text)}${isExpr && !/[?.]$/.test(Q.plain(q.text)) ? ' =' : ''}</p>
  ${q.fig || ''}
  ${input}
  ${feedback ? '' : '<button class="link dunno" data-g="dunno">Vet inte</button>'}
</section>`);
      const f = document.getElementById('gform');
      if (f) f.addEventListener('submit', (e) => { e.preventDefault(); const v = document.getElementById('gans').value; if (!v.trim()) { toast('Skriv ett svar eller tryck på Vet inte.', 'note'); return; } answer(v); });
    }
    function answer(raw, dunno) {
      if (!R || R.waiting) return;
      R.waiting = true;
      const q = R.qs[R.i];
      const ok = !dunno && Q.check(q, raw);
      R.combo = ok ? R.combo + 1 : 0;
      const ev = E.recordAnswer(player, q, ok, Date.now() - R.shownAt, { combo: R.combo });
      if (ok && ctx.onPoints) ctx.onPoints(player, q.level * 10 + (R.combo >= 3 ? 5 : 0));
      if (ctx.onAnswer) ctx.onAnswer(q, ok, dunno ? '(vet inte)' : q.kind === 'choice' ? Q.plain(q.choices[Number(raw)]) : String(raw).trim());
      R.results.push(ok); R.earned += ev.crystals;
      if (ev.levelChange) { R.levels.push(ev.levelChange); if (ev.levelChange.to > ev.levelChange.from) toast(`<b>Ny nivå!</b> ${esc(areaName(ev.levelChange.area))}: ${esc(Q.LEVEL_LABELS[ev.levelChange.to])}`, 'good'); }
      if (ev.hatched) R.hatched.push(ev.hatched);
      ev.evolved.forEach((x) => R.evolved.push(x));
      saveSoon();
      if (ok) {
        if (!ev.levelChange) toast(`<b>Rätt!</b> +${ev.crystals}${R.combo >= 3 ? ` · ${R.combo} i rad` : ''}`, 'good');
        setTimeout(() => { R.waiting = false; nextQ(); }, 850);
      } else { R.waiting = false; R.fb = true; renderQ({ ok: false }); }
    }
    function nextQ() {
      if (!R) return;
      R.fb = false; R.i++;
      if (R.i >= R.qs.length) return endRound();
      R.shownAt = Date.now(); renderQ();
    }
    function endRound() {
      const wins = R.results.filter(Boolean).length;
      let bossWin = false;
      if (R.mode === 'boss' && wins >= 3) { bossWin = true; player.bossWeek = E.weekKey(); player.stats.bossWins++; player.crystals += 60; R.earned += 60; if (ctx.onPoints) ctx.onPoints(player, 100); }
      const fin = E.finishRound(player, R.mode);
      save();
      showSummary({ title: R.mode === 'boss' ? (bossWin ? 'Stenjätten är besegrad!' : 'Stenjätten klarade sig den här gången') : 'Turen är klar!', line: `${wins} av ${R.qs.length} rätt`, earned: R.earned, fin, levels: R.levels, hatched: R.hatched, evolved: R.evolved, again: R.mode === 'boss' ? (bossWin ? null : 'go-boss') : R.mode === 'omrade' ? 'go-area' : 'go-tur', areaId: R.areaId, bossWin });
      R = null;
    }
    function showSummary(s) {
      const f = s.fin, items = [];
      items.push(`<li>${gemSVG('#b58cff', true, 20)} <b>+${s.earned}</b> kristaller från uppgifterna</li>`);
      if (f.bonus) items.push(`<li>${gemSVG('#7ccf5a', true, 20)} <b>+${f.bonus}</b> för att du gjorde klart</li>`);
      if (f.chest) items.push(`<li>${tileSVG('kista', 20)} <b>+${f.chest}</b> från dagens kista</li>`);
      if (f.streakUp) items.push(`<li>${tileSVG('fackla', 20)} <b>${player.streak.count}</b> ${player.streak.count === 1 ? 'dag' : 'dagar'} i rad${f.freezeUsed ? ` (ett frysblock räddade sviten)` : ''}</li>`);
      if (f.freezeEarned) items.push(`<li>${iceSVG(18)} Du fick ett frysblock för en hel vecka!</li>`);
      const ups = s.levels.filter((l) => l.to > l.from);
      view(`
<section class="panel found">
  <p class="eyebrow">${esc(s.line)}</p>
  <h2>${esc(s.title)}</h2>
  ${s.hatched.map((c) => `<div class="hatch">${creatureSVG(c, 1, 120)}<p class="eyebrow">Ett ägg kläcktes!</p><h3>${esc(c.name)}</h3><p class="muted small">${esc(areaName(c.area))}-varelse. Den växer när du tränar ${esc(areaName(c.area).toLowerCase())}.</p></div>`).join('')}
  ${s.evolved.map((x) => `<div class="hatch">${creatureSVG(x.creature, x.stage, 96)}<p><b>${esc(x.creature.name)}</b> utvecklades till steg ${x.stage}!</p></div>`).join('')}
  <ul class="gains">${items.join('')}</ul>
  ${ups.map((l) => `<p class="levelup">Ny nivå i ${esc(areaName(l.area))}: <b>${esc(Q.LEVEL_LABELS[l.to])}</b></p>`).join('')}
  ${f.medals.map((m) => `<div class="medalwin">${medalSVG(true, 40)}<div><p class="eyebrow">Ny medalj</p><p><b>${esc(m.name)}</b> · ${esc(m.desc)}</p></div></div>`).join('')}
  ${E.goalReached(player) ? '<p class="muted">Dagsmålet är klart! Du får spela vidare, men uppdragen ger halva kristaller resten av dagen.</p>' : ''}
  <div class="actions center-a">
    ${s.again ? `<button class="btn big" data-g="${s.again}" ${s.areaId ? `data-id="${s.areaId}"` : ''} autofocus>${s.again === 'go-boss' ? 'Försök igen' : 'En tur till'}</button>` : ''}
    <button class="btn ghost" data-g="hub">Hem</button>
  </div>
</section>`);
    }

    /* ---------- vagnrace ---------- */
    function stopRace() { if (raceTimer) { clearInterval(raceTimer); raceTimer = null; } }
    function startRace() {
      stopRace();
      R = { mode: 'race', end: Date.now() + 60000, count: 0, wrong: 0, avoid: new Set(), earned: 0, levels: [], hatched: [], evolved: [] };
      raceNext();
      raceTimer = setInterval(() => {
        const left = Math.max(0, R.end - Date.now());
        const bar = document.getElementById('racebar'); if (bar) bar.style.width = (left / 600) + '%';
        const t = document.getElementById('racet'); if (t) t.textContent = Math.ceil(left / 1000);
        if (left <= 0) endRace();
      }, 200);
    }
    function raceNext(prev) {
      R.q = E.raceQuestion(player, R.avoid); R.avoid.add(Q.plain(R.q.text)); R.shownAt = Date.now();
      view(`
<header class="qhead"><button class="link" data-g="quit">Avsluta</button><span class="qarea">Vagnrace</span><span class="earned"><b id="racet">${Math.ceil((R.end - Date.now()) / 1000)}</b> s</span></header>
<div class="track"><span id="racebar" style="width:${Math.max(0, R.end - Date.now()) / 600}%"></span></div>
<section class="panel qcard race">
  <p class="racecount">${tileSVG('tra', 22)} <b>${R.count}</b> rätt</p>
  <p class="qtext expr">${richText(R.q.text)} =</p>
  <form id="rform" class="ansform" autocomplete="off"><label class="sr" for="rans">Svar</label><div class="ansrow"><input id="rans" inputmode="numeric" autocomplete="off" autofocus></div></form>
  <p class="muted small">${prev ? esc(prev) : 'Tryck Enter efter varje svar.'}</p>
</section>`);
      document.getElementById('rform').addEventListener('submit', (e) => {
        e.preventDefault(); if (!R || R.mode !== 'race') return;
        const v = document.getElementById('rans').value; if (!v.trim()) return;
        const ok = Q.check(R.q, v);
        const ev = E.recordAnswer(player, R.q, ok, Date.now() - R.shownAt, { race: true });
        if (ok) { R.count++; R.earned += ev.crystals; if (ctx.onPoints) ctx.onPoints(player, 5); } else R.wrong++;
        if (ctx.onAnswer) ctx.onAnswer(R.q, ok, String(v).trim());
        if (ev.hatched) R.hatched.push(ev.hatched); ev.evolved.forEach((x) => R.evolved.push(x));
        if (ev.levelChange) R.levels.push(ev.levelChange);
        if (Date.now() >= R.end) return endRace();
        raceNext(ok ? 'Rätt!' : `${Q.plain(R.q.text)} = ${Q.answerText(R.q)}`);
      });
    }
    function endRace() {
      if (!R || R.mode !== 'race') return;
      stopRace();
      const rec = R.count > player.raceBest; if (rec) player.raceBest = R.count;
      if (ctx.onRace) ctx.onRace(player, R.count);
      const fin = E.finishRound(player, 'race');
      save();
      showSummary({ title: rec ? 'Nytt rekord!' : 'Racet är slut!', line: `${R.count} rätt på 60 sekunder`, earned: R.earned, fin, levels: R.levels, hatched: R.hatched, evolved: R.evolved, again: 'go-race' });
      R = null;
    }

    /* ---------- samling ---------- */
    function showCollection() {
      const p = player;
      view(`
<header class="subhead"><button class="link" data-g="hub">Tillbaka</button><h2>Samling</h2><span class="muted">${E.owned(p)} av ${E.CREATURES.length}</span></header>
<p class="muted">Varelserna växer när du tränar deras område. Steg 2 vid ${E.STAGE_XP[2]} rätta svar, steg 3 vid ${E.STAGE_XP[3]}.</p>
<section class="cards">
  ${E.CREATURES.map((c) => {
    const st = p.creatures[c.id];
    if (!st) return `<div class="card off">${creatureSVG(c, 1, 72, true)}<p class="c-name">???</p><p class="muted small">${esc(areaName(c.area))}</p></div>`;
    const next = st.stage < 3 ? E.STAGE_XP[st.stage + 1] : null;
    return `<div class="card">${creatureSVG(c, st.stage, 72)}<p class="c-name">${esc(c.name)}</p><p class="muted small">${esc(areaName(c.area))} · steg ${st.stage}</p>${next ? `<div class="meter thin"><span style="width:${(st.xp / next) * 100}%;background:${areaGem(c.area)}"></span></div><p class="muted tiny">${st.xp}/${next}</p>` : '<p class="tiny gold">Fullt utvecklad</p>'}</div>`;
  }).join('')}
</section>`);
    }

    /* ---------- bas ---------- */
    function baseSVG() {
      const b = player.base;
      const used = new Set(b.cells.filter(Boolean));
      let defs = '';
      used.forEach((it) => {
        if (it.startsWith('c:')) { const c = E.CREATURES.find((x) => x.id === it.slice(2)); const st = player.creatures[c.id]; if (c && st) defs += `<symbol id="s-${it.replace(':', '_')}" viewBox="0 0 12 12">${grid2svg(E.creatureGrid(c.seed, st.stage), creaturePal(c, st.stage))}</symbol>`; }
        else if (TILES[it]) defs += `<symbol id="s-${it}" viewBox="0 0 8 8">${grid2svg(TILES[it].rows, TILES[it].pal)}</symbol>`;
      });
      let cells = '';
      b.cells.forEach((it, i) => {
        const x = (i % b.w) * 8, y = Math.floor(i / b.w) * 8;
        cells += `<rect class="cell" x="${x}" y="${y}" width="8" height="8" data-g="cell" data-i="${i}"/>`;
        if (it) cells += `<use href="#s-${it.replace(':', '_')}" x="${x}" y="${y}" width="8" height="8" pointer-events="none"/>`;
      });
      return `<svg class="basesvg" viewBox="0 0 ${b.w * 8} ${b.h * 8}" shape-rendering="crispEdges" role="img" aria-label="Din bas"><defs>${defs}</defs>${cells}</svg>`;
    }
    function showBase() {
      const p = player, placed = new Set(p.base.cells.filter((c) => c && c.startsWith('c:')));
      const items = E.BLOCKS.filter((b) => p.inventory[b.id] > 0);
      const crs = E.CREATURES.filter((c) => p.creatures[c.id] && !placed.has('c:' + c.id));
      if (buildSel && buildSel !== 'hacka' && !(buildSel.startsWith('c:') ? crs.some((c) => 'c:' + c.id === buildSel) : p.inventory[buildSel] > 0)) buildSel = null;
      view(`
<header class="subhead"><button class="link" data-g="hub">Tillbaka</button><h2>Min bas</h2><span class="muted">${gemSVG('#b58cff', true, 18)} ${p.crystals}</span></header>
<section class="panel basewrap">
  <div class="basebox">${baseSVG()}</div>
  <p class="muted small">${buildSel === 'hacka' ? 'Hackan är vald. Tryck på något i basen för att plocka upp det.' : buildSel ? 'Tryck på en tom ruta för att placera.' : 'Välj ett block eller en varelse nedan och tryck sedan på en ruta.'}</p>
  <div class="hotbar">
    <button class="slot${buildSel === 'hacka' ? ' sel' : ''}" data-g="sel" data-id="hacka" aria-label="Hacka"><svg class="px" width="28" height="28" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${grid2svg(['.ssssss.', 's......s', '...bb...', '...bb...', '...bb...', '...bb...', '...bb...', '........'], { s: '#c9c6d2', b: '#7d5129' })}</svg><small>Hacka</small></button>
    ${items.map((b) => `<button class="slot${buildSel === b.id ? ' sel' : ''}" data-g="sel" data-id="${b.id}" aria-label="${esc(b.name)}">${tileSVG(b.id, 28)}<small>${p.inventory[b.id]}</small></button>`).join('')}
    ${crs.map((c) => `<button class="slot${buildSel === 'c:' + c.id ? ' sel' : ''}" data-g="sel" data-id="c:${c.id}" aria-label="${esc(c.name)}">${creatureSVG(c, p.creatures[c.id].stage, 28)}<small>${esc(c.name)}</small></button>`).join('')}
  </div>
  ${items.length ? '' : '<p class="muted small">Du har inga block kvar. Köp fler i butiken.</p>'}
  <button class="btn ghost" data-g="shop">Till butiken</button>
</section>`);
    }
    function clickCell(i) {
      if (!buildSel) { toast('Välj först ett block nedanför basen.', 'note'); return; }
      const ok = buildSel === 'hacka' ? E.pickUp(player, i) : E.place(player, i, buildSel);
      if (ok) { if (buildSel !== 'hacka') { const got = E.checkMedals(player); got.forEach((m) => toast(`<b>Ny medalj:</b> ${esc(m.name)}`, 'good')); } saveSoon(); showBase(); }
    }

    /* ---------- butik ---------- */
    function showShop() {
      const p = player;
      const tabs = [['block', 'Block'], ['extra', 'Extra']].concat(ctx.publicMode ? [] : [['riktiga', 'Riktiga belöningar']]);
      let body = '';
      if (shopTab === 'block') {
        body = `<div class="shoplist">${E.BLOCKS.map((b) => `<div class="shopitem">${tileSVG(b.id, 36)}<div class="grow"><p><b>${esc(b.name)}</b></p><p class="muted small">${b.cost} ${b.cost === 1 ? 'kristall' : 'kristaller'} styck · du har ${p.inventory[b.id] || 0}</p></div>
          <div class="buyrow">
            <button class="btn sm buy" data-g="buy" data-id="${b.id}" data-n="1" ${p.crystals < b.cost ? 'disabled' : ''} aria-label="Köp 1 ${esc(b.name)} för ${b.cost} kristaller">Köp 1<small>${gemSVG('#b58cff', true, 14)}${b.cost}</small></button>
            <button class="btn sm buy" data-g="buy" data-id="${b.id}" data-n="5" ${p.crystals < b.cost * 5 ? 'disabled' : ''} aria-label="Köp 5 ${esc(b.name)} för ${b.cost * 5} kristaller">Köp 5<small>${gemSVG('#b58cff', true, 14)}${b.cost * 5}</small></button>
          </div></div>`).join('')}</div>`;
      } else if (shopTab === 'extra') {
        body = `<div class="shoplist">
          <div class="shopitem">${iceSVG(36)}<div class="grow"><p><b>Frysblock</b></p><p class="muted small">Skyddar din svit en dag du inte hinner spela. Du har ${p.streak.freezes} av ${E.MAX_FREEZES}.</p></div><button class="btn sm" data-g="buyfreeze" ${p.crystals < E.FREEZE_COST || p.streak.freezes >= E.MAX_FREEZES ? 'disabled' : ''}>${E.FREEZE_COST}</button></div>
          <div class="shopitem">${tileSVG('sten', 36)}<div class="grow"><p><b>Större bas</b></p><p class="muted small">Två kolumner till. Basen är ${p.base.w} rutor bred (max ${E.MAX_W}).</p></div><button class="btn sm" data-g="expand" ${p.crystals < E.EXPAND_COST || p.base.w >= E.MAX_W ? 'disabled' : ''}>${E.EXPAND_COST}</button></div>
        </div>`;
      } else {
        const rw = (family && family.rewards) || [];
        const reqs = p.requests.slice().reverse().slice(0, 8);
        body = rw.length ? `<div class="shoplist">${rw.map((r) => `<div class="shopitem">${tileSVG('kista', 36)}<div class="grow"><p><b>${esc(r.name)}</b></p><p class="muted small">${r.cost} kristaller</p></div>
          ${confirmBuy === r.id ? `<button class="btn sm" data-g="realbuy" data-id="${esc(r.id)}">Köp</button><button class="btn sm ghost" data-g="realno">Avbryt</button>` : `<button class="btn sm" data-g="realask" data-id="${esc(r.id)}" ${p.crystals < r.cost ? 'disabled' : ''}>${r.cost}</button>`}</div>`).join('')}</div>`
          : '<p class="muted">Här kan en vuxen lägga in riktiga belöningar, till exempel extra skärmtid eller att välja middag.</p>';
        if (reqs.length) body += `<h3>Dina köp</h3><ul class="reqs">${reqs.map((r) => `<li>${esc(r.name)} <span class="pill ${r.status === 'given' ? 'good' : r.status === 'pending' ? 'mid' : 'none'}">${r.status === 'given' ? 'fått' : r.status === 'pending' ? 'väntar på vuxen' : 'nekad, kristaller tillbaka'}</span></li>`).join('')}</ul>`;
      }
      view(`
<header class="subhead"><button class="link" data-g="hub">Tillbaka</button><h2>Butik</h2><span class="stat inline">${gemSVG('#b58cff', true, 22)}<b>${p.crystals}</b></span></header>
<div class="chips">${tabs.map(([id, n]) => `<button class="chip${shopTab === id ? ' on' : ''}" data-g="tab" data-id="${id}">${n}</button>`).join('')}</div>
<section class="panel">${body}</section>`);
    }

    /* ---------- medaljer ---------- */
    function showMedals() {
      view(`
<header class="subhead"><button class="link" data-g="hub">Tillbaka</button><h2>Medaljer</h2><span class="muted">${Object.keys(player.medals).length} av ${E.MEDALS.length}</span></header>
<section class="cards">${E.MEDALS.map((m) => `<div class="card${player.medals[m.id] ? '' : ' off'}">${medalSVG(!!player.medals[m.id], 48)}<p class="c-name">${esc(m.name)}</p><p class="muted small">${esc(m.desc)}</p></div>`).join('')}</section>`);
    }

    /* ---------- föräldradel ---------- */
    let pPlayer = null, pKid = null;
    async function parentSection(k) {
      pKid = k;
      try { pPlayer = await ctx.store.getPlayer(k.id); } catch (e) { pPlayer = null; }
      const fam = (await ctx.store.getFamily(k.familyId).catch(() => null)) || { id: k.familyId, rewards: [] };
      family = fam;
      const rewardsHtml = `
  <h3>Riktiga belöningar</h3>
  <p class="muted small">Gäller alla barn i familjen. Barnet köper med kristaller, och du bekräftar här när belöningen är given.</p>
  ${fam.rewards.length ? `<ul class="rlist">${fam.rewards.map((r) => `<li><span>${esc(r.name)}</span><span class="muted">${r.cost} kristaller</span><button class="link" data-g="p-delrew" data-id="${esc(r.id)}">Ta bort</button></li>`).join('')}</ul>` : '<p class="muted">Inga belöningar än.</p>'}
  <form id="rewform" class="row" autocomplete="off">
    <label class="fld"><span>Belöning</span><input id="rname" maxlength="40" required placeholder="t.ex. 30 min extra skärmtid"></label>
    <label class="fld" style="flex:0 1 120px"><span>Kristaller</span><input id="rcost" type="number" min="1" max="5000" required value="150"></label>
    <button class="btn" type="submit">Lägg till</button>
  </form>
  <p class="muted small">Riktmärke: en gruvtur ger ungefär 25–35 kristaller, och 20 minuter om dagen ger cirka 100–150.</p>`;
      if (!pPlayer) return `<section class="panel"><h2>Spelet</h2><p class="muted">${esc(k.name)} kommer till spelet när kartläggningen är klar.</p>${rewardsHtml}</section>`;
      const p = pPlayer; E.ensureToday(p);
      const pending = p.requests.filter((r) => r.status === 'pending');
      return `
<section class="panel">
  <h2>Spelet</h2>
  <div class="sumgrid">
    <div><p class="eyebrow">Kristaller</p><p class="big-v">${p.crystals}</p></div>
    <div><p class="eyebrow">Rätta svar</p><p class="big-v">${p.totalCorrect} <small>av ${p.totalAnswered}</small></p></div>
    <div><p class="eyebrow">Svit</p><p class="big-v">${E.streakAlive(p)} <small>dagar</small></p></div>
    <div><p class="eyebrow">Idag</p><p class="big-v">${Math.round(p.today.ms / 60000)} <small>min</small></p></div>
    <div><p class="eyebrow">Varelser</p><p class="big-v">${E.owned(p)} <small>av ${E.CREATURES.length}</small></p></div>
  </div>
  ${pending.length ? `<h3>Väntar på dig</h3><ul class="rlist">${pending.map((r) => `<li><span><b>${esc(r.name)}</b> <span class="muted small">${r.cost} kristaller · ${new Date(r.at).toLocaleDateString('sv-SE')}</span></span><button class="btn sm" data-g="p-approve" data-id="${esc(r.id)}">Given</button><button class="btn sm ghost" data-g="p-decline" data-id="${esc(r.id)}">Neka</button></li>`).join('')}</ul>` : ''}
</section>
<section class="panel">
  <h2>Nivåer i spelet</h2>
  <p class="muted small">Nivån går upp automatiskt vid 8 rätt av de 10 senaste svaren på nivån och ner om det går tungt. Du kan ändra själv. <b>Fokus</b> gör att området kommer tre gånger oftare.</p>
  <div class="tablewrap"><table class="lv">
    <thead><tr><th>Område</th><th>Nivå</th><th class="num">Senaste</th><th>Fokus</th><th>Med</th></tr></thead>
    <tbody>${Q.AREAS.map((a) => { const s = p.skills[a.id], sum = s.recent.reduce((x, y) => x + y, 0); return `<tr><td>${esc(a.name)}</td>
      <td class="lvcell"><button class="btn sm ghost" data-g="p-lv" data-id="${a.id}" data-d="-1" ${s.level <= 1 ? 'disabled' : ''} aria-label="Sänk">−</button><span>${esc(Q.LEVEL_LABELS[s.level])}</span><button class="btn sm ghost" data-g="p-lv" data-id="${a.id}" data-d="1" ${s.level >= E.MAX ? 'disabled' : ''} aria-label="Höj">+</button></td>
      <td class="num">${s.recent.length ? `${sum}/${s.recent.length}` : '–'}</td>
      <td><input type="checkbox" data-g="p-focus" data-id="${a.id}" ${p.focus.includes(a.id) ? 'checked' : ''} aria-label="Fokus ${esc(a.name)}"></td>
      <td><input type="checkbox" data-g="p-on" data-id="${a.id}" ${p.disabled.includes(a.id) ? '' : 'checked'} aria-label="Med ${esc(a.name)}"></td></tr>`; }).join('')}</tbody>
  </table></div>
  <div class="row">
    <label class="fld inline"><span>Dagsmål</span><select data-g="p-goal">${[[0, 'Ingen gräns'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min']].map(([v, n]) => `<option value="${v}" ${p.dailyGoalMin === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <button class="btn ghost" data-g="p-fromtest">Hämta nivåer från senaste kartläggningen</button>
  </div>
</section>
<section class="panel">${rewardsHtml}</section>`;
    }
    function bindParent() {
      const f = document.getElementById('rewform');
      if (f) f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('rname').value.trim(), cost = Math.max(1, Math.round(Number(document.getElementById('rcost').value) || 0));
        if (!name) return;
        family.rewards.push({ id: 'rw' + Date.now().toString(36), name, cost });
        await ctx.store.saveFamily(family).catch(() => {});
        ctx.rerenderParent();
      });
    }
    async function savePP() { await ctx.store.savePlayer(pPlayer).catch(() => {}); ctx.rerenderParent(); }

    /* ---------- händelser ---------- */
    document.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-g]'); if (!b || b.disabled) return;
      const g = b.dataset.g, id = b.dataset.id;
      if (g === 'cell') return clickCell(Number(b.dataset.i));
      if (g.startsWith('p-') && pPlayer === null && !['p-delrew'].includes(g)) return;
      switch (g) {
        case 'hub': return showHub();
        case 'go-tur': return startRound('tur');
        case 'go-area': return startRound('omrade', id);
        case 'go-boss': return startRound('boss');
        case 'go-race': return startRace();
        case 'pick-area': return showAreaPicker();
        case 'choice': return answer(b.dataset.i);
        case 'dunno': return answer('', true);
        case 'next': return nextQ();
        case 'quit': stopRace(); if (saveT) save(); R = null; return showHub();
        case 'collection': return showCollection();
        case 'base': return showBase();
        case 'shop': return showShop();
        case 'medals': return showMedals();
        case 'test': if (saveT) save(); return ctx.openTest(kid);
        case 'sel': buildSel = buildSel === id ? null : id; return showBase();
        case 'tab': shopTab = id; confirmBuy = null; return showShop();
        case 'buy': if (E.buyBlock(player, id, Number(b.dataset.n))) { saveSoon(); toast('Köpt!', 'good'); } return showShop();
        case 'buyfreeze': if (E.buyFreeze(player)) { saveSoon(); toast('Frysblock köpt', 'good'); } return showShop();
        case 'expand': if (E.expandBase(player)) { saveSoon(); toast('Basen blev större!', 'good'); } return showShop();
        case 'realask': confirmBuy = id; return showShop();
        case 'realno': confirmBuy = null; return showShop();
        case 'realbuy': {
          const rw = family.rewards.find((r) => r.id === id); confirmBuy = null;
          if (rw && E.buyReward(player, rw)) { await save(); toast('Köpt! Nu väntar det på en vuxen.', 'good'); }
          return showShop();
        }
        case 'p-approve': E.resolveRequest(pPlayer, id, true); return savePP();
        case 'p-decline': E.resolveRequest(pPlayer, id, false); return savePP();
        case 'p-lv': { const s = pPlayer.skills[id]; s.level = Math.max(1, Math.min(E.MAX, s.level + Number(b.dataset.d))); s.recent = []; return savePP(); }
        case 'p-fromtest': {
          const ss = await ctx.store.listSessions(pKid.id); const fin = ss.find((s) => s.finishedAt);
          if (!fin) { toast('Ingen klar kartläggning hittades.', 'note'); return; }
          E.applyTest(pPlayer, fin); toast('Nivåerna är uppdaterade.', 'good'); return savePP();
        }
        case 'p-delrew': family.rewards = family.rewards.filter((r) => r.id !== id); await ctx.store.saveFamily(family).catch(() => {}); return ctx.rerenderParent();
      }
    });
    document.addEventListener('change', (e) => {
      const b = e.target.closest('[data-g]'); if (!b || !pPlayer) return;
      const g = b.dataset.g, id = b.dataset.id;
      if (g === 'p-focus') { pPlayer.focus = b.checked ? pPlayer.focus.concat(id) : pPlayer.focus.filter((x) => x !== id); savePP(); }
      else if (g === 'p-on') { pPlayer.disabled = b.checked ? pPlayer.disabled.filter((x) => x !== id) : pPlayer.disabled.concat(id); savePP(); }
      else if (g === 'p-goal') { pPlayer.dailyGoalMin = Number(b.value); savePP(); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && saveT) save(); });

    return { open, reset, parentSection, bindParent, eggSVG, creatureSVG, showHub, getPlayer: () => player };
  };
})(typeof window !== 'undefined' ? window : globalThis);
