'use strict';
// Svårighetskurva: XP per nivå (vågsystemet läggs till här i steg 4).

const Levels = {
  // XP som krävs för att gå från nivå `level` till nästa.
  xpForLevel(level) {
    const l = level - 1;
    return Math.round(5 + l * 7 + Math.pow(l, 1.8));
  },
};
