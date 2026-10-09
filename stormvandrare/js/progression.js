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

// Färdighetsträdet i lägret. Kostnad i sfärer (marks) per nivå.
const SKILLS = [
  { id: 'lashCost', branch: 'Vind', name: 'Lätta Lashings', desc: 'Lashings kostar 15 % mindre Stormlight per nivå.', max: 3 },
  { id: 'lashDrain', branch: 'Vind', name: 'Uthållig flykt', desc: 'Flygning drar 15 % mindre Stormlight per nivå.', max: 3 },
  { id: 'dash', branch: 'Vind', name: 'Stormrusning', desc: 'Rusningen kostar 20 % mindre och går längre.', max: 2 },
  { id: 'blade', branch: 'Klinga', name: 'Skarpare egg', desc: '+12 % skada med Shardblade per nivå.', max: 5 },
  { id: 'speed', branch: 'Klinga', name: 'Snabba hugg', desc: '+8 % hugghastighet per nivå.', max: 3 },
  { id: 'reach', branch: 'Klinga', name: 'Lång räckvidd', desc: '+10 % räckvidd per nivå.', max: 2 },
  { id: 'light', branch: 'Stormlight', name: 'Djupare andetag', desc: '+15 max Stormlight per nivå.', max: 4 },
  { id: 'heal', branch: 'Stormlight', name: 'Snabb läkning', desc: 'Läker 20 % snabbare och billigare per nivå.', max: 3 },
  { id: 'draw', branch: 'Stormlight', name: 'Ljusets dragning', desc: 'Drar Stormlight ur sfärer på 25 % längre avstånd.', max: 2 },
  { id: 'hp', branch: 'Kropp', name: 'Härdad', desc: '+15 max-liv per nivå.', max: 4 },
  { id: 'armor', branch: 'Kropp', name: 'Karapaxlärdom', desc: 'Tar 5 % mindre skada per nivå.', max: 3 },
];
const SKILL_COST = [40, 80, 140, 220, 320];

const Progression = {
  ideal: 1,
  skills: {},
  wealth: 0,

  reset(ideal) { this.ideal = ideal || 1; },

  rank(id) { return this.skills[id] || 0; },
  cost(id) { return SKILL_COST[this.rank(id)] || Infinity; },
  canBuy(id) {
    const s = SKILLS.find((k) => k.id === id);
    return s && this.rank(id) < s.max && this.wealth >= this.cost(id);
  },
  buy(id) {
    if (!this.canBuy(id)) return false;
    this.wealth -= this.cost(id);
    this.skills[id] = this.rank(id) + 1;
    return true;
  },

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
    const b = basePlayerStats();
    const r = (id) => this.rank(id);
    s.maxLashes = this.ideal >= 4 ? 4 : 3;
    s.maxLight = b.maxLight + (this.ideal - 1) * 20 + r('light') * 15;
    s.armorLight = this.ideal >= 4;
    s.flySpeed = this.ideal >= 5 ? 1.25 : 1;
    s.lashCost = b.lashCost * (1 - 0.15 * r('lashCost'));
    s.lashDrain = b.lashDrain * (1 - 0.15 * r('lashDrain'));
    s.dashCost = b.dashCost * (1 - 0.2 * r('dash'));
    s.bladeDamage = b.bladeDamage * (1 + 0.12 * r('blade')) * (1 + (this.ideal - 1) * 0.08);
    s.bladeSpeed = b.bladeSpeed * (1 + 0.08 * r('speed'));
    s.bladeReach = b.bladeReach * (1 + 0.1 * r('reach'));
    s.healRate = b.healRate * (1 + 0.2 * r('heal'));
    s.healCost = b.healCost * (1 - 0.12 * r('heal'));
    s.drawRange = b.drawRange * (1 + 0.25 * r('draw'));
    s.maxHp = b.maxHp + r('hp') * 15 + (this.ideal - 1) * 10;
    s.armor = 0.05 * r('armor');
  },
};
