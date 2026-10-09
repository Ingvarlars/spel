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
| `js/player.js` | Windrunnern: rörelse relativt egen gravitation, Lashings, rusning, Stormlight, läkning |
| `js/abilities.js` | Shardblade (kombo, siktstöd, parering, skär block, spår) |
| `js/enemies.js` | Fiender, AI, projektiler, chockvågor, röda blixtar |
| `js/game.js` | Loop med fast tidssteg, skada, händelser, HUD (tillfällig canvas-HUD) |

Kontroller just nu: WASD, mus (pekarlås), vänsterklick = hugg, högerklick eller V =
Lashing mot siktet (samma håll igen = starkare), E = Lashing nedåt, Q = återställ
gravitationen, Mellanslag = hopp, Shift = Stormlight-rusning, piltangenter =
kamera.

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
- [ ] Steg 3: Stormlight, sfärer (laddade och mörka; man drar ljus på avstånd),
      gemhearts, knobweed, highstorm (varning, stormmur som sveper från öst,
      vind, lä bakom klippor via raycast österut, bråte, regn, blixtar, laddar
      sfärer). Den gamla 2D-prototypen i git-historiken (commit `45ac3c3`) har logiken.
- [ ] Steg 4: bossar (chasmfiend som klättrar ur klyftan, Thunderclast,
      Fused-mästare, slutboss), etappmål (gemheart/slutarena), Ideal som låser upp
      Full Lashing (R), spjut (F), Stormlight-rustning och vindkallelse (C).
- [ ] Steg 5: effekter, spren (windspren som följer vid flygning, painspren,
      gloryspren), ljud (Web Audio) och procedurell musik.
- [ ] Steg 6: kampanj med regioner (Splittrade slätterna, klyftornas djup,
      Frostlanden, stormens ursprung), karta, läger med färdighetsträd
      (gemhearts), berättelse och Lirras repliker, oändligt läge.
- [ ] Steg 7: menyer i skissboksstil, bestiarie med skisser, sparning
      (localStorage, tysta fel), prestationer.
- [ ] Steg 8: mobil (joystick, kamera-drag, knappar) och handkontroll (Gamepad API).
- [ ] Steg 9: balans (just nu för många kremlingar per platå), prestanda,
      länk från startsidan `index.html`, README (hur man spelar), PR mot `main`.

## Testa

```
node stormvandrare/test/run.js stormvandrare/test/smoke.js /tmp
```

Headless Chromium kör WebGL2 via SwiftShader (långsamt men fungerar). Titta på
skärmbilderna och se till att det står "Inga konsolfel".
