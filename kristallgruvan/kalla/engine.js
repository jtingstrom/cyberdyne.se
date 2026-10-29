/* =====================================================================
   KRISTALLGRUVAN – SPELMOTOR (ren logik, inget DOM, ingen lagring)
   Spelardokument (schema 'kristallgruvan-spel/1'):
   { kidId, familyId, crystals, totalCorrect, totalAnswered,
     skills: { [area]: { level, recent: [0|1] } }, focus: [area], disabled: [area],
     dailyGoalMin, egg: { progress }, creatures: { [id]: { xp, stage, at } },
     inventory: { [blockId]: n }, base: { w, h, cells: [''|blockId|'c:'+creatureId] },
     streak: { count, last, freezes }, chestDay, bossWeek, raceBest,
     medals: { [id]: isoDate }, today: { day, ms, rounds },
     requests: [{ id, rewardId, name, cost, at, status }], stats: {...} }
   ===================================================================== */
(function (root) {
  'use strict';
  const Q = root.KGQ;
  const MAX = 6;
  const AREA_IDS = Q.AREAS.map((a) => a.id);
  const rnd = Math.random;

  /* ---------- datum ---------- */
  const z = (n) => String(n).padStart(2, '0');
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5); }
  function weekKey(d) {
    d = d ? new Date(d) : new Date();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-v' + z(Math.ceil(((t - y0) / 864e5 + 1) / 7));
  }

  /* ---------- varelser (egna, påhittade) ---------- */
  const CREATURE_NAMES = {
    tal: ['Siffrik', 'Nollo', 'Miljonix'], addsub: ['Plusse', 'Minuset', 'Växlo'], tabell: ['Tabbe', 'Gångis', 'Rutan'],
    muldiv: ['Delbert', 'Multo', 'Kvotis'], brak: ['Bråkis', 'Halvan', 'Nämnis'], dec: ['Decimo', 'Kommis', 'Procentina'],
    geo: ['Vinkla', 'Kuben', 'Pyra'], mat: ['Metra', 'Klockis', 'Litro'], alg: ['Mönstra', 'Ekvo', 'Gåtan'],
    stat: ['Staplo', 'Medelix', 'Tärnis'], prob: ['Klurix', 'Ledtråd', 'Lösaren'],
  };
  const CREATURES = [];
  AREA_IDS.forEach((area, ai) => CREATURE_NAMES[area].forEach((name, k) => CREATURES.push({ id: area + '-' + k, name, area, seed: ai * 31 + k * 7 + 3 })));
  const STAGE_XP = [0, 0, 20, 60]; // steg 2 vid 20 xp, steg 3 vid 60

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // 12x12 rutnät. K kontur, B kropp, L ljus, D mörk, A fläckar, W/E ögon, P kristall
  function creatureGrid(seed, stage) {
    const r = mulberry32(seed * 9973 + 17), W = 12, H = 12;
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    for (let y = 2; y <= 10; y++) for (let x = 0; x < 6; x++) {
      const dx = (5.5 - x) / 5, dy = (y - 6.5) / 4.3, e = dx * dx + dy * dy;
      if (e < 0.72 || (e < 1.05 && r() < 0.5)) { g[y][x] = 'B'; g[y][W - 1 - x] = 'B'; }
    }
    for (let y = 2; y <= 10; y++) { const l = g[y].indexOf('B'); if (l >= 0) for (let x = l; x < W - l; x++) g[y][x] = 'B'; } // inga hål
    for (let y = 4; y <= 8; y++) for (let x = 3; x <= 8; x++) g[y][x] = 'B';
    if (r() < 0.6) { const ex = 1 + Math.floor(r() * 3); g[1][ex] = g[2][ex] = 'B'; g[1][W - 1 - ex] = g[2][W - 1 - ex] = 'B'; } // öron
    g[11][3] = g[11][8] = 'D'; if (r() < 0.5) { g[11][4] = g[11][7] = 'D'; }
    const r2 = mulberry32(seed * 7 + 5);
    for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) {
      if (g[y][x] !== 'B') continue;
      if (y > 0 && g[y - 1][x] === '.') g[y][x] = g[y][W - 1 - x] = 'L';
      else if (y < H - 1 && (g[y + 1][x] === '.' || g[y + 1][x] === 'D')) g[y][x] = g[y][W - 1 - x] = 'D';
      else if (stage >= 2 && r2() < 0.22 && !(y >= 5 && y <= 6)) g[y][x] = g[y][W - 1 - x] = 'A';
    }
    const ey = 5, ex = r() < 0.5 ? 3 : 4;
    g[ey][ex] = g[ey][W - 1 - ex] = 'W'; g[ey + 1][ex] = g[ey + 1][W - 1 - ex] = 'E';
    if (r() < 0.6) { g[8][5] = g[8][6] = 'E'; }
    if (stage >= 3) { g[0][5] = g[0][6] = 'P'; g[1][5] = g[1][6] = 'P'; if (g[0][4] === '.') g[0][4] = 'p'; if (g[0][7] === '.') g[0][7] = 'p'; }
    const out = g.map((row) => row.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== '.') continue;
      const n = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([a, b]) => { const c = g[y + a] && g[y + a][x + b]; return c && c !== '.' && c !== 'p' && c !== 'P'; });
      if (n) out[y][x] = 'K';
    }
    return out.map((row) => row.join(''));
  }

  /* ---------- byggblock ---------- */
  const BLOCKS = [
    { id: 'jord', name: 'Jord', cost: 1 }, { id: 'sten', name: 'Sten', cost: 1 }, { id: 'gras', name: 'Gräs', cost: 2 },
    { id: 'tra', name: 'Plankor', cost: 2 }, { id: 'tegel', name: 'Tegel', cost: 3 }, { id: 'glas', name: 'Glas', cost: 4 },
    { id: 'fackla', name: 'Fackla', cost: 5 }, { id: 'blomma', name: 'Blomma', cost: 5 }, { id: 'vatten', name: 'Vatten', cost: 6 },
    { id: 'svamp', name: 'Svamp', cost: 6 }, { id: 'kista', name: 'Kista', cost: 12 }, { id: 'lampa', name: 'Kristallampa', cost: 15 },
    { id: 'guld', name: 'Guldblock', cost: 30 }, { id: 'diamant', name: 'Diamantblock', cost: 50 },
  ];
  const FREEZE_COST = 40, MAX_FREEZES = 2, EXPAND_COST = 120, MAX_W = 16;

  /* ---------- medaljer ---------- */
  const owned = (p) => Object.keys(p.creatures || {}).length;
  const MEDALS = [
    { id: 'forsta', name: 'Första turen', desc: 'Gör din första gruvtur', test: (p) => p.stats.rounds >= 1 },
    { id: 'rätt100', name: 'Hundra rätt', desc: '100 rätta svar', test: (p) => p.totalCorrect >= 100 },
    { id: 'rätt500', name: 'Femhundra rätt', desc: '500 rätta svar', test: (p) => p.totalCorrect >= 500 },
    { id: 'rätt1000', name: 'Tusen rätt', desc: '1 000 rätta svar', test: (p) => p.totalCorrect >= 1000 },
    { id: 'svit3', name: 'Tre dagar', desc: 'Spela 3 dagar i rad', test: (p) => p.streak.count >= 3 },
    { id: 'svit7', name: 'En hel vecka', desc: 'Spela 7 dagar i rad', test: (p) => p.streak.count >= 7 },
    { id: 'svit30', name: 'Gruvveteran', desc: 'Spela 30 dagar i rad', test: (p) => p.streak.count >= 30 },
    { id: 'varelse1', name: 'Första varelsen', desc: 'Kläck ett ägg', test: (p) => owned(p) >= 1 },
    { id: 'varelse10', name: 'Samlare', desc: 'Samla 10 varelser', test: (p) => owned(p) >= 10 },
    { id: 'varelseAlla', name: 'Mästersamlare', desc: `Samla alla ${CREATURES.length} varelser`, test: (p) => owned(p) >= CREATURES.length },
    { id: 'utveckla', name: 'Utveckling!', desc: 'Utveckla en varelse till steg 3', test: (p) => Object.values(p.creatures).some((c) => c.stage >= 3) },
    { id: 'niva', name: 'Ny nivå', desc: 'Gå upp en nivå i något område', test: (p) => p.stats.levelUps >= 1 },
    { id: 'topp', name: 'Toppnivå', desc: 'Nå högsta nivån (åk 7–8) i ett område', test: (p) => AREA_IDS.some((a) => p.skills[a].level >= MAX) },
    { id: 'boss', name: 'Bossbesegrare', desc: 'Besegra veckobossen', test: (p) => p.stats.bossWins >= 1 },
    { id: 'race20', name: 'Rälsraket', desc: '20 rätt i ett vagnrace', test: (p) => p.raceBest >= 20 },
    { id: 'bygg50', name: 'Byggmästare', desc: 'Placera 50 block i basen', test: (p) => p.stats.placed >= 50 },
  ];

  /* ---------- ny spelare ---------- */
  function newPlayer(kid, testSession) {
    const skills = {};
    const testLv = {};
    AREA_IDS.forEach((a) => {
      const r = testSession && testSession.areas[a] && testSession.areas[a].result;
      testLv[a] = r ? r.level : null;
      skills[a] = { level: Math.max(1, Math.min(MAX, r ? r.level : Q.startLevel(kid.grade))), recent: [] };
    });
    // fokus: de svagaste områdena i kartläggningen (högst två)
    let focus = [];
    if (testSession) {
      const min = Math.min(...AREA_IDS.map((a) => (testLv[a] === null ? 99 : testLv[a])));
      focus = AREA_IDS.filter((a) => testLv[a] === min).slice(0, 2);
    }
    return {
      kidId: kid.id, familyId: kid.familyId, schema: 'kristallgruvan-spel/1', createdAt: new Date().toISOString(),
      crystals: 0, totalCorrect: 0, totalAnswered: 0, skills, focus, disabled: [], dailyGoalMin: 20,
      egg: { progress: 0 }, creatures: {}, inventory: { jord: 6, sten: 6, gras: 4 },
      base: { w: 10, h: 7, cells: Array(70).fill('') },
      streak: { count: 0, last: null, freezes: 1 }, chestDay: null, bossWeek: null, raceBest: 0,
      medals: {}, today: { day: dayKey(), ms: 0, rounds: 0 }, requests: [],
      stats: { rounds: 0, levelUps: 0, placed: 0, bossWins: 0 },
    };
  }
  function applyTest(p, testSession) {
    AREA_IDS.forEach((a) => { const r = testSession.areas[a] && testSession.areas[a].result; if (r) p.skills[a] = { level: Math.max(1, Math.min(MAX, r.level)), recent: [] }; });
  }

  function ensureToday(p) { const d = dayKey(); if (!p.today || p.today.day !== d) p.today = { day: d, ms: 0, rounds: 0 }; }
  function goalReached(p) { ensureToday(p); return !!p.dailyGoalMin && p.today.ms >= p.dailyGoalMin * 60000; }
  const mult = (p) => (goalReached(p) ? 0.5 : 1);

  /* ---------- val av uppgifter ---------- */
  function enabledAreas(p) { const e = AREA_IDS.filter((a) => !p.disabled.includes(a)); return e.length ? e : AREA_IDS.slice(); }
  function pickArea(p, counts) {
    const pool = enabledAreas(p).filter((a) => (counts[a] || 0) < 2);
    const list = pool.length ? pool : enabledAreas(p);
    const w = list.map((a) => (p.focus.includes(a) ? 3 : 1));
    let t = rnd() * w.reduce((x, y) => x + y, 0);
    for (let i = 0; i < list.length; i++) { t -= w[i]; if (t <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function pickLevel(s) {
    const r = rnd();
    if (r < 0.1 && s.level < MAX) return s.level + 1; // utmaning
    if (r < 0.3 && s.level > 1) return s.level - 1;   // repetition
    return s.level;
  }
  // mode: 'tur' (8 blandade), 'omrade' (8 i ett område), 'boss' (5 svåra)
  function buildRound(p, mode, areaId) {
    const avoid = new Set(), counts = {}, qs = [];
    const n = mode === 'boss' ? 5 : 8;
    for (let i = 0; i < n; i++) {
      let area, level;
      if (mode === 'omrade') { area = areaId; level = pickLevel(p.skills[area]); }
      else if (mode === 'boss') { area = ['prob', 'alg', 'geo', 'prob', 'stat'][i]; if (p.disabled.includes(area)) area = 'prob'; level = Math.min(MAX, p.skills[area].level + 1); }
      else { area = pickArea(p, counts); level = pickLevel(p.skills[area]); }
      counts[area] = (counts[area] || 0) + 1;
      const q = Q.generate(area, level, avoid); avoid.add(Q.plain(q.text));
      qs.push(q);
    }
    return qs;
  }
  function raceQuestion(p, avoid) {
    const s = p.skills.tabell;
    const area = s.level >= 5 && rnd() < 0.4 ? 'muldiv' : 'tabell';
    const level = area === 'tabell' ? Math.min(s.level, 6) : Math.min(p.skills.muldiv.level, 3);
    return Q.generate(area, Math.max(1, level), avoid);
  }

  /* ---------- registrera ett svar ---------- */
  // returnerar { crystals, levelChange: {area, from, to}|null, hatched: creature|null, evolved: [..] }
  function recordAnswer(p, q, ok, ms, ctx) {
    ensureToday(p);
    ctx = ctx || {};
    const ev = { crystals: 0, levelChange: null, hatched: null, evolved: [] };
    p.totalAnswered++; p.today.ms += Math.min(ms || 0, 180000);
    const s = p.skills[q.area];
    const before = s.level;
    if (q.level === s.level) {
      s.recent.push(ok ? 1 : 0); if (s.recent.length > 10) s.recent.shift();
      const sum = s.recent.reduce((a, b) => a + b, 0);
      const last5 = s.recent.slice(-5).reduce((a, b) => a + b, 0);
      if (s.recent.length >= 8 && sum >= Math.ceil(s.recent.length * 0.8) && s.level < MAX) { ev.levelChange = { area: q.area, from: s.level, to: s.level + 1 }; s.level++; s.recent = []; p.stats.levelUps++; }
      else if (s.recent.length >= 5 && last5 <= 1 && s.level > 1) { ev.levelChange = { area: q.area, from: s.level, to: s.level - 1 }; s.level--; s.recent = []; }
    } else if (q.level > s.level && ok) {
      // klarad utmaning räknas som två rätt på nuvarande nivå
      s.recent.push(1, 1); while (s.recent.length > 10) s.recent.shift();
    }
    if (!ok) return ev;
    p.totalCorrect++;
    let c = ctx.race ? 1 : 3;
    if (!ctx.race && q.level > before) c += 2;
    if (!ctx.race && ctx.combo >= 3) c += 1;
    ev.crystals = Math.max(1, Math.round(c * mult(p)));
    p.crystals += ev.crystals;
    // ägg
    if (owned(p) < CREATURES.length) {
      p.egg.progress++;
      if (p.egg.progress >= eggNeed(p)) {
        const free = CREATURES.filter((c) => !p.creatures[c.id]);
        const cr = free[Math.floor(rnd() * free.length)];
        p.creatures[cr.id] = { xp: 0, stage: 1, at: new Date().toISOString() };
        p.egg.progress = 0; ev.hatched = cr;
      }
    }
    // varelser i samma område får xp
    CREATURES.filter((c) => c.area === q.area && p.creatures[c.id]).forEach((c) => {
      const st = p.creatures[c.id]; st.xp++;
      const ns = st.xp >= STAGE_XP[3] ? 3 : st.xp >= STAGE_XP[2] ? 2 : 1;
      if (ns > st.stage) { st.stage = ns; ev.evolved.push({ creature: c, stage: ns }); }
    });
    return ev;
  }
  function eggNeed(p) { return Math.min(40, 10 + 2 * owned(p)); }

  /* ---------- slut på runda ---------- */
  function finishRound(p, kind) {
    ensureToday(p);
    const ev = { bonus: 0, chest: 0, streakUp: false, freezeUsed: 0, freezeEarned: false, medals: [] };
    p.today.rounds++; p.stats.rounds++;
    if (kind !== 'race') { ev.bonus = Math.round(5 * mult(p)); p.crystals += ev.bonus; }
    const today = dayKey();
    if (p.chestDay !== today) { p.chestDay = today; ev.chest = 20; p.crystals += 20; }
    const st = p.streak;
    if (st.last !== today) {
      const gap = st.last ? daysBetween(st.last, today) : 1;
      if (gap === 1) st.count++;
      else if (gap > 1 && gap - 1 <= st.freezes) { st.freezes -= gap - 1; ev.freezeUsed = gap - 1; st.count++; }
      else st.count = 1;
      st.last = today; ev.streakUp = true;
      if (st.count % 7 === 0 && st.freezes < MAX_FREEZES) { st.freezes++; ev.freezeEarned = true; }
    }
    ev.medals = checkMedals(p);
    return ev;
  }
  function checkMedals(p) {
    const got = [];
    MEDALS.forEach((m) => { if (!p.medals[m.id] && m.test(p)) { p.medals[m.id] = new Date().toISOString(); got.push(m); } });
    return got;
  }
  // visar svit som "bruten" om mer än frysblocken räcker till
  function streakAlive(p) {
    const st = p.streak; if (!st.last) return 0;
    const gap = daysBetween(st.last, dayKey());
    return gap <= 1 + st.freezes ? st.count : 0;
  }

  /* ---------- butik och bas ---------- */
  function buyBlock(p, id, n) {
    const b = BLOCKS.find((x) => x.id === id); if (!b) return false;
    const cost = b.cost * n; if (p.crystals < cost) return false;
    p.crystals -= cost; p.inventory[id] = (p.inventory[id] || 0) + n; return true;
  }
  function buyFreeze(p) { if (p.crystals < FREEZE_COST || p.streak.freezes >= MAX_FREEZES) return false; p.crystals -= FREEZE_COST; p.streak.freezes++; return true; }
  function expandBase(p) {
    const b = p.base; if (p.crystals < EXPAND_COST || b.w >= MAX_W) return false;
    p.crystals -= EXPAND_COST;
    const cells = [];
    for (let y = 0; y < b.h; y++) { for (let x = 0; x < b.w; x++) cells.push(b.cells[y * b.w + x]); cells.push('', ''); }
    b.w += 2; b.cells = cells; return true;
  }
  function place(p, idx, item) {
    const b = p.base; if (idx < 0 || idx >= b.cells.length || b.cells[idx]) return false;
    if (item.startsWith('c:')) {
      if (!p.creatures[item.slice(2)] || b.cells.includes(item)) return false;
    } else { if (!p.inventory[item]) return false; p.inventory[item]--; p.stats.placed++; }
    b.cells[idx] = item; return true;
  }
  function pickUp(p, idx) {
    const b = p.base, it = b.cells[idx]; if (!it) return false;
    if (!it.startsWith('c:')) p.inventory[it] = (p.inventory[it] || 0) + 1;
    b.cells[idx] = ''; return true;
  }
  function buyReward(p, reward) {
    if (p.crystals < reward.cost) return null;
    p.crystals -= reward.cost;
    const r = { id: 'r' + Date.now().toString(36), rewardId: reward.id, name: reward.name, cost: reward.cost, at: new Date().toISOString(), status: 'pending' };
    p.requests.push(r); if (p.requests.length > 60) p.requests = p.requests.slice(-60);
    return r;
  }
  function resolveRequest(p, reqId, approve) {
    const r = p.requests.find((x) => x.id === reqId); if (!r || r.status !== 'pending') return false;
    r.status = approve ? 'given' : 'declined'; r.doneAt = new Date().toISOString();
    if (!approve) p.crystals += r.cost;
    return true;
  }

  root.KGEngine = {
    MAX, CREATURES, BLOCKS, MEDALS, STAGE_XP, FREEZE_COST, MAX_FREEZES, EXPAND_COST, MAX_W,
    dayKey, weekKey, daysBetween, creatureGrid, newPlayer, applyTest, ensureToday, goalReached, mult,
    buildRound, raceQuestion, recordAnswer, eggNeed, finishRound, checkMedals, streakAlive,
    buyBlock, buyFreeze, expandBase, place, pickUp, buyReward, resolveRequest, owned,
  };
})(typeof window !== 'undefined' ? window : globalThis);
