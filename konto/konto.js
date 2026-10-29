/* =====================================================================
   CYBERDYNE SPELPORTAL – GEMENSAM INLOGGNING
   Används av portalen och av alla spel med topplista:
     <script src="../konto/config.js"></script>
     <script src="../konto/konto.js"></script>
   Ett konto gäller i alla spel. Inloggningen sparas i webbläsaren för hela
   www.cyberdyne.se, så den som loggat in i ett spel är inloggad i alla.

   CyberKonto.online                       true om Supabase är inställt
   CyberKonto.session()                    { id, name, grade, token } eller null
   CyberKonto.login(namn, lösen, minns)    -> session
   CyberKonto.register(namn, lösen, åk, minns) -> session
   CyberKonto.logout()
   CyberKonto.changePassword(gammalt, nytt)
   CyberKonto.deleteAccount()              raderar kontot i alla spel
   CyberKonto.info()                       kontrollerar att inloggningen gäller
   CyberKonto.rpc(funktion, data)          anropar en databasfunktion
   CyberKonto.message(kod)                 felkod -> text på svenska
   CyberKonto.nameProblem(namn)            null eller förklaring
   ===================================================================== */
(function (root) {
  'use strict';
  const cfg = root.CYBER_CONFIG || {};
  const URL_ = String(cfg.supabaseUrl || '').trim().replace(/\/+$/, '');
  const KEY = String(cfg.supabaseKey || '').trim();
  const SKEY = 'cyberdyne.session';
  const ERR = {
    name_taken: 'Det smeknamnet är redan upptaget. Välj ett annat.',
    invalid_name: 'Välj ett annat smeknamn.',
    weak_password: 'Lösenordet ska ha minst 4 tecken.',
    wrong_login: 'Fel smeknamn eller lösenord.',
    locked: 'För många försök. Vänta 10 minuter och försök igen.',
    not_logged_in: 'Du har blivit utloggad. Logga in igen.',
    not_found: 'Hittade inget konto.',
    offline: 'Kunde inte nå servern. Försök igen om en stund.',
  };
  const BAD = ['kuk', 'fitt', 'jävl', 'javl', 'hora', 'neger', 'nazi', 'hitler', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'porn', 'penis', 'slyna', 'bög', 'knull', 'rasist'];

  function errCode(e) {
    const t = String((e && (e.body || e.message)) || '');
    return Object.keys(ERR).find((c) => t.indexOf(c) >= 0) || (e && e.status ? 'server' : 'offline');
  }
  function fail(code) { return Object.assign(new Error(code), { code }); }

  async function rpc(fn, body) {
    if (!URL_ || !KEY) throw fail('offline');
    const h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(KEY)) h.Authorization = 'Bearer ' + KEY; // äldre "anon"-nyckel
    let r;
    try { r = await fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(body || {}) }); }
    catch (e) { throw fail('offline'); }
    const txt = await r.text();
    if (!r.ok) { const e = new Error(txt); e.status = r.status; e.body = txt; e.code = errCode(e); throw e; }
    return txt ? JSON.parse(txt) : null;
  }

  /* ---- inloggningen i webbläsaren ---- */
  function session() {
    for (const st of [() => sessionStorage, () => localStorage]) {
      try { const v = st().getItem(SKEY); if (v) return JSON.parse(v); } catch (e) { /* */ }
    }
    return null;
  }
  function remembered() { try { return !!localStorage.getItem(SKEY); } catch (e) { return false; } }
  function save(s, remember) {
    const v = JSON.stringify(s);
    try { sessionStorage.setItem(SKEY, v); } catch (e) { /* */ }
    try { if (remember) localStorage.setItem(SKEY, v); else localStorage.removeItem(SKEY); } catch (e) { /* */ }
    return s;
  }
  function clear() {
    try { sessionStorage.removeItem(SKEY); } catch (e) { /* */ }
    try { localStorage.removeItem(SKEY); } catch (e) { /* */ }
  }

  function nameProblem(n) {
    if (!/^[A-Za-zÅÄÖåäöÉéÜü0-9 _-]{2,16}$/.test(n)) return 'Smeknamnet ska vara 2–16 tecken: bokstäver, siffror, mellanslag, - eller _.';
    const l = n.toLowerCase();
    if (BAD.some((w) => l.includes(w)) || /(^|[^a-zåäö])(sex|fan|skit|arsle)([^a-zåäö]|$)/.test(l)) return 'Välj ett annat smeknamn.';
    return null;
  }

  const api = {
    online: !!(URL_ && KEY),
    rpc, session, remembered, clear, nameProblem,
    message: (code) => ERR[code] || ERR.offline,
    async login(name, password, remember) {
      const rows = await rpc('login_player', { p_name: name, p_password: password });
      const r = rows && rows[0];
      if (!r || r.r_error) throw fail(r ? r.r_error : 'wrong_login');
      return save({ id: r.r_id, name: r.r_name, grade: r.r_grade, token: r.r_token }, remember);
    },
    async register(name, password, grade, remember) {
      const rows = await rpc('register_player', { p_name: name, p_password: password, p_grade: grade });
      return save({ id: rows[0].r_id, name, grade, token: rows[0].r_token }, remember);
    },
    async logout() {
      const s = session(); clear();
      if (s && s.token) { try { await rpc('logout_player', { p_token: s.token }); } catch (e) { /* */ } }
    },
    async changePassword(oldp, newp) { const s = session(); await rpc('change_password', { p_token: s && s.token, p_old: oldp, p_new: newp }); },
    async deleteAccount() { const s = session(); await rpc('delete_player', { p_token: s && s.token }); clear(); },
    async info() {
      const s = session(); if (!s || !s.token) return null;
      try {
        const rows = await rpc('konto_info', { p_token: s.token });
        const r = rows && rows[0]; if (!r) { clear(); return null; }
        return save(Object.assign(s, { name: r.r_name, grade: r.r_grade }), remembered());
      } catch (e) {
        if (e.code === 'not_logged_in') { clear(); return null; }
        return s; // servern svarar inte just nu: behåll inloggningen
      }
    },
    updateGrade(grade) { const s = session(); if (s) { s.grade = grade; save(s, remembered()); } },
  };
  root.CyberKonto = api;
})(window);
