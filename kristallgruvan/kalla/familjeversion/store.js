/* =====================================================================
   KRISTALLGRUVAN – LAGRINGSDEL
   Resten av appen pratar BARA med det här gränssnittet:

     store.mode                      'claude' | 'local' | 'http'
     store.listKids()             -> Promise<Kid[]>
     store.saveKid(kid)           -> Promise
     store.listSessions(kidId)    -> Promise<Session[]>   (nyast först)
     store.saveSession(session)   -> Promise
     store.getPlayer(kidId)       -> Promise<Player|null>  (spelets data, se engine.js)
     store.savePlayer(player)     -> Promise
     store.getFamily(familyId)    -> Promise<Family|null>  { id, rewards: [{id, name, cost}] }
     store.saveFamily(family)     -> Promise
     store.exportAll()            -> Promise<{schema, kids, sessions, players, families}>

   Datamodell (schema 'kristallgruvan/1'):
     Kid     { id, familyId, name, grade, createdAt }
     Session { id, kidId, familyId, schema, startedAt, updatedAt, finishedAt,
               areas: { [areaId]: { level, done, asked: Answer[], result } } }
     Answer  { level, q, given, correct, ok, ms, skill, at }

   Flytt till egen server (t.ex. PocketBase i Docker): skriv en HttpStore
   med samma metoder (exempel längst ned) och byt rad i initStore().
   familyId finns redan i datat så att flera familjer kan delas upp senare.
   ===================================================================== */
(function (root) {
  'use strict';
  const SCHEMA = 'kristallgruvan/1';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const byNewest = (a, b) => String(b.startedAt).localeCompare(String(a.startedAt));

  /* ---------- claude.ai-databasen ----------
     OBS: databasen levererar frysta (oföränderliga) objekt, så allt som läses
     kopieras med clone() innan appen ändrar i det. */
  class ClaudeStore {
    constructor(db) { this.db = db; this.mode = 'claude'; this.q = Promise.resolve(); this.onError = null; }
    _write(fn) {
      // en skrivning i taget, i ordning
      const p = this.q.then(fn).catch(async (e) => {
        if (e && e.code === 'unavailable') { await new Promise((r) => setTimeout(r, 600 + Math.random() * 800)); return fn(); }
        throw e;
      });
      this.q = p.catch((e) => { console.warn('Kunde inte spara', e); if (this.onError) this.onError(e); });
      return p;
    }
    async listKids() { const s = await this.db.collection('kids').get(); return s.docs.map((d) => clone(d.data())); }
    saveKid(kid) { const k = clone(kid); return this._write(() => this.db.doc('kids/' + k.id).set(k)); }
    async listSessions(kidId) {
      const s = await this.db.collection('sessions').where('kidId', '==', kidId).get();
      return s.docs.map((d) => clone(d.data())).sort(byNewest);
    }
    saveSession(session) { const s = clone(session); return this._write(() => this.db.doc('sessions/' + s.id).set(s)); }
    async getPlayer(kidId) { const d = await this.db.doc('players/' + kidId).get(); return d.exists ? clone(d.data()) : null; }
    savePlayer(pl) { const x = clone(pl); return this._write(() => this.db.doc('players/' + x.kidId).set(x)); }
    async getFamily(id) { const d = await this.db.doc('families/' + id).get(); return d.exists ? clone(d.data()) : null; }
    saveFamily(f) { const x = clone(f); return this._write(() => this.db.doc('families/' + x.id).set(x)); }
    async exportAll() {
      const all = async (c) => (await this.db.collection(c).get()).docs.map((d) => d.data());
      return { schema: SCHEMA, exportedAt: new Date().toISOString(), kids: await all('kids'), sessions: await all('sessions'), players: await all('players'), families: await all('families') };
    }
  }

  /* ---------- reserv: bara i den här webbläsaren ---------- */
  class LocalStore {
    constructor() { this.mode = 'local'; this.key = 'kristallgruvan.v1'; this.mem = null; }
    _load() {
      if (this.mem) return this.mem;
      try { this.mem = JSON.parse(localStorage.getItem(this.key)) || null; } catch (e) { this.mem = null; }
      if (!this.mem) this.mem = { kids: {}, sessions: {} };
      return this.mem;
    }
    _save() { try { localStorage.setItem(this.key, JSON.stringify(this.mem)); } catch (e) { /* bara i minnet */ } }
    async listKids() { return Object.values(this._load().kids); }
    async saveKid(kid) { this._load().kids[kid.id] = clone(kid); this._save(); }
    async listSessions(kidId) { return Object.values(this._load().sessions).filter((s) => s.kidId === kidId).sort(byNewest); }
    async saveSession(s) { this._load().sessions[s.id] = clone(s); this._save(); }
    async getPlayer(kidId) { const m = this._load(); return (m.players || {})[kidId] || null; }
    async savePlayer(pl) { const m = this._load(); m.players = m.players || {}; m.players[pl.kidId] = clone(pl); this._save(); }
    async getFamily(id) { const m = this._load(); return (m.families || {})[id] || null; }
    async saveFamily(f) { const m = this._load(); m.families = m.families || {}; m.families[f.id] = clone(f); this._save(); }
    async exportAll() { const m = this._load(); return { schema: SCHEMA, exportedAt: new Date().toISOString(), kids: Object.values(m.kids), sessions: Object.values(m.sessions), players: Object.values(m.players || {}), families: Object.values(m.families || {}) }; }
  }

  /* ---------- exempel för framtida server (används inte än) ----------
  class HttpStore {
    constructor(baseUrl, token) { this.mode = 'http'; this.base = baseUrl; this.token = token; }
    _f(path, opt = {}) {
      return fetch(this.base + path, { ...opt, headers: { 'Content-Type': 'application/json', Authorization: this.token } })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
    listKids()          { return this._f('/api/collections/kids/records').then((r) => r.items); }
    saveKid(k)          { return this._f('/api/collections/kids/records/' + k.id, { method: 'PATCH', body: JSON.stringify(k) }); }
    listSessions(kidId) { return this._f(`/api/collections/sessions/records?filter=(kidId='${kidId}')&sort=-startedAt`).then((r) => r.items); }
    saveSession(s)      { return this._f('/api/collections/sessions/records/' + s.id, { method: 'PATCH', body: JSON.stringify(s) }); }
    exportAll()         { ... }
  }
  -------------------------------------------------------------------- */

  async function initStore() {
    try {
      if (root.claude && typeof root.claude.use === 'function') {
        const db = await Promise.race([root.claude.use('db'), new Promise((r) => setTimeout(() => r(null), 10000))]);
        if (db) {
          await db.collection('kids').limit(1).get(); // provläsning
          return new ClaudeStore(db);
        }
      }
    } catch (e) { console.warn('Molnlagring ej tillgänglig, sparar lokalt', e); }
    return new LocalStore();
  }

  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  root.KGStore = { initStore, SCHEMA, uid };
})(typeof window !== 'undefined' ? window : globalThis);
