'use strict';
// Kampanjen: regioner, etapper, berättelse och Lirras repliker.
// Huvudpersonen Arin och honorsprenen Lirra är egna figurer i seriens värld.

const REGIONS = [
  {
    id: 'plains', name: 'De Splittrade slätterna', theme: 'plains', music: [146.83, [0, 2, 3, 5, 7, 9, 10]],
    intro: [
      'Arin var en av de lägsta i lägret – en löpare som bar vatten mellan platåerna.',
      'Under en highstorm, fastkilad i en klyfta, mötte Arin ett litet ljus som inte ville släppa taget: honorsprenen Lirra.',
      'Nu andas Arin in Stormlight. Platåerna väntar, och något stort rör sig i klyftorna.',
    ],
    stages: [
      { name: 'Första steget', length: 380, level: 1, boss: null, tutorial: true },
      { name: 'Brolagens väg', length: 480, level: 1.5, boss: null },
      { name: 'Klyftans härskare', length: 520, level: 2, boss: 'chasmfiend' },
    ],
  },
  {
    id: 'chasms', name: 'Klyftornas djup', theme: 'chasms', music: [130.81, [0, 2, 3, 5, 7, 8, 10]],
    intro: [
      'Under platåerna lever en annan värld: lysande lifespren, frillväxter och gamla bens skal.',
      'Fused har setts i klyftorna. En av dem, Vev-Tarun, jagar Windrunners.',
    ],
    stages: [
      { name: 'Ned i grönskan', length: 460, level: 2.5, boss: null },
      { name: 'Ekon av trummor', length: 520, level: 3, boss: null },
      { name: 'Den himmelska jägaren', length: 520, level: 3.5, boss: 'heavenly' },
    ],
  },
  {
    id: 'frost', name: 'Frostlanden', theme: 'frost', music: [164.81, [0, 2, 4, 7, 9, 12, 14]],
    intro: [
      'Väster om slätterna ligger Frostlanden, där stormarna har tappat sin kraft och snön faller tyst.',
      'Ett berg har rest sig och börjat gå. Människorna kallar det en Thunderclast.',
    ],
    stages: [
      { name: 'Snöns tystnad', length: 500, level: 4, boss: null },
      { name: 'Frusna klyftor', length: 560, level: 4.5, boss: null },
      { name: 'Det vandrande berget', length: 560, level: 5, boss: 'thunderclast' },
    ],
  },
  {
    id: 'origin', name: 'Ursprunget', theme: 'origin', music: [116.54, [0, 1, 3, 5, 7, 8, 10]],
    intro: [
      'Långt i öster föds highstormarna. Där svävar berg i luften och stormen vilar aldrig.',
      'Men en annan storm har vaknat – röd och hungrig. Dess härold väntar på Arin.',
    ],
    stages: [
      { name: 'Svävande öar', length: 520, level: 5.5, boss: null },
      { name: 'Stormens öga', length: 580, level: 6, boss: null },
      { name: 'Everstormens härold', length: 600, level: 7, boss: 'herald' },
    ],
  },
];

// Lirras repliker vid olika tillfällen (egna texter).
const LIRRA = {
  tutorial: [
    [0, 'Hej! Jag heter Lirra. Gå med W A S D och titta dig omkring med musen. Klicka i fönstret om musen inte fångas.'],
    [6, 'Ser du de lysande sfärerna? Gå nära så andas du in deras Stormlight.'],
    [14, 'Titta upp mot himlen och högerklicka – då Lashar du dig själv dit du tittar. Q tar tillbaka den vanliga gravitationen.'],
    [24, 'Lasha samma håll flera gånger för att falla snabbare. E Lashar dig rakt nedåt – perfekt för ett nedslag!'],
    [34, 'Vänsterklicka för att hugga med din Shardblade. Tre hugg i rad blir ett kraftfullt avslut.'],
    [46, 'Shift ger en rusning av Stormlight. Stormlight läker dig också – men det tar slut fort.'],
    [60, 'Målet ligger österut: den stora platån bortom de andra. Följ solen när den går upp!'],
  ],
  firstSeen: {
    crab: 'Kremlingar. Små, men de klättrar överallt.',
    warrior: 'Parshendi-krigare! Hör du hur de nynnar? De lyssnar efter rytmerna.',
    archer: 'Bågskyttar! Du kan slå bort pilarna med klingan om du hugger i rätt ögonblick.',
    shield: 'En sköldbärare. Skölden tar allt framifrån – kom bakifrån eller ovanifrån!',
    thunder: 'Stormform! Den röda blixten följer dig – flytta dig när siktlinjen låser.',
    hover: 'En Fused, en av de Himmelska. De flyger som vi. Var försiktig.',
    leech: 'Voidspren! Den suger ditt Stormlight. Hugg den innan den tömmer dig.',
    brute: 'En stenbjässe. Hoppa över chockvågorna!',
  },
  boss: {
    chasmfiend: 'En chasmfiend! Huvudet är svagt när den vrålar – och den har en gemheart.',
    thunderclast: 'Den är för hög för att nås från marken. Lasha dig upp till de glödande kärnorna!',
    heavenly: 'Vev-Tarun. Om din gravitation vänder sig – tryck Q!',
    herald: 'Härolden är bara sårbar efter sina attacker, när kärnan lyser upp. Spjutet tar hårdast!',
  },
  kills: ['Snyggt!', 'Fortsätt så!', 'Jag är stolt över dig.', 'Det där var vackert gjort.', 'Lätt som en vindspren!'],
  lowHp: ['Du blöder! Andas in Stormlight!', 'Försiktig – hitta sfärer eller knobweed!'],
  storm: ['Stormen sjunger. Lyssna – den fyller dig med ljus.', 'Stanna i lä bakom klippan tills muren passerat.'],
};

const Campaign = {
  region: 0,
  stage: 0,
  endless: false,
  endlessDepth: 0,

  config() {
    if (this.endless) return this.endlessConfig();
    const R = REGIONS[this.region];
    const S = R.stages[this.stage];
    return { region: R, regionIndex: this.region, stageIndex: this.stage, name: S.name, length: S.length, level: S.level, boss: S.boss, tutorial: !!S.tutorial, theme: THEMES[R.theme], music: R.music };
  },

  // Oändlig expedition: slumpad region, stigande svårighet och boss var tredje etapp.
  endlessConfig() {
    const d = this.endlessDepth;
    const R = REGIONS[d % REGIONS.length];
    const bosses = ['chasmfiend', 'heavenly', 'thunderclast', 'herald'];
    return {
      region: R, regionIndex: d % REGIONS.length, stageIndex: d, name: 'Expedition ' + (d + 1), length: 460 + Math.min(240, d * 15),
      level: 1.5 + d * 0.6, boss: d % 3 === 2 ? bosses[Math.floor(d / 3) % 4] : null, tutorial: false, theme: THEMES[R.theme], music: R.music, endless: true,
    };
  },

  // Nästa etapp efter en klar. Returnerar true om en ny region börjar.
  advance() {
    if (this.endless) { this.endlessDepth++; return false; }
    const R = REGIONS[this.region];
    if (this.stage < R.stages.length - 1) { this.stage++; return false; }
    if (this.region < REGIONS.length - 1) { this.region++; this.stage = 0; return true; }
    this.finished = true;
    return false;
  },
};
