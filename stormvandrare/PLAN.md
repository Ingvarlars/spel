# Stormvandrare – plan och överlämning

Det här dokumentet gör att arbetet kan fortsätta i en ny session (till exempel om
användningen tar slut). Läs det först och uppdatera **Status** när du gjort klart
ett steg.

## Användarens krav (sammanfattat från chatten)

- Ett stort och avancerat spel inspirerat av *The Stormlight Archive*, i mappen
  `stormvandrare/`. Det får ta lång tid och använda mycket resurser.
- **Full 3D i tredje person** med en **egen WebGL2-motor**: inga bibliotek, inga
  byggverktyg och vanliga `<script>`-taggar (fungerar via `file://` och GitHub Pages).
- **Bokens officiella namn och termer får användas:** Stormlight, Lashing, Full
  Lashing, Shardblade, spren, highstorm, Windrunner, Ideal, chasmfiend, Parshendi,
  Fused, Thunderclast, sfärer, gemheart, Splittrade slätterna med mera.
  Huvudpersonen och följeslagaren (honorsprenen **Lirra**) är egna. Inga längre
  citat ur böckerna; texterna skrivs själv. Friskrivning finns i README.
- **Konststil:** inspirerad av seriens officiella konst utan att kopiera bilder:
  målerisk himmel, varma skiktade sandstensplatåer, blåvitt Stormlight och menyer
  som en skissbok på pergament.
- **Huvudkaraktären ska se bra ut** (senaste önskemålet): mjukt modellerad kropp,
  ansikte, hår, uniform, tygsimulerad rock och rika animationer.
- Allt UI och all dokumentation på **svenska**.
- Committa efter varje fungerande steg och testa i headless-webbläsare (inga
  konsolfel). Pusha till grenen `claude/neon-overlevare-game-dk8jey`. Skapa en PR
  mot `main` när spelet är klart.

## Arkitektur

| Fil | Ansvar |
| --- | --- |
| `js/engine/math.js` | vec3/mat4, brus, slump, `Pool` |
| `js/engine/gl.js` | WebGL2-hjälp, `Mesh`, `DynamicMesh`, `MeshBuilder` (lådor, cylindrar, sfärer, lofts och ellipsoider med jämna normaler), färghjälp `col()` |
| `js/engine/renderer.js` | Köbaserad renderare: skuggkarta, himmel med moln, ljussatta modeller (hemisfär, sol, 8 punktljus, dimma, mörka klyftor), instansering (gräs som drar sig undan), partiklar, band, MSAA och bloom |
| `js/input.js` | Tangentbord, mus med pekarlås, handlingar som köas |
| `js/world.js` | Platåer som extruderade polygoner (prismor), spiror, block som kan skäras, broar, klyftbotten, kollision mellan sfärer och prismor, raycast, meshar och dekor, teman (`THEMES`) |
| `js/camera.js` | Tredjepersonskamera vars upp-riktning följer spelarens gravitation |
| `js/models.js` | Vapen, Shardblade, kremling, voidspren och stenbjässe |
| `js/character.js` | Ny kroppsbyggare (`Body`), skelett (`Skeleton`), poser (`makePose`, `Anim`) och tyg (`Cloth`) |
| `js/effects.js` | Partiklar, skärmskakning, flytande text |
| `js/audio.js`, `js/music.js` | Ljud och procedurell musik |
| `js/spren.js` | Spren och Lirra |
| `js/player.js` | Windrunnern: rörelse relativt egen gravitation, Lashings, rusning, Stormlight, läkning |
| `js/abilities.js` | Shardblade (kombo, siktstöd, parering, skär block, spår) |
| `js/enemies.js` | Fiender, AI, projektiler, chockvågor, röda blixtar |
| `js/pickups.js` | Sfärer, gemhearts, knobweed |
| `js/storm.js` | Highstorm och Everstorm |
| `js/bosses.js` | Fyra bossar med träffzoner och faser |
| `js/progression.js` | Ideal, upplåsning av förmågor och färdighetsträd |
| `js/regions.js` | Regioner, etapper, berättelse, Lirras repliker, `Campaign` |
| `js/game.js` | Loop med fast tidssteg, skada, händelser, HUD (tillfällig canvas-HUD) |

Kontroller just nu: WASD, mus (pekarlås), vänsterklick = hugg, högerklick eller V =
Lashing mot siktet (samma håll igen = starkare), E = Lashing nedåt, Q = återställ
gravitationen, Mellanslag = hopp, Shift = Stormlight-rusning, R = Full Lashing,
F = Lasha fiende, G/mittenklick = spjut, C = vindkallelse, piltangenter = kamera.

