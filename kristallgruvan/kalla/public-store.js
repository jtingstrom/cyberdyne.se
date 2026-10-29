/* =====================================================================
   KRISTALLGRUVAN – LAGRING (version 3: gemensamt konto för portalen)
   Inloggningen sköts av ../konto/konto.js (CyberKonto). Här sparas bara
   Kristallgruvans framsteg och poäng, via databasfunktionerna load_game,
   save_game och get_leaderboard med spelnamnet 'kristallgruvan'.
   Framstegen speglas också i webbläsaren, så spelet tål korta avbrott.
   Utan inställningar i konto/config.js körs spelet helt lokalt.
   ===================================================================== */
(function (root) {
  'use strict';
  const SPEL = 'kristallgruvan';
  const KEY = 'kristallgruvan.v3';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const E = () => root.KGEngine;
  const K = () => root.CyberKonto;

  class PublicStore {
    constructor() {
      this.mode = K() && K().online ? 'online' : 'local';
      this.profile = null; // { id, name, grade, token }
      this.q = Promise.resolve();
      this.status = 'ok';
      this.onStatus = null;
      this.onLoggedOut = null;
      this.answers = [];
    }
    static message(code) { return K() ? K().message(code) : 'Något gick fel.'; }

    /* ---- lokal spegel ---- */
    _get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return this._mem || {}; } }
    _set(m) { this._mem = m; try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* bara i minnet */ } }
    _mirror(p) { const m = this._get(); m.players = m.players || {}; m.players[p.kidId] = clone(p); this._set(m); }
    _forget(id) { const m = this._get(); if (m.players) delete m.players[id]; if (m.profiles) delete m.profiles[id]; this._set(m); }
    localProfiles() { return Object.values(this._get().profiles || {}); }
    saveLocalProfile(p) { const m = this._get(); m.profiles = m.profiles || {}; m.profiles[p.id] = { id: p.id, name: p.name, grade: p.grade }; this._set(m); }
    legacyProfiles() { return []; }
    markMigrated() {}
    // inloggningen ägs av CyberKonto (delas med alla spel)
    rememberSession() { /* sparas redan av CyberKonto vid inloggning */ }
    savedSession() { return this.mode === 'online' ? K().session() : null; }
    clearSession() { if (this.mode === 'online') K().clear(); }
    setStatus(s) { if (s !== this.status) { this.status = s; if (this.onStatus) this.onStatus(s); } }

    /* ---- konto ---- */
    async register(name, password, grade, remember) {
      if (this.mode !== 'online') return { id: (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()), name, grade, token: null };
      return K().register(name, password, grade, remember);
    }
    async login(name, password, remember) {
      if (this.mode !== 'online') {
        const p = this.localProfiles().find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!p) throw Object.assign(new Error('wrong_login'), { code: 'wrong_login' });
        return { id: p.id, name: p.name, grade: p.grade, token: null };
      }
      return K().login(name, password, remember);
    }
    async changePassword(oldp, newp) { await K().changePassword(oldp, newp); }
    async logout() {
      try { await this.q; } catch (e) { /* */ }
      if (this.mode === 'online') await K().logout();
      if (this.profile) { const m = this._get(); if (m.players) delete m.players[this.profile.id]; this._set(m); }
      this.profile = null; this.answers = [];
    }
    async deletePlayer() {
      if (this.mode === 'online') await K().deleteAccount();
      this._forget(this.profile.id); this.profile = null;
    }
    _lostSession() { this.clearSession(); if (this.onLoggedOut) this.onLoggedOut(); }

    /* ---- gränssnitt som spelet använder ---- */
    async getPlayer(id) {
      const local = (this._get().players || {})[id] || null;
      if (this.mode !== 'online') return local ? clone(local) : null;
      try {
        const rows = await K().rpc('load_game', { p_token: this.profile.token, p_spel: SPEL });
        const row = rows && rows[0];
        if (!row) return local ? clone(local) : null;
        const server = row.r_state && row.r_state.skills && row.r_state.creatures ? clone(row.r_state) : null; // bara ett giltigt sparat spel
        if (server) server.kidId = id;
        const best = !local || (server && (server.totalAnswered || 0) >= (local.totalAnswered || 0)) ? server || (local && clone(local)) : clone(local);
        if (best) best.pts = { pending: (local && local.pts && local.pts.pending) || 0, week: row.r_week, total: row.r_total, race: row.r_best };
        if (row.r_name && this.profile) this.profile.name = row.r_name;
        this.setStatus('ok');
        return best;
      } catch (e) {
        if (e.code === 'not_logged_in') { this._lostSession(); throw Object.assign(new Error('not_logged_in'), { code: 'not_logged_in' }); }
        this.setStatus('offline'); return local ? clone(local) : null;
      }
    }
    addAnswer(a) { this.answers.push(a); if (this.answers.length > 200) this.answers.splice(0, this.answers.length - 200); }
    savePlayer(p) {
      p.pts = p.pts || { pending: 0, week: 0, total: 0, race: 0 };
      if (this.mode !== 'online') {
        const wk = E().weekKey();
        if (p.pts.weekKey !== wk) { p.pts.week = 0; p.pts.weekKey = wk; }
        p.pts.week += p.pts.pending; p.pts.total += p.pts.pending; p.pts.pending = 0; p.pts.race = p.raceBest || 0;
        this.answers = [];
        this._mirror(p);
        return Promise.resolve();
      }
      this._mirror(p);
      const prof = this.profile;
      this.q = this.q.then(async () => {
        if (!prof || !prof.token || this.profile !== prof) return;
        const add = p.pts.pending || 0;
        const ans = this.answers.slice(0, 40);
        const state = clone(p); delete state.pts;
        try {
          const res = await K().rpc('save_game', { p_token: prof.token, p_spel: SPEL, p_grade: prof.grade, p_state: state, p_add_points: add, p_best: p.raceBest || 0, p_answers: ans });
          const r = res && res[0];
          p.pts.pending = Math.max(0, (p.pts.pending || 0) - add);
          this.answers.splice(0, ans.length);
          if (r) { p.pts.week = r.out_week; p.pts.total = r.out_total; p.pts.race = r.out_best; }
          this._mirror(p);
          this.setStatus('ok');
        } catch (e) {
          if (e.code === 'not_logged_in') this._lostSession(); else this.setStatus('offline');
        }
      });
      return this.q;
    }
    flush() { return this.q; }
    async leaderboard(kind, myId) {
      if (this.mode !== 'online') {
        const m = this._get(), wk = E().weekKey();
        const rows = Object.values(m.players || {}).map((p) => {
          const pr = (m.profiles || {})[p.kidId] || { name: '?' };
          const pts = p.pts || {};
          const score = kind === 'week' ? (pts.weekKey === wk ? pts.week || 0 : 0) : kind === 'race' ? p.raceBest || 0 : pts.total || 0;
          return { name: pr.name, score, me: p.kidId === myId };
        }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
        let rank = 0, last = null;
        return rows.map((r, i) => { if (r.score !== last) { rank = i + 1; last = r.score; } return Object.assign(r, { rank }); }).slice(0, 20);
      }
      const s = K().session();
      const rows = await K().rpc('get_leaderboard', { p_spel: SPEL, p_kind: kind === 'race' ? 'best' : kind, p_token: (s && s.token) || null });
      return (rows || []).map((r) => ({ rank: r.r_rank, name: r.r_name, score: r.r_score, me: r.r_me }));
    }
    async getFamily() { return null; }
    async saveFamily() {}
    async listSessions() { return []; }
  }

  root.KGPublicStore = PublicStore;
})(typeof window !== 'undefined' ? window : globalThis);
