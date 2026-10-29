/* =====================================================================
   KRISTALLGRUVAN – UPPGIFTSMOTOR (ren logik, inget DOM, ingen lagring)
   Kan återanvändas oförändrad i spelet och på en egen server.
   Nivåer: 1 = åk 3, 2 = åk 4, 3 = åk 5, 4 = åk 6, 5 = över åk 6
   ===================================================================== */
(function (root) {
  'use strict';

  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const P = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  const fmt = (n) => {
    const x = r6(n);
    const neg = x < 0;
    const [i, d] = Math.abs(x).toString().split('.');
    const int = i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : i;
    return (neg ? '−' : '') + int + (d ? ',' + d : '');
  };
  const NAMES = ['Ella', 'Leo', 'Maja', 'Noah', 'Alva', 'Elias', 'Saga', 'Hugo', 'Wilma', 'Liam', 'Ebba', 'Viggo', 'Nora', 'Theo'];

  const LEVEL_LABELS = ['under åk 3', 'åk 3', 'åk 4', 'åk 5', 'åk 6', 'över åk 6', 'åk 7–8'];
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).split('').map((c) => SUP[+c]).join('');

  const AREAS = [
    { id: 'tal', name: 'Tal & positionssystem', gem: '#7fd1ff' },
    { id: 'addsub', name: 'Addition & subtraktion', gem: '#7ccf5a' },
    { id: 'tabell', name: 'Gångertabellerna', gem: '#ffd166' },
    { id: 'muldiv', name: 'Multiplikation & division', gem: '#ff9f5a' },
    { id: 'brak', name: 'Bråk', gem: '#ff7aa8' },
    { id: 'dec', name: 'Decimaltal & procent', gem: '#5ee0c0' },
    { id: 'geo', name: 'Geometri', gem: '#b58cff' },
    { id: 'mat', name: 'Mätning & tid', gem: '#f2f2f2' },
    { id: 'alg', name: 'Mönster & ekvationer', gem: '#6f8cff' },
    { id: 'stat', name: 'Statistik & sannolikhet', gem: '#e6c27a' },
    { id: 'prob', name: 'Problemlösning', gem: '#ff6b6b' },
  ];

  /* ---------- frågebyggare ---------- */
  // text: bråk skrivs som {3/4} och ritas staplade i gränssnittet
  function num(text, answer, o) { return Object.assign({ kind: 'num', text, answer: r6(answer) }, o || {}); }
  function frac(text, n, d, o) { return Object.assign({ kind: 'frac', text, answer: { n, d } }, o || {}); }
  function time(text, h, m, o) { return Object.assign({ kind: 'time', text, answer: { h: ((h % 24) + 24) % 24, m } }, o || {}); }
  function choice(text, correct, wrong, o) {
    o = o || {};
    const opts = o.fixedOrder ? o.fixedOrder : shuffle([correct].concat(wrong));
    const q = Object.assign({ kind: 'choice', text, choices: opts, answer: opts.indexOf(correct) }, o);
    delete q.fixedOrder;
    return q;
  }
  const pad = (n) => (n < 10 ? '0' : '') + n;

  /* ---------- figurer (SVG, färger via CSS-klasser) ---------- */
  const FIG = {
    rect(w, h) {
      const s = Math.min(200 / w, 120 / h), W = w * s, H = h * s, x = 70, y = 16;
      return `<svg class="fig" viewBox="0 0 ${W + 110} ${H + 56}" role="img" aria-label="Rektangel ${w} gånger ${h} cm">
<rect class="shape" x="${x}" y="${y}" width="${W}" height="${H}"/>
<text class="lbl" x="${x + W / 2}" y="${y + H + 28}" text-anchor="middle">${fmt(w)} cm</text>
<text class="lbl" x="${x - 10}" y="${y + H / 2 + 6}" text-anchor="end">${fmt(h)} cm</text></svg>`;
    },
    bar(n, k) {
      const W = 300, w = W / n;
      let r = '';
      for (let i = 0; i < n; i++) r += `<rect class="${i < k ? 'fill' : 'shape'}" x="${10 + i * w}" y="10" width="${w}" height="50"/>`;
      return `<svg class="fig" viewBox="0 0 320 70" role="img" aria-label="Stång i ${n} delar">${r}</svg>`;
    },
    angle(deg) {
      const cx = 150, cy = 150, L = 130, rad = (deg * Math.PI) / 180;
      const x2 = cx + L * Math.cos(rad), y2 = cy - L * Math.sin(rad);
      let mark;
      if (deg === 90) mark = `<path class="mark" d="M${cx + 22} ${cy} L${cx + 22} ${cy - 22} L${cx} ${cy - 22}"/>`;
      else { const r = 30; mark = `<path class="mark" d="M${cx + r} ${cy} A${r} ${r} 0 0 0 ${cx + r * Math.cos(rad)} ${cy - r * Math.sin(rad)}"/>`; }
      return `<svg class="fig" viewBox="0 0 300 170" role="img" aria-label="En vinkel"><line class="ray" x1="${cx}" y1="${cy}" x2="${cx + L}" y2="${cy}"/><line class="ray" x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}"/>${mark}<circle class="dot" cx="${cx}" cy="${cy}" r="4"/></svg>`;
    },
    tri(b, h) {
      const s = Math.min(220 / b, 130 / h), B = b * s, H = h * s, x = 30, y = H + 16, ax = x + B * 0.35;
      return `<svg class="fig" viewBox="0 0 ${B + 120} ${H + 56}" role="img" aria-label="Triangel med basen ${b} cm och höjden ${h} cm">
<polygon class="shape" points="${x},${y} ${x + B},${y} ${ax},${y - H}"/>
<line class="dash" x1="${ax}" y1="${y - H}" x2="${ax}" y2="${y}"/>
<text class="lbl" x="${x + B / 2}" y="${y + 28}" text-anchor="middle">${b} cm</text>
<text class="lbl" x="${ax + 8}" y="${y - H / 2}">${h} cm</text></svg>`;
    },
    lshape(W, H, cw, ch) {
      const s = Math.min(200 / W, 140 / H), ox = 64, oy = 14, X = (v) => ox + v * s, Y = (v) => oy + v * s;
      const pts = [[0, 0], [W - cw, 0], [W - cw, ch], [W, ch], [W, H], [0, H]].map(([a, b]) => `${X(a)},${Y(b)}`).join(' ');
      return `<svg class="fig" viewBox="0 0 ${W * s + 130} ${H * s + 56}" role="img" aria-label="Sammansatt figur">
<polygon class="shape" points="${pts}"/>
<text class="lbl" x="${X(W / 2)}" y="${Y(H) + 28}" text-anchor="middle">${W} cm</text>
<text class="lbl" x="${X(0) - 10}" y="${Y(H / 2) + 6}" text-anchor="end">${H} cm</text>
<text class="lbl" x="${X(W - cw / 2)}" y="${Y(ch) - 8}" text-anchor="middle">${cw} cm</text>
<text class="lbl" x="${X(W - cw) - 8}" y="${Y(ch / 2) + 6}" text-anchor="end">${ch} cm</text></svg>`;
    },
    bars(cats, vals) {
      const x0 = 34, x1 = 300, y0 = 170, top = 14, max = 12, step = (y0 - top) / max, bw = (x1 - x0) / cats.length;
      let g = '';
      for (let v = 0; v <= max; v++) {
        g += `<line class="${v % 2 ? 'grid2' : 'grid'}" x1="${x0}" y1="${y0 - v * step}" x2="${x1}" y2="${y0 - v * step}"/>`;
        if (v % 2 === 0) g += `<text class="tick" x="${x0 - 6}" y="${y0 - v * step + 4}" text-anchor="end">${v}</text>`;
      }
      cats.forEach((c, i) => {
        const h = vals[i] * step, x = x0 + i * bw + bw * 0.2;
        g += `<rect class="fill" x="${x}" y="${y0 - h}" width="${bw * 0.6}" height="${h}"/>`;
        g += `<text class="tick" x="${x + bw * 0.3}" y="${y0 + 18}" text-anchor="middle">${c}</text>`;
      });
      return `<svg class="fig" viewBox="0 0 310 196" role="img" aria-label="Stapeldiagram">${g}</svg>`;
    },
  };

  /* ---------- mallar per område och nivå ---------- */
  function digitValue(min, max, places) {
    for (;;) {
      const n = R(min, max), s = String(n), pl = P(places);
      const idx = s.length - 1 - Math.log10(pl);
      const d = Number(s[idx]);
      if (d === 0) continue;
      if (s.split('').filter((c) => c === s[idx]).length > 1) continue;
      return num(`Vilket värde har siffran <b>${d}</b> i talet <b>${fmt(n)}</b>?`, d * pl, { skill: 'siffrans värde' });
    }
  }

  const T = {
    tal: {
      1: [() => digitValue(100, 999, [10, 100]),
          () => { const n = R(120, 980), k = P([10, 100]); return num(`Vilket tal är ${k} mer än ${fmt(n)}?`, n + k, { skill: 'räkna med 10 och 100' }); }],
      2: [() => digitValue(10000, 99999, [100, 1000, 10000]),
          () => { let n = R(1000, 9999); if (n % 100 === 50) n++; return num(`Avrunda ${fmt(n)} till närmaste hundratal.`, Math.round(n / 100) * 100, { skill: 'avrundning' }); }],
      3: [() => { const n = R(10, 99) * 10000 + R(0, 999); return num(`Vilket tal är 1 000 mindre än ${fmt(n)}?`, n - 1000, { skill: 'stora tal, växling' }); },
          () => { const a = R(1, 9), b = P([R(1, 9) * 10, R(1, 9)]), c = R(1, 9); return num(`Skriv med siffror: <b>${a} ${a === 1 ? 'miljon' : 'miljoner'} ${b} tusen ${c}</b>`, a * 1e6 + b * 1000 + c, { skill: 'tal till miljoner' }); }],
      4: [() => { const t = -R(2, 9), u = R(-t + 1, 15); return num(`Termometern visar ${fmt(t)} °C. Temperaturen stiger ${u} grader. Vad visar termometern nu?`, t + u, { unit: '°C', skill: 'negativa tal' }); },
          () => { const x = R(101, 999) / 100, m = P([10, 100]); return num(`Vad är ${m} · ${fmt(x)}?`, x * m, { skill: 'multiplikation med 10 och 100' }); },
          () => { for (;;) { const a = R(1, 9), d1 = R(1, 9), d2 = R(1, 9), d3 = R(1, 9); const ds = [d1, d2, d3]; const pos = R(0, 1); const d = ds[pos]; if (ds.filter((x) => x === d).length > 1 || d === a) continue; const x = a + d1 / 10 + d2 / 100 + d3 / 1000; return num(`Vilket värde har siffran <b>${d}</b> i talet <b>${fmt(x)}</b>?`, d / (pos ? 100 : 10), { skill: 'decimala positioner' }); } }],
      5: [() => { for (;;) { const a = -R(2, 12), b = R(4, 20); if ((a + b) % 2) continue; return num(`Vilket tal ligger mitt emellan ${fmt(a)} och ${fmt(b)} på tallinjen?`, (a + b) / 2, { skill: 'tallinje, negativa tal' }); } },
          () => { const x = R(1, 9) + R(1, 99) / 100; return num(`Hur många hundradelar är ${fmt(x)}?`, Math.round(x * 100), { skill: 'decimala positioner' }); },
          () => { const n = R(2, 999); return num(`Vad är ${fmt(n)} / 1 000?`, n / 1000, { skill: 'division med 1 000' }); }],
    },
    addsub: {
      1: [() => { for (;;) { const a = R(25, 69), b = R(15, 29); if (a % 10 + b % 10 >= 10) return num(`${a} + ${b}`, a + b, { skill: 'tiotalsövergång' }); } },
          () => { for (;;) { const a = R(41, 95), b = R(12, a - 10); if (a % 10 < b % 10) return num(`${a} − ${b}`, a - b, { skill: 'subtraktion med växling' }); } }],
      2: [() => { const a = R(150, 599), b = R(150, 399); return num(`${a} + ${b}`, a + b, { skill: 'tresiffrig addition' }); },
          () => { const a = R(2, 9) * 100 + R(1, 9), b = R(100, a - 20); return num(`${a} − ${b}`, a - b, { skill: 'växling över noll' }); }],
      3: [() => { const a = R(2000, 9000), b = R(1000, a - 500); return num(`${fmt(a)} − ${fmt(b)}`, a - b, { skill: 'fyrsiffrig subtraktion' }); },
          () => { const a = R(1200, 5999), b = R(1200, 3999); return num(`${fmt(a)} + ${fmt(b)}`, a + b, { skill: 'fyrsiffrig addition' }); }],
      4: [() => { const a = R(50, 250) / 10, b = R(101, 999) / 100; return num(`${fmt(a)} + ${fmt(b)}`, a + b, { skill: 'addition med decimaltal' }); },
          () => { const a = R(10, 30); let b = R(101, (a - 1) * 100); if (b % 10 === 0) b += 3; return num(`${a} − ${fmt(b / 100)}`, a - b / 100, { skill: 'subtraktion med decimaltal' }); }],
      5: [() => { const a = R(3, 12), b = R(10, 25), c = R(5, 20); return num(`−${a} + ${b} − ${c}`, -a + b - c, { skill: 'negativa tal' }); },
          () => { const n = R(10000, 89999); return num(`100 000 − ${fmt(n)}`, 100000 - n, { skill: 'växling över många nollor' }); }],
    },
    tabell: {
      1: [() => { const a = P([2, 3, 4, 5, 10]), b = R(2, 10); return num(`${a} · ${b}`, a * b, { skill: 'tabell 2–5, 10' }); }],
      2: [() => { const a = P([6, 7, 8, 9]), b = R(3, 9); return Math.random() < 0.5 ? num(`${a} · ${b}`, a * b, { skill: 'tabell 6–9' }) : num(`${b} · ${a}`, a * b, { skill: 'tabell 6–9' }); }],
      3: [() => { const a = R(3, 9), b = R(3, 9); return num(`${a * b} / ${a}`, b, { skill: 'division ur tabellen' }); }],
      4: [() => { const a = R(3, 9), b = R(3, 9) * 10; return num(`${a} · ${b}`, a * b, { skill: 'tabellen gånger tiotal' }); },
          () => { const a = R(3, 9), b = R(3, 9) * 100; return num(`${fmt(a * b)} / ${a}`, b, { skill: 'division med hundratal' }); }],
      5: [() => { const a = R(11, 15), b = R(3, 9); return num(`${a} · ${b}`, a * b, { skill: 'tabell över 10' }); },
          () => { const a = R(11, 15); return num(`${a * a} / ${a}`, a, { skill: 'division över tabellen' }); }],
    },
    muldiv: {
      1: [() => { const a = R(2, 4), b = R(11, 24); return num(`${a} · ${b}`, a * b, { skill: 'ental gånger tvåsiffrigt' }); },
          () => { const a = R(2, 4), q = R(11, 24); return num(`${a * q} / ${a}`, q, { skill: 'enkel division' }); }],
      2: [() => { const a = R(5, 9), b = R(23, 89); return num(`${a} · ${b}`, a * b, { skill: 'multiplikation med minnessiffra' }); },
          () => { const a = R(3, 8), q = R(12, 30); return num(`${a * q} / ${a}`, q, { skill: 'kort division' }); }],
      3: [() => { const a = R(12, 39), b = R(11, 25); return num(`${a} · ${b}`, a * b, { skill: 'tvåsiffrigt gånger tvåsiffrigt' }); },
          () => { const a = R(4, 9), q = R(41, 125); return num(`${a * q} / ${a}`, q, { skill: 'division, tresiffrigt' }); }],
      4: [() => { const a = R(11, 99) / 10, b = R(3, 9); return num(`${fmt(a)} · ${b}`, a * b, { skill: 'decimaltal gånger heltal' }); },
          () => { const d = R(11, 25), q = R(12, 60); return num(`${fmt(d * q)} / ${d}`, q, { skill: 'division med tvåsiffrigt tal' }); }],
      5: [() => { const a = R(11, 49) / 10, b = R(11, 19) / 10; return num(`${fmt(a)} · ${fmt(b)}`, a * b, { skill: 'decimaltal gånger decimaltal' }); },
          () => { const d = R(2, 9) / 10, q = R(3, 12); return num(`${fmt(r6(d * q))} / ${fmt(d)}`, q, { skill: 'division med decimaltal' }); }],
    },
    brak: {
      1: [() => { const n = R(3, 8), k = R(1, n - 1); return frac('Hur stor del av stången är färgad? Skriv som bråk, till exempel 2/5.', k, n, { fig: FIG.bar(n, k), skill: 'bråk som del av helhet' }); },
          () => { const n = P([3, 4, 5, 6, 8]); const nm = { 3: 'tredjedelar', 4: 'fjärdedelar', 5: 'femtedelar', 6: 'sjättedelar', 8: 'åttondelar' }[n]; return num(`Hur många ${nm} går det på en hel?`, n, { skill: 'stambråk' }); }],
      2: [() => { const d = P([2, 3, 4, 5]), N = d * R(3, 12); return num(`Vad är {1/${d}} av ${N}?`, N / d, { skill: 'del av antal' }); },
          () => { const [a, b, c] = shuffle([2, 3, 4, 5, 6, 8, 10]).slice(0, 3); const best = Math.min(a, b, c); return choice('Vilket bråk är störst?', `{1/${best}}`, [a, b, c].filter((x) => x !== best).map((x) => `{1/${x}}`), { skill: 'jämföra stambråk' }); }],
      3: [() => { const d = R(2, 6), n = R(1, d - 1), m = R(2, 5); return num(`{${n}/${d}} = {?/${d * m}}  Vilket tal ska stå där frågetecknet är?`, n * m, { skill: 'likvärdiga bråk' }); },
          () => { const d = P([3, 4, 5, 6, 8]), k = R(2, d - 1), N = d * R(3, 10); return num(`Vad är {${k}/${d}} av ${N}?`, (k * N) / d, { skill: 'del av antal' }); }],
      4: [() => { const d = R(5, 9), a = R(1, d - 1), b = R(1, d - 1); return frac(`{${a}/${d}} + {${b}/${d}}`, a + b, d, { skill: 'addition, lika nämnare' }); },
          () => { const [a, b, c, d] = P([[1, 2, 1, 4], [1, 2, 1, 8], [1, 3, 1, 6], [3, 4, 1, 8], [1, 2, 3, 8], [2, 3, 1, 6], [1, 4, 3, 8]]); const n = a * d + c * b, m = b * d, g = gcd(n, m); return frac(`{${a}/${b}} + {${c}/${d}}`, n / g, m / g, { skill: 'addition, olika nämnare' }); },
          () => { const set = shuffle([[3, 4], [2, 3], [5, 8], [3, 5], [7, 10], [1, 2]]).slice(0, 3); const best = set.reduce((m, f) => (f[0] / f[1] > m[0] / m[1] ? f : m)); return choice('Vilket bråk är störst?', `{${best[0]}/${best[1]}}`, set.filter((f) => f !== best).map((f) => `{${f[0]}/${f[1]}}`), { skill: 'jämföra bråk' }); }],
      5: [() => { for (;;) { const [b, d] = shuffle([3, 4, 5, 6]).slice(0, 2); const a = R(1, b - 1), c = R(1, d - 1); if (gcd(a, b) > 1 || gcd(c, d) > 1) continue; const n = a * d + c * b, m = b * d, g = gcd(n, m); return frac(`{${a}/${b}} + {${c}/${d}}`, n / g, m / g, { skill: 'addition, olika nämnare' }); } },
          () => { const [n, d] = P([[3, 4], [2, 3], [3, 5], [5, 6], [4, 7], [2, 5]]), k = R(2, 6); return frac(`Förkorta {${n * k}/${d * k}} så långt det går.`, n, d, { simplest: true, skill: 'förkortning' }); },
          () => { const d = P([3, 4, 5, 6]), k = R(2, d - 1), m = R(2, 6); return num(`{${k}/${d}} · ${d * m}`, k * m, { skill: 'bråk gånger heltal' }); }],
    },
    dec: {
      1: [() => { for (;;) { const a = R(1, 8), b = R(1, 8); if (a + b < 10) return num(`0,${a} + 0,${b}`, (a + b) / 10, { skill: 'tiondelar' }); } },
          () => { const x = R(3, 8), y = (x - 1) * 10 + R(1, 9), w = R(1, 9); return choice('Vilket tal är störst?', `0,${x}`, [`0,${y}`, `0,0${w}`], { skill: 'storleksordning decimaltal' }); }],
      2: [() => { const a = R(11, 89) / 10, b = R(11, 89) / 10; return num(`${fmt(a)} + ${fmt(b)}`, a + b, { skill: 'addition med tiondelar' }); },
          () => { const d = P([10, 100]), n = d === 10 ? R(1, 9) : R(11, 99); return num(`Skriv {${n}/${d}} som decimaltal.`, n / d, { skill: 'bråk till decimaltal' }); }],
      3: [() => { const a = R(5, 12) + R(1, 9) / 10; let b = R(100, Math.floor(a * 100) - 50); if (b % 10 === 0) b += 3; return num(`${fmt(a)} − ${fmt(b / 100)}`, a - b / 100, { skill: 'subtraktion med decimaltal' }); },
          () => { const x = R(11, 999) / 100, m = P([10, 100]); return Math.random() < 0.5 ? num(`${fmt(x)} · ${m}`, x * m, { skill: 'gånger 10 och 100' }) : num(`${fmt(x)} / ${m}`, x / m, { skill: 'delat med 10 och 100' }); }],
      4: [() => { const p = P([50, 10, 25]); const N = p === 50 ? 2 * R(11, 99) : p === 10 ? 10 * R(5, 90) : 4 * R(5, 50); return num(`Vad är ${p} % av ${N}?`, (p * N) / 100, { skill: 'procent av' }); },
          () => { const x = R(11, 99); return num(`Skriv 0,${x} i procent.`, x, { unit: '%', skill: 'decimaltal till procent' }); }],
      5: [() => { const p = P([20, 5, 75, 30]); const N = { 20: 5 * R(3, 40), 5: 20 * R(2, 30), 75: 4 * R(3, 30), 30: 10 * R(2, 30) }[p]; return num(`Vad är ${p} % av ${N}?`, (p * N) / 100, { skill: 'procent av' }); },
          () => { const a = R(2, 9), b = R(2, 9); return num(`0,${a} · 0,${b}`, (a * b) / 100, { skill: 'decimaltal gånger decimaltal' }); },
          () => { const [n, d] = P([[1, 8], [3, 8], [5, 8], [3, 4], [2, 5], [3, 20], [7, 25]]); return num(`Skriv {${n}/${d}} som decimaltal.`, n / d, { skill: 'bråk till decimaltal' }); }],
    },
    geo: {
      1: [() => { let w = R(3, 9), h = R(2, 6); if (w === h) w++; return num('Vad är rektangelns omkrets?', 2 * (w + h), { unit: 'cm', fig: FIG.rect(w, h), skill: 'omkrets' }); },
          () => { const [q, a] = P([['hörn', 8], ['kanter', 12], ['sidoytor', 6]]); return num(`Hur många ${q} har en kub?`, a, { skill: 'kroppar' }); },
          () => { const [c, w] = P([['femhörning', ['fyrhörning', 'sexhörning']], ['sexhörning', ['femhörning', 'åttahörning']]]); const n = c === 'femhörning' ? 'fem' : 'sex'; return choice(`Vad heter en figur med ${n} hörn och ${n} raka sidor?`, c, w, { skill: 'månghörningar' }); }],
      2: [() => { let w = R(3, 12), h = R(2, 9); if (w === h) w++; return num('Vad är rektangelns area?', w * h, { unit: 'cm²', fig: FIG.rect(w, h), skill: 'area' }); },
          () => { const s = R(4, 15); return num(`En kvadrat har sidan ${s} cm. Vad är kvadratens omkrets?`, 4 * s, { unit: 'cm', skill: 'omkrets' }); }],
      3: [() => { const deg = P([R(25, 75), 90, R(105, 160)]); const c = deg < 90 ? 'spetsig' : deg === 90 ? 'rät' : 'trubbig'; return choice('Vilken sorts vinkel är det?', c, ['spetsig', 'rät', 'trubbig'].filter((x) => x !== c), { fixedOrder: ['spetsig', 'rät', 'trubbig'], fig: FIG.angle(deg), skill: 'vinklar' }); },
          () => { const s = R(4, 15); return num(`En kvadrat har omkretsen ${4 * s} cm. Hur lång är en sida?`, s, { unit: 'cm', skill: 'omkrets baklänges' }); },
          () => { const a = R(3, 9), b = R(4, 9); return num(`En rektangel har arean ${a * b} cm². Ena sidan är ${a} cm. Hur lång är den andra sidan?`, b, { unit: 'cm', skill: 'area baklänges' }); }],
      4: [() => { for (;;) { const b = R(4, 14), h = R(3, 10); if ((b * h) % 2 === 0) return num('Vad är triangelns area?', (b * h) / 2, { unit: 'cm²', fig: FIG.tri(b, h), skill: 'triangelns area' }); } },
          () => { const a = R(30, 80), b = R(30, 80); return num(`I en triangel är två av vinklarna ${a}° och ${b}°. Hur stor är den tredje vinkeln?`, 180 - a - b, { unit: '°', skill: 'vinkelsumma' }); }],
      5: [() => { const W = R(6, 12), H = R(5, 10), cw = R(2, W - 3), ch = R(2, H - 3); return num('Vad är figurens area? Alla hörn är räta.', W * H - cw * ch, { unit: 'cm²', fig: FIG.lshape(W, H, cw, ch), skill: 'sammansatt area' }); },
          () => { for (;;) { const a = R(60, 120), b = R(60, 120), c = R(60, 120), d = 360 - a - b - c; if (d >= 40 && d <= 170) return num(`En fyrhörning har tre vinklar som är ${a}°, ${b}° och ${c}°. Hur stor är den fjärde vinkeln?`, d, { unit: '°', skill: 'vinkelsumma' }); } },
          () => { const l = R(2, 8), b = R(2, 6), h = R(2, 5); return num(`Ett rätblock är ${l} cm långt, ${b} cm brett och ${h} cm högt. Vad är volymen?`, l * b * h, { unit: 'cm³', skill: 'volym' }); }],
    },
    mat: {
      1: [() => { const a = R(2, 9); return num(`Hur många centimeter är ${a} meter?`, 100 * a, { unit: 'cm', skill: 'längdenheter' }); },
          () => { const h = R(2, 4); return num(`Hur många minuter är ${h} timmar?`, 60 * h, { unit: 'min', skill: 'tid' }); },
          () => { const a = R(2, 9); return num(`Hur många gram är ${a} kilogram?`, 1000 * a, { unit: 'g', skill: 'viktenheter' }); }],
      2: [() => { const a = R(2, 9); return num(`Hur många deciliter är ${a} liter?`, 10 * a, { unit: 'dl', skill: 'volymenheter' }); },
          () => { for (;;) { const h = R(8, 17), m = P([15, 30, 40, 45, 50]), dm = P([20, 30, 45, 50]); const tot = h * 60 + m + 60 + dm; if (m + dm < 60) continue; return time(`Filmen börjar ${pad(h)}:${pad(m)} och är 1 timme och ${dm} minuter lång. Vilken tid slutar den? Skriv som 12:30.`, Math.floor(tot / 60), tot % 60, { skill: 'klockan, sluttid' }); } }],
      3: [() => { const m = R(11, 95) * 100; return num(`Hur många kilometer är ${fmt(m)} meter?`, m / 1000, { unit: 'km', skill: 'meter till kilometer' }); },
          () => { const g = R(1, 9) * 100 + 50, kg = R(1, 4) + P([0, 0.5, 0.25]); return num(`Hur mycket väger ${g} g och ${fmt(kg)} kg tillsammans? Svara i gram.`, g + kg * 1000, { unit: 'g', skill: 'blandade enheter' }); },
          () => { const s = R(8, 14) * 60 + P([5, 20, 35, 50]), d = R(60, 150); const e = s + d; return num(`Lektionen börjar ${pad(Math.floor(s / 60))}:${pad(s % 60)} och slutar ${pad(Math.floor(e / 60))}:${pad(e % 60)}. Hur många minuter är den?`, d, { unit: 'min', skill: 'tidsskillnad' }); }],
      4: [() => { const x = R(11, 95) / 100; return num(`Hur många deciliter är ${fmt(x)} liter?`, x * 10, { unit: 'dl', skill: 'volymenheter, decimaltal' }); },
          () => { const h = R(1, 3), m = P([15, 20, 35, 45]); return num(`Hur många minuter är ${h} h ${m} min?`, h * 60 + m, { unit: 'min', skill: 'tid' }); },
          () => { const x = R(11, 99) / 10; return num(`Hur många centimeter är ${fmt(x)} dm?`, x * 10, { unit: 'cm', skill: 'längdenheter, decimaltal' }); }],
      5: [() => { for (;;) { const v = P([40, 60, 80, 90, 120]), t = P([15, 30, 45, 90]); if ((v * t) % 60) continue; return num(`En bil kör med farten ${v} km/h. Hur långt kommer den på ${t} minuter?`, (v * t) / 60, { unit: 'km', skill: 'fart, sträcka, tid' }); } },
          () => { const a = R(2, 9); return num(`Hur många kvadratdecimeter är ${a} m²?`, 100 * a, { unit: 'dm²', skill: 'areaenheter' }); },
          () => { const km = R(21, 59) / 10, m = R(2, 9) * 100 + 50; return num(`${fmt(km)} km − ${m} m. Svara i meter.`, km * 1000 - m, { unit: 'm', skill: 'blandade enheter' }); }],
    },
    alg: {
      1: [() => { const s = R(1, 20), d = R(2, 9), t = [0, 1, 2, 3].map((i) => s + i * d); return num(`Vilket tal kommer sedan? ${t.join(', ')}, …`, s + 4 * d, { skill: 'talföljd' }); },
          () => { const s = R(60, 99), d = R(3, 8), t = [0, 1, 2, 3].map((i) => s - i * d); return num(`Vilket tal kommer sedan? ${t.join(', ')}, …`, s - 4 * d, { skill: 'talföljd' }); }],
      2: [() => { const a = R(12, 79), b = R(12, 59); return num(`Vilket tal ska stå i rutan? &nbsp;□ + ${b} = ${a + b}`, a, { skill: 'obekant tal' }); },
          () => { const s = R(2, 6), r = P([2, 3]), t = [0, 1, 2, 3].map((i) => s * r ** i); return num(`Vilket tal kommer sedan? ${t.join(', ')}, …`, s * r ** 4, { skill: 'talföljd, gånger' }); }],
      3: [() => { const a = R(3, 9), x = R(3, 12); return num(`x · ${a} = ${a * x}. Vad är x?`, x, { skill: 'enkel ekvation' }); },
          () => { const a = R(3, 9), x = R(3, 12); return num(`${a * x} / x = ${a}. Vad är x?`, x, { skill: 'enkel ekvation' }); },
          () => { const s = R(1, 10), d0 = R(1, 3); const t = [s]; for (let i = 0; i < 4; i++) t.push(t[i] + d0 + i); return num(`Vilket tal kommer sedan? ${t.join(', ')}, …`, t[4] + d0 + 4, { skill: 'talföljd, växande steg' }); }],
      4: [() => { const a = R(2, 6), x = R(2, 12), b = R(1, 15); return num(`${a}x + ${b} = ${a * x + b}. Vad är x?`, x, { skill: 'ekvation i två steg' }); },
          () => { const v = R(2, 9), m = R(2, 9), k = R(1, 9); return num(`Om a = ${v}, vad är ${m}a − ${k}?`, m * v - k, { skill: 'uttryck' }); },
          () => { const s = R(1, 5), t = [s]; for (let i = 0; i < 3; i++) t.push(t[i] * 2 + 1); return num(`Vilket tal kommer sedan? ${t.join(', ')}, …`, t[3] * 2 + 1, { skill: 'talföljd, regel i två steg' }); }],
      5: [() => { for (;;) { const a = R(3, 7), c = R(1, a - 1), x = R(2, 10), b = R(1, 15), d = (a - c) * x - b; if (d <= 0) continue; return num(`${a}x − ${b} = ${c === 1 ? '' : c}x + ${d}. Vad är x?`, x, { skill: 'ekvation, x på båda sidor' }); } },
          () => { const m = R(2, 5), k = R(1, 8), x = R(2, 10); return num(`${m}(x + ${k}) = ${m * (x + k)}. Vad är x?`, x, { skill: 'ekvation med parentes' }); },
          () => { const a = R(2, 5), b = R(0, 3), n = P([10, 20, 50]); return num(`Figur 1 har ${a + b} stickor, figur 2 har ${2 * a + b} och figur 3 har ${3 * a + b}. Mönstret fortsätter likadant. Hur många stickor har figur ${n}?`, n * a + b, { skill: 'mönster, generell regel' }); }],
    },
    stat: {
      1: [() => { const cats = ['Fotboll', 'Simning', 'Spel', 'Bygga']; for (;;) { const v = cats.map(() => R(1, 12)); const i = R(0, 3), j = R(0, 3); if (i === j || v[i] <= v[j]) continue; return num(`Diagrammet visar vad eleverna i en klass gillar mest. Hur många fler valde ${cats[i].toLowerCase()} än ${cats[j].toLowerCase()}?`, v[i] - v[j], { fig: FIG.bars(cats, v), skill: 'läsa stapeldiagram' }); } }],
      2: [() => { for (;;) { const m = R(2, 9); const rest = []; while (rest.length < 4) { const x = R(1, 10); if (x !== m && rest.filter((y) => y === x).length < 1) rest.push(x); } const list = shuffle([m, m, m].concat(rest)); return num(`Vilket är typvärdet? &nbsp;${list.join(', ')}`, m, { skill: 'typvärde' }); } },
          () => { const list = Array.from({ length: 6 }, () => R(2, 40)); return num(`Vad är variationsbredden (skillnaden mellan största och minsta värdet)? &nbsp;${list.join(', ')}`, Math.max(...list) - Math.min(...list), { skill: 'variationsbredd' }); }],
      3: [() => { const n = P([3, 4, 5]), m = R(5, 20); for (;;) { const v = Array.from({ length: n - 1 }, () => m + R(-4, 4)); const last = n * m - v.reduce((a, b) => a + b, 0); if (last < 1 || Math.abs(last - m) > 6) continue; const list = shuffle(v.concat(last)); return num(`Vad är medelvärdet? &nbsp;${list.join(', ')}`, m, { skill: 'medelvärde' }); } }],
      4: [() => { const v = Array.from({ length: 5 }, () => R(1, 30)); const s = v.slice().sort((a, b) => a - b); return num(`Vad är medianen? &nbsp;${v.join(', ')}`, s[2], { skill: 'median' }); },
          () => { const [txt, k] = P([['en sexa', 1], ['ett jämnt tal', 3], ['mer än 4', 2], ['en etta eller en tvåa', 2]]); return frac(`Du slår en vanlig tärning. Hur stor är chansen att få ${txt}? Svara med ett bråk.`, k, 6, { skill: 'sannolikhet' }); }],
      5: [() => { const r = R(2, 8), b = R(2, 8), g = R(1, 5); return frac(`I en påse finns ${r} röda, ${b} blå och ${g} gröna kulor. Du tar en kula utan att titta. Hur stor är chansen att den är röd? Svara med ett bråk.`, r, r + b + g, { skill: 'sannolikhet' }); },
          () => { for (;;) { const m = R(8, 20), v = [R(4, 25), R(4, 25), R(4, 25)], d = 4 * m - v[0] - v[1] - v[2]; if (d < 1 || d > 40) continue; return num(`Medelvärdet av fyra tal är ${m}. Tre av talen är ${v.join(', ')}. Vilket är det fjärde talet?`, d, { skill: 'medelvärde baklänges' }); } }],
    },
    prob: {
      1: [() => { const n = P(NAMES), have = R(30, 99), cost = R(11, have - 5); return num(`${n} har ${have} kr och köper en glass för ${cost} kr. Hur mycket pengar har ${n} kvar?`, have - cost, { unit: 'kr', skill: 'textuppgift, ett steg' }); },
          () => { const x = R(3, 6), y = R(4, 9); return num(`I gruvan står ${x} kistor. I varje kista ligger ${y} diamanter. Hur många diamanter är det sammanlagt?`, x * y, { skill: 'textuppgift, ett steg' }); }],
      2: [() => { const n = P(NAMES), p = R(4, 8), k = R(4, 9), g = R(3, p * k - 5); return num(`Ett paket samlarkort innehåller ${p} kort. ${n} köper ${k} paket och ger bort ${g} kort. Hur många kort har ${n} kvar?`, p * k - g, { skill: 'textuppgift, två steg' }); },
          () => { const n = P(NAMES), k = R(3, 6), q = R(4, 12); return num(`${n} och ${k - 1} kompisar delar lika på ${k * q} smaragder. Hur många smaragder får var och en?`, q, { skill: 'delning' }); }],
      3: [() => { const A = R(12, 24) * 5, C = R(6, Math.floor(A / 5) - 1) * 5, na = R(1, 3), nc = R(2, 4); return num(`En biobiljett kostar ${A} kr för vuxna och ${C} kr för barn. Vad kostar det för ${na} ${na === 1 ? 'vuxen' : 'vuxna'} och ${nc} barn?`, na * A + nc * C, { unit: 'kr', skill: 'textuppgift, flera steg' }); },
          () => { const n = P(NAMES), c = R(15, 55), k = R(2, 3); return num(`${n} köper ${k} böcker som kostar ${c} kr styck och betalar med en 200-lapp. Hur mycket får ${n} tillbaka?`, 200 - k * c, { unit: 'kr', skill: 'växel' }); }],
      4: [() => { const price = R(8, 40) * 20, p = P([10, 25, 50]); return num(`En tröja kostar ${price} kr. Den sänks med ${p} %. Vad kostar tröjan nu?`, (price * (100 - p)) / 100, { unit: 'kr', skill: 'procent, rabatt' }); },
          () => { const persons = P([3, 4, 6]), pizzas = R(2, 4), price = R(15, 30) * persons; return num(`${persons} kompisar köper ${pizzas} pizzor för ${price} kr styck och delar lika på notan. Hur mycket betalar var och en?`, (pizzas * price) / persons, { unit: 'kr', skill: 'textuppgift, flera steg' }); },
          () => { const d = R(2, 5), t = 10 * R(1, 6); return num(`En kran droppar ${d} dl vatten per minut. Hur många liter har droppat efter ${t} minuter?`, (d * t) / 10, { unit: 'liter', skill: 'enheter i problem' }); }],
      5: [() => { const big = R(20, 60), small = R(5, big - 4); return num(`Två tal har summan ${big + small} och skillnaden ${big - small}. Vilket är det största talet?`, big, { skill: 'resonemang, två villkor' }); },
          () => { const k = P([2, 3, 4]), b = R(3, 8), word = { 2: 'dubbelt', 3: 'tre gånger', 4: 'fyra gånger' }[k]; return num(`Maja är ${word} så gammal som sin lillebror. Tillsammans är de ${(k + 1) * b} år. Hur gammal är Maja?`, k * b, { unit: 'år', skill: 'resonemang, delar' }); }],
    },
  };

  /* ---------- nivå 6: åk 7–8 (används i spelet, inte i kartläggningen) ---------- */
  T.tal[6] = [
    () => { const b = P([2, 3, 10]), e = b === 10 ? R(3, 6) : b === 2 ? R(4, 7) : R(2, 4); return num(`Vad är ${b}${sup(e)}?`, b ** e, { skill: 'potenser' }); },
    () => { const a = R(2, 9), b = R(2, 9), sa = P([-1, 1]), sb = sa === 1 ? -1 : P([-1, 1]); return num(`${sa < 0 ? '(−' + a + ')' : a} · ${sb < 0 ? '(−' + b + ')' : b}`, sa * a * sb * b, { skill: 'negativa tal, multiplikation' }); },
    () => { const x = R(11, 99) / 10, e = R(2, 4); return num(`Skriv ${fmt(x)} · 10${sup(e)} som ett vanligt tal.`, x * 10 ** e, { skill: 'tiopotenser' }); },
  ];
  T.addsub[6] = [
    () => { const a = R(11, 59) / 10, b = R(101, 999) / 100, c = R(5, 15); return num(`−${fmt(a)} + ${fmt(b)} − ${c}`, -a + b - c, { skill: 'negativa decimaltal' }); },
    () => { const a = R(5, 20), b = R(2, a - 1); return num(`(−${a}) − (−${b})`, -a + b, { skill: 'subtrahera negativa tal' }); },
  ];
  T.tabell[6] = [
    () => { const a = R(13, 19), b = R(4, 9); return num(`${a} · ${b}`, a * b, { skill: 'tabell 13–19' }); },
    () => { const a = R(11, 20); return num(`Vilket positivt tal gånger sig självt blir ${a * a}?`, a, { skill: 'kvadrattal' }); },
  ];
  T.muldiv[6] = [
    () => { const a = R(120, 480), b = R(21, 48); return num(`${a} · ${b}`, a * b, { skill: 'flersiffrig multiplikation' }); },
    () => { const d = R(2, 9) / 100, q = R(3, 12); return num(`${fmt(r6(d * q))} / ${fmt(d)}`, q, { skill: 'division med decimaltal' }); },
  ];
  T.brak[6] = [
    () => { const [a, b, c, d] = P([[2, 3, 3, 4], [1, 2, 2, 5], [3, 4, 2, 3], [2, 5, 5, 6], [3, 8, 4, 9], [4, 5, 1, 2]]); const n = a * c, m = b * d, g = gcd(n, m); return frac(`{${a}/${b}} · {${c}/${d}}`, n / g, m / g, { skill: 'multiplikation av bråk' }); },
    () => { const w1 = R(1, 3), w2 = R(1, 3); const [n1, d1, n2, d2] = P([[1, 2, 3, 4], [1, 3, 1, 2], [2, 3, 1, 6], [1, 4, 1, 2], [3, 4, 1, 2]]); const n = (w1 * d1 + n1) * d2 + (w2 * d2 + n2) * d1, m = d1 * d2, g = gcd(n, m); return frac(`${w1}{${n1}/${d1}} + ${w2}{${n2}/${d2}}`, n / g, m / g, { skill: 'blandad form' }); },
    () => { const [a, b, c, d] = P([[3, 4, 1, 2], [2, 3, 1, 6], [5, 6, 1, 3], [1, 2, 1, 4], [4, 5, 2, 5]]); const n = a * d, m = b * c, g = gcd(n, m); return frac(`{${a}/${b}} / {${c}/${d}}`, n / g, m / g, { skill: 'division med bråk' }); },
  ];
  T.dec[6] = [
    () => { const old = R(4, 20) * 20, p = P([10, 20, 25, 50]); return num(`Priset höjs från ${old} kr till ${old * (100 + p) / 100} kr. Med hur många procent höjdes priset?`, p, { unit: '%', skill: 'procentuell förändring' }); },
    () => { const p = P([15, 35, 45]), N = 20 * R(3, 25); return num(`Vad är ${p} % av ${N}?`, (p * N) / 100, { skill: 'procent av' }); },
    () => { let n = R(101, 999); if (n % 10 === 5) n++; return num(`Avrunda ${fmt(n / 1000)} till två decimaler.`, Math.round(n / 10) / 100, { skill: 'avrundning decimaltal' }); },
  ];
  T.geo[6] = [
    () => { const d = R(2, 20); return num(`En cirkel har diametern ${d} cm. Vad är omkretsen? Räkna med π ≈ 3,14.`, 3.14 * d, { unit: 'cm', skill: 'cirkelns omkrets' }); },
    () => { const [a, b, c] = P([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]]); return num(`En rätvinklig triangel har kateterna ${a} cm och ${b} cm. Hur lång är hypotenusan?`, c, { unit: 'cm', skill: 'Pythagoras sats' }); },
    () => { const b = R(4, 12), h = R(3, 9); return num(`Ett parallellogram har basen ${b} cm och höjden ${h} cm. Vad är arean?`, b * h, { unit: 'cm²', skill: 'parallellogram' }); },
  ];
  T.mat[6] = [
    () => { const a = R(2, 9); return num(`Hur många liter är ${a} m³?`, 1000 * a, { unit: 'liter', skill: 'volymenheter' }); },
    () => { const v = P([36, 54, 72, 90, 108]); return num(`En bil kör ${v} km/h. Hur många meter per sekund är det?`, v / 3.6, { unit: 'm/s', skill: 'enhetsbyte fart' }); },
    () => { const a = R(2, 9); return num(`Hur många kubikcentimeter är ${a} dm³?`, 1000 * a, { unit: 'cm³', skill: 'volymenheter' }); },
  ];
  T.alg[6] = [
    () => { for (;;) { const m = R(2, 4), k = R(1, 6), x = R(3, 12), c = R(1, m - 1), r = m * (x - k) - c * x; if (r <= 0) continue; return num(`${m}(x − ${k}) = ${c === 1 ? '' : c}x + ${r}. Vad är x?`, x, { skill: 'ekvation med parentes' }); } },
    () => { const x = R(2, 6), a = R(2, 4); return num(`Vad är värdet av ${a}x² om x = ${x}?`, a * x * x, { skill: 'potensuttryck' }); },
    () => { const a = R(2, 5), b = R(1, 6), c = R(1, a - 1), d = R(1, 6), x = R(2, 9); return num(`Förenkla ${a}x + ${b} − ${c === 1 ? '' : c}x + ${d} och räkna ut värdet när x = ${x}.`, (a - c) * x + b + d, { skill: 'förenkla uttryck' }); },
  ];
  T.stat[6] = [
    () => { const [t, k] = P([['båda visar sexa', 1], ['summan blir 11', 2], ['summan blir 3', 2], ['summan blir 7', 6]]); return frac(`Du slår två vanliga tärningar. Hur stor är chansen att ${t}? Svara med ett bråk.`, k, 36, { skill: 'sannolikhet, två händelser' }); },
    () => { for (;;) { const m = R(6, 15), rem = R(2, 30), nm = (5 * m - rem) / 4; if (!Number.isInteger(nm) || nm <= 0) continue; return num(`Medelvärdet av 5 tal är ${m}. Talet ${rem} tas bort. Vad blir medelvärdet av de 4 tal som är kvar?`, nm, { skill: 'medelvärde' }); } },
    () => { const v = Array.from({ length: 6 }, () => R(1, 20)), s = v.slice().sort((a, b) => a - b); return num(`Vad är medianen? &nbsp;${v.join(', ')}`, (s[2] + s[3]) / 2, { skill: 'median, jämnt antal' }); },
  ];
  T.prob[6] = [
    () => { const v = R(4, 12) * 10, t = R(2, 4), t2 = R(5, 8); return num(`Ett tåg kör ${v * t} km på ${t} timmar. Hur långt kör det på ${t2} timmar med samma fart?`, v * t2, { unit: 'km', skill: 'proportionalitet' }); },
    () => { const p = P([20, 25, 10]), orig = R(6, 30) * 20; return num(`Efter ${p} % rabatt kostar jackan ${orig * (100 - p) / 100} kr. Vad kostade jackan från början?`, orig, { unit: 'kr', skill: 'procent baklänges' }); },
    () => { const k = R(3, 6), price = R(4, 12), m = R(7, 12); return num(`${k} pennor kostar ${k * price} kr. Vad kostar ${m} pennor?`, m * price, { unit: 'kr', skill: 'proportionalitet' }); },
  ];

  function generate(areaId, level, avoid) {
    const pool = T[areaId][level];
    for (let i = 0; i < 25; i++) {
      const q = P(pool)();
      if (!avoid || !avoid.has(plain(q.text))) { q.area = areaId; q.level = level; return q; }
    }
    const q = P(pool)(); q.area = areaId; q.level = level; return q;
  }

  /* ---------- rättning ---------- */
  function parseNum(raw) {
    let s = String(raw).trim().replace(/[−–]/g, '-').replace(/[\s ]/g, '').replace(/[a-zA-ZåäöÅÄÖ°%²³]+\.?$/, '').replace(',', '.');
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    return Number(s);
  }
  function parseFrac(raw) {
    const s = String(raw).trim().replace(/[−–]/g, '-').replace(',', '.');
    let m = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (m) { const w = +m[1], n = +m[2], d = +m[3]; if (!d) return null; return { value: w + n / d, n: w * d + n, d }; }
    m = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (m) { const n = +m[1], d = +m[2]; if (!d) return null; return { value: n / d, n, d }; }
    const v = parseNum(s); return v === null ? null : { value: v, n: null, d: null };
  }
  function check(q, raw) {
    if (raw === null || raw === undefined || String(raw).trim() === '') return false;
    if (q.kind === 'choice') return Number(raw) === q.answer;
    if (q.kind === 'num') { const v = parseNum(raw); return v !== null && Math.abs(v - q.answer) < 1e-9; }
    if (q.kind === 'frac') {
      const f = parseFrac(raw); if (!f) return false;
      const ok = Math.abs(f.value - q.answer.n / q.answer.d) < 1e-9;
      if (!ok) return false;
      if (q.simplest) return f.n !== null && f.n === q.answer.n && f.d === q.answer.d;
      return true;
    }
    if (q.kind === 'time') {
      const m = String(raw).trim().match(/^(\d{1,2})\s*[:.]\s*(\d{2})$/);
      return !!m && (+m[1] % 24) === q.answer.h && +m[2] === q.answer.m;
    }
    return false;
  }
  function answerText(q) {
    if (q.kind === 'choice') return plain(q.choices[q.answer]);
    if (q.kind === 'frac') return q.answer.n + '/' + q.answer.d;
    if (q.kind === 'time') return pad(q.answer.h) + ':' + pad(q.answer.m);
    return fmt(q.answer) + (q.unit ? ' ' + q.unit : '');
  }
  function plain(text) {
    return String(text).replace(/\{([^}]+)\}/g, ' $1 ').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ---------- adaptiv logik ---------- */
  const MIN_Q = 4, MAX_Q = 5;
  function startLevel(grade) { return Math.max(1, Math.min(5, (Number(grade) || 4) - 2)); }
  function nextLevel(level, ok) { return ok ? Math.min(5, level + 1) : Math.max(1, level - 1); }
  function areaDone(asked) {
    if (asked.length >= MAX_Q) return true;
    if (asked.length < MIN_Q) return false;
    const a = asked[asked.length - 1], b = asked[asked.length - 2];
    return a.ok === b.ok; // två senaste pekar åt samma håll -> klart
  }
  function estimate(asked) {
    if (!asked || !asked.length) return null;
    let best = 0;
    for (let L = 1; L <= 5; L++) {
      const at = asked.filter((x) => x.level === L), c = at.filter((x) => x.ok).length;
      if (c > 0 && c >= at.length - c) best = L;
    }
    const atBest = asked.filter((x) => x.level === best);
    const correct = asked.filter((x) => x.ok).length;
    const ms = asked.filter((x) => x.ms).map((x) => x.ms);
    return {
      level: best,
      label: LEVEL_LABELS[best],
      secure: best > 0 && atBest.every((x) => x.ok),
      correct, total: asked.length,
      avgMs: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null,
    };
  }

  root.KGQ = { AREAS, LEVEL_LABELS, MAX_LEVEL: 6, generate, check, answerText, plain, fmt, startLevel, nextLevel, areaDone, estimate, _T: T };
})(typeof window !== 'undefined' ? window : globalThis);