## Status

- [x] 3D steg 1: motor, värld, rörelse, Lashings, kamera
- [x] 3D steg 2: Shardblade och åtta fiendetyper
- [x] Karaktärsombyggnad: `js/character.js` (mjuk kropp med fullt skelett,
      ansikte, hår, uniform med guldkanter och glyf, tygsimulerad rock som följer
      gravitation och fartvind, animationer för tomgång, gång/löpning, hopp, fall,
      flygning längs farten, landning, rusning och tre hugg, lysande ögon och
      Stormlight som ångar). Humanoida fiender använder samma kropp med
      karapaxplattor, hjälmar och mantlar. `test/hero.js` och `test/enemies.js`
      tar närbilder.
- [x] Steg 3: `js/pickups.js` (sfärer chip/mark/broam med sex ädelstenar, laddade
      lyser och lyser upp, Stormlight dras på avstånd, mörka laddas av stormen,
      gemhearts, knobweed, fiender tappar sfärer) och `js/storm.js` (förvarning,
      stormmur med egen shader, vind, lä via raycast österut, bråte, regn,
      blixtar, mörkare miljö, gräs drar sig undan). `test/storm.js`.
- [x] Steg 4: `js/bosses.js` (chasmfiend vid arenakanten som dyker ned och
      kommer upp igen, Thunderclast med kärnor fram/bak som man måste Lasha sig
      upp till, Himmelsk mästare/Fused som Lashar spelarens gravitation,
      Everstormens härold med röda blixtar, röd Everstorm från väst och omvänd
      gravitation), träffzoner, faser vid 66/33 %, varningsringar på marken.
      `js/progression.js` (fem Ideal, egna formuleringar utom första idealets
      motto) och förmågor i `js/abilities.js`: Full Lashing (R), Lasha fiende
      (F), Shardblade-spjut (G/mittenklick), Stormlight-rustning, vindkallelse
      (C). Etappflöde: nå arenan → boss → gemheart → Ideal → nästa etapp.
      Prestanda: fiender långt bort ritas som en bakad mesh (LOD), utan skugga.
      `test/boss.js` (BOSS=typ) och `test/chasm.js`.
- [x] Steg 5: `js/audio.js` (syntetiserade ljud, kompressor, eko, slingor för
      stormvind, regn, flygvind och Parshendis nynnande), `js/music.js`
      (procedurell drönare + dorisk kalimba-melodi, trummor i strid/boss/storm),
      `js/spren.js` (windspren, honorsprenen Lirra med `Spren.say()` för repliker,
      gloryspren, painspren, anticipationspren, fearspren, lifespren), röd
      skadeblixt och puls vid lågt liv, fotsteg.
- [x] Steg 6: `js/regions.js` (fyra regioner × tre etapper: Splittrade
      slätterna/chasmfiend, Klyftornas djup/Vev-Tarun, Frostlanden/Thunderclast,
      Ursprunget/härolden; berättelse om Arin och Lirra; Lirras handledning,
      första-gången-repliker, bossrepliker; `Campaign` med oändlig expedition).
      Teman i `THEMES` (färger, väder, stormtakt, `gen`: höjd, start på
      klyftbotten, svävande öar). Etapper utan boss slutar med väktare och en
      gemheart. Färdighetsträd `SKILLS` + `Progression.wealth/skills/buy` (ännu
      utan UI – kommer i steg 7). Väder: damm, sporer, snö, aska.
- [x] Steg 7: `js/storage.js` (sparfil i localStorage, tysta fel), `js/ui.js`
      (huvudmeny med svävande kamera, regionintro med karta, paus, etapp klar,
      game over, lägret, inställningar, om spelet), `js/codex.js` (bestiarie,
      anteckningar, 14 prestationer) och `js/sketch.js` (bläckteckningar av
      varelserna). Spelet startar i huvudmenyn; `test/run.js` hoppar direkt in i
      en etapp om scenariot inte sätter `module.exports.menu = true`.
      `test/menu.js` går igenom alla skärmar och kontrollerar sparningen,
      `test/codex.js` visar skisserna.
- [ ] Steg 8: mobil (joystick, kamera-drag, knappar) och handkontroll (Gamepad API).
- [ ] Steg 9: balans (just nu för många kremlingar per platå), prestanda,
      länk från startsidan `index.html`, README (hur man spelar), PR mot `main`.

## Testa

```
node stormvandrare/test/run.js stormvandrare/test/smoke.js /tmp
```

Headless Chromium kör WebGL2 via SwiftShader (långsamt men fungerar). Titta på
skärmbilderna och se till att det står "Inga konsolfel".
