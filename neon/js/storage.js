'use strict';
// Rekord, statistik och inställningar i localStorage.
// Om localStorage saknas eller är blockerat fungerar spelet ändå (inget sparas).

const STORAGE_KEY = 'neon-overlevare-v1';

function defaultSave() {
  return {
    best: { time: 0, kills: 0, level: 0, wave: 0 },
    totals: { games: 0, kills: 0, time: 0, bosses: 0 },
    settings: { sound: true, volume: 0.6, shake: true, numbers: true, particles: 'high', showFps: false },
  };
}

const Storage = {
  data: defaultSave(),

  load() {
    let raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      // Kopiera bara kända fält med rätt typ, så att trasig data ignoreras.
      const d = this.data;
      for (const group in d) {
        if (!saved || typeof saved[group] !== 'object' || saved[group] === null) continue;
        for (const k in d[group]) {
          if (typeof saved[group][k] === typeof d[group][k]) d[group][k] = saved[group][k];
        }
      }
    } catch (e) { /* trasig JSON: använd standardvärden */ }
  },

  save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignorera */ }
  },

  // Uppdaterar statistik efter en runda och returnerar vilka rekord som slogs.
  recordRun(run) {
    const b = this.data.best, t = this.data.totals;
    const records = {};
    for (const k in b) {
      if (run[k] > b[k]) { b[k] = run[k]; records[k] = true; }
    }
    t.games += 1;
    t.kills += run.kills;
    t.time += run.time;
    t.bosses += run.bosses;
    this.save();
    return records;
  },

  resetStats() {
    const fresh = defaultSave();
    this.data.best = fresh.best;
    this.data.totals = fresh.totals;
    this.save();
  },
};
