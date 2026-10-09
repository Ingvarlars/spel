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

### Så spelar du

Styr farkosten och överlev så länge som möjligt. Farkosten **skjuter automatiskt**
mot närmaste fiende – du fokuserar på att röra dig, undvika skott och välja
uppgraderingar.

| Handling | Dator | Mobil |
| --- | --- | --- |
| Styr | WASD eller piltangenter | Sätt tummen var som helst och dra (virtuell joystick) |
| Dash (kort rusning, osårbar, nedkylning) | Mellanslag eller Shift | DASH-knappen nere till höger |
| Välj uppgradering | Klicka eller tangent 1 / 2 / 3 | Tryck på kortet |
| Paus | Esc eller P | ⏸-knappen |
| Ljud av/på | M eller 🔊-knappen | 🔊-knappen |

- **Vågor:** en ny våg börjar var 30:e sekund. Fienderna blir fler, tåligare och
  snabbare, och nya typer dyker upp.
- **Boss:** var 5:e våg kommer *Kärnan* med spiralskott, ringsalvor, rusningar och
  förstärkningar. Under halva livet går den in i raseri. En pil visar var den är.
- **XP och nivåer:** döda fiender tappar XP-kristaller (blå = 1, gröna = 5,
  rosa = 25). Vid ny nivå pausas spelet och du väljer 1 av 3 slumpade
  uppgraderingar. Ibland tappas ett hjärta (läker) eller en magnet (drar till sig
  all XP).

#### Fiender

| Fiende | Beteende |
| --- | --- |
| Jägare (rosa romb) | Jagar dig rakt |
| Rusare (gul pil) | Stannar, siktar (gul linje) och rusar sedan blixtsnabbt |
| Skytt (grön femhörning) | Håller avstånd och skjuter |
| Pansar (orange sexhörning) | Långsam men tål mycket och gör stor skada |
| Delare (lila cirkel) | Delar sig i två mindre när den dör – två gånger |

#### Vapen (max 5 samtidigt, 6 nivåer var)

| Vapen | Funktion |
| --- | --- |
| Pulsblaster | Startvapnet. Skjuter mot närmaste fiende |
| Kretsande blad | Energiblad som kretsar runt farkosten |
| Målsökande raketer | Söker upp fiender och exploderar med områdesskada |
| Blixtkedja | Blixt som hoppar mellan flera fiender |
| Novapuls | Chockvåg som skadar och knuffar bort fiender |

**Förmågor:** fler skott, snabbare eldtakt, genomträngande skott, sköld,
livsregenerering, XP-magnet, mer skada, mer max-liv, fart, kritiska träffar,
större område och pansar.

#### Menyer och sparning

Startmenyn, pausmenyn och game over-skärmen (tid överlevd, fiender dödade, nivå,
våg, bossar och skada) nås med mus, tangentbord eller touch. I inställningarna kan
du ändra ljud, volym, skärmskakning, skadesiffror, mängd partiklar och visa FPS.
Rekord, total statistik och inställningar sparas i webbläsarens `localStorage`.
Om lagringen är avstängd fungerar spelet ändå, men inget sparas.

## Stormvandrare

Ett stort 2D-actionspel från sidan i mappen `stormvandrare/`, ett ideellt fanspel
som utspelar sig i världen från Brandon Sandersons *The Stormlight Archive*.

> **Friskrivning:** Stormvandrare är ett icke-kommersiellt fanprojekt utan koppling
> till Brandon Sanderson, Dragonsteel eller förlagen. Världens namn och begrepp
> tillhör sina upphovspersoner. Huvudpersonen, följeslagaren, alla texter, all grafik,
> allt ljud och all kod är egna. Spelet får inte säljas.

Du är en ung Windrunner-väpnare på de Splittrade slätterna som under en highstorm
knyts samman med honorsprenen **Lirra**. Bandet ger dig **Stormlight**: ljus som
läker dig och låter dig ändra din egen gravitation med **Lashings**, framkalla en
**Shardblade** och svära nya **Ideal** som väcker starkare förmågor. Ta dig över
platåerna och ned i klyftorna, sök lä när highstormen drar fram och besegra
chasmfiends och värre för att skörda deras gemhearts.

### Arkitektur (plan)

Vanlig HTML, CSS och JavaScript med `<canvas>`, inga bibliotek och vanliga
`<script>`-taggar (fungerar via `file://` och GitHub Pages). Spelet delar ingen kod
med de andra spelen.

| Fil | Ansvar |
| --- | --- |
| `js/utils.js` | Matte, deterministisk slump, `Pool` (object pooling), konstanter |
| `js/storage.js` | Sparfil: kampanjframsteg, färdigheter, rekord, prestationer och inställningar (tysta fel) |
| `js/input.js` | Tangentbord, mus, handkontroll (Gamepad API) och pekskärm |
| `js/audio.js` | Ljudeffekter med Web Audio API |
| `js/music.js` | Procedurell musik (drönare, melodi och trummor som skiftar med läget) |
| `js/world.js` | Procedurgenererade banor (rutnät), kollision, terräng i förrenderade bitar, målad parallaxbakgrund och växter som drar sig undan |
| `js/regions.js` | Kampanjen: regioner (Splittrade slätterna, klyftorna, Frostlanden m.fl.), etapper, berättelse och Lirras repliker |
| `js/player.js` | Windrunnern: rörelse relativt egen gravitation, Lashings, Stormlight och läkning |
| `js/abilities.js` | Shardblade (kombo, skär löst berg), kastspjut, Full Lashing, Stormlight-rustning och vindkallelse |
| `js/enemies.js` | Fiendetyper och deras beteenden |
| `js/bosses.js` | Bossar med flera faser |
| `js/storm.js` | Highstormen: varning, stormmur, vind, lä bakom klippor, flygande bråte och laddning av sfärer |
| `js/pickups.js` | Sfärer (laddade och slocknade), gemhearts och helande örter |
| `js/progression.js` | Ideal, välsignelser under en etapp, färdighetsträd i lägret och prestationer |
| `js/codex.js` | Bestiarie och anteckningar som en skissbok med procedurella bläckteckningar |
| `js/effects.js` | Partiklar, spren (windspren, painspren, gloryspren m.fl.), skadesiffror och skärmskakning |
| `js/ui.js` | HUD, minikarta, menyer och skissboksgränssnitt |
| `js/game.js` | Spel-loop med fast tidssteg, tillstånd, kamera och samordning |

**Konststil:** målerisk himmel med dramatiskt ljus och diset djup, varma
sandstensplatåer och kallt blåvitt Stormlight, inspirerat av stämningen i seriens
officiella konst utan att kopiera någon bild. Menyerna ser ut som en forskares
skissbok med pergament, bläck och egna glyfliknande emblem.

**Byggordning:** (1) bana, rörelse, Lashings och kamera, (2) Shardblade och
fiender, (3) Stormlight, sfärer och highstorm, (4) bossar, etapper och Ideal,
(5) effekter, spren, ljud och musik, (6) kampanj, karta, läger och färdighetsträd,
(7) menyer, skissbok och sparning, (8) mobil och handkontroll, (9) balans och
finputs.
