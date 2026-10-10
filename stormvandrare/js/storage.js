'use strict';
// Sparfil i localStorage: kampanj, färdigheter, skissbok, statistik,
// prestationer och inställningar. Om lagringen saknas fungerar spelet ändå.

const SAVE_KEY = 'stormvandrare-v1';

function defaultSave() {
  return {
    campaign: { region: 0, stage: 0, ideal: 1, started: false, finished: false },
    progress: { wealth: 0, skills: {} },
    codex: { seen: {}, notes: {} },
    totals: { kills: 0, time: 0, bosses: 0, deaths: 0, gemhearts: 0, parries: 0, carved: 0, stages: 0 },
    best: { endless: 0 },
    achievements: {},
    settings: {
      volume: 0.7, music: 0.55, sfx: 0.9, muted: false,
      sensitivity: 1, invertY: false, fov: 66, quality: 'high', shadows: true, bloom: true,
      particles: 1, numbers: true, shake: true, showFps: false,
    },
  };
}

const Save = {
  data: defaultSave(),

  load() {
    let raw = null;
    try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      this.merge(this.data, saved);
    } catch (e) { /* trasig sparfil: standardvärden */ }
  },

  // Kopiera bara kända fält med rätt typ (objekt slås ihop rekursivt).
  merge(target, src) {
    if (!src || typeof src !== 'object') return;
    for (const k in target) {
      const t = target[k], s = src[k];
      if (s === undefined || s === null) continue;
      if (typeof t === 'object' && t !== null && !Array.isArray(t)) {
        if (typeof s !== 'object') continue;
        // Öppna ordböcker (t.ex. färdigheter, sedda fiender) kopieras rakt av.
        if (Object.keys(t).length === 0) { for (const kk in s) if (typeof s[kk] !== 'object') t[kk] = s[kk]; }
        else this.merge(t, s);
      } else if (typeof t === typeof s) target[k] = s;
    }
  },

  save() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignorera */ }
  },

  reset() {
    const keep = this.data.settings;
    this.data = defaultSave();
    this.data.settings = keep;
    this.save();
  },
};
