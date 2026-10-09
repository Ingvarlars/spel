# spel

## Snake

Ett enkelt Snake-spel i HTML och JavaScript. Öppna `index.html` i en webbläsare för att spela.

- **Styr:** piltangenterna eller WASD (svep på mobil)
- **Paus:** mellanslag
- Rekordet sparas i webbläsaren

## Neon Överlevare

Ett top-down överlevnadsspel i neonstil. Spelet ligger i mappen `neon/`. Öppna
`neon/index.html` direkt i webbläsaren eller följ länken från startsidan.

### Arkitektur (plan)

Vanlig HTML, CSS och JavaScript med `<canvas>`. Inga ramverk, byggverktyg eller
externa bibliotek. Filerna laddas med vanliga `<script>`-taggar (inte ES-moduler)
i den ordning som beroendena kräver, så att spelet fungerar både via `file://` och
GitHub Pages.

| Fil | Ansvar |
| --- | --- |
| `js/utils.js` | Matte-hjälpare, `Pool` (object pooling), `SpatialGrid` (snabb kollision), sprite-cache för glöd |
| `js/storage.js` | Säker läsning/skrivning av rekord, statistik och inställningar i `localStorage` |
| `js/input.js` | Tangentbord, virtuell joystick och dash-knapp på mobil |
| `js/audio.js` | Ljudeffekter som genereras med Web Audio API, ljud av/på |
| `js/effects.js` | Partiklar, skadesiffror, chockvågor, blixtar och skärmskakning (poolade) |
| `js/player.js` | Farkosten: rörelse, dash, liv, sköld, regenerering |
| `js/weapons.js` | Vapen (definitioner, nivåer, avfyrning) och poolade skott |
| `js/enemies.js` | Fiendetyper, deras beteenden och bossen |
| `js/pickups.js` | XP-kristaller, hjärtan och magneter |
| `js/upgrades.js` | Uppgraderingar och slumpning av tre val vid ny nivå |
| `js/levels.js` | Vågsystem, svårighetskurva, bossvågor och XP-kurva |
| `js/ui.js` | HUD på canvas samt menyer (start, paus, nivå upp, game over, inställningar) |
| `js/game.js` | Spel-loop med fast tidssteg, tillstånd, kamera och kollisioner |

**Spel-loop:** `requestAnimationFrame` mäter verklig tid och kör simuleringen i fasta
steg på 1/60 s med en ackumulator. Spelet går därför lika fort på 60 Hz- och
144 Hz-skärmar.

**Prestanda:** skott, fiendeskott, partiklar, skadesiffror och kristaller återanvänds
via object pools. Kollisioner använder ett fast rutnät (spatial hash) med typade
arrayer, så 300+ fiender kan kollas utan att varje par jämförs. Glödande former ritas
en gång till små offscreen-canvasar och kopieras sedan med `drawImage` i stället för
dyr `shadowBlur` varje bildruta.

**Byggordning:** (1) rörelse och kamera, (2) fiender och skott, (3) XP och
uppgraderingar, (4) vågor och boss, (5) effekter och ljud, (6) menyer och sparning,
(7) mobilstöd.
