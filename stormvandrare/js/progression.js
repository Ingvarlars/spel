'use strict';
// Windrunnerns Ideal: varje nytt Ideal som svärs låser upp nya förmågor.
// Det första Idealets ord är seriens välkända motto; resten är egna formuleringar.

const IDEALS = [
  { title: 'Första idealet', words: 'Liv före död. Styrka före svaghet. Resa före mål.', grants: 'Lashings, Stormlight och Shardblade' },
  { title: 'Andra idealet', words: 'Jag ställer mig mellan de svaga och svärdet.', grants: 'Full Lashing (R) och Lasha fiende (F)' },
  { title: 'Tredje idealet', words: 'Mitt skydd väljer inte sida efter vänskap.', grants: 'Shardblade-spjut (G / mittenklick)' },
  { title: 'Fjärde idealet', words: 'Jag bär det jag inte kunde rädda – och reser mig ändå.', grants: 'Stormlight-rustning och en fjärde Lashing' },
  { title: 'Femte idealet', words: 'Jag skyddar mig själv, så att jag kan fortsätta skydda andra.', grants: 'Vindkallelse (C) och snabbare flygning' },
];

const ABILITY_IDEAL = { full: 2, lashEnemy: 2, spear: 3, armor: 4, wind: 5 };

const Progression = {
  ideal: 1,

  reset(ideal) { this.ideal = ideal || 1; },

  has(key) { return this.ideal >= (ABILITY_IDEAL[key] || 1); },

  // Svär nästa Ideal. Returnerar Idealet eller null om alla redan svurits.
  swearNext(game) {
    if (this.ideal >= IDEALS.length) return null;
    this.ideal++;
    this.apply(game.player);
    return IDEALS[this.ideal - 1];
  },

  // Påverkar spelarens egenskaper.
  apply(p) {
    const s = p.stats;
    s.maxLashes = this.ideal >= 4 ? 4 : 3;
    s.maxLight = 100 + (this.ideal - 1) * 20;
    s.armorLight = this.ideal >= 4;
    s.flySpeed = this.ideal >= 5 ? 1.25 : 1;
  },
};
