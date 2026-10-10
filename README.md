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

Ett stort 3D-actionspel i tredje person i mappen `stormvandrare/`, ett ideellt
fanspel som utspelar sig i världen från Brandon Sandersons *The Stormlight
Archive*. Öppna `stormvandrare/index.html` i en webbläsare med WebGL2 (aktuell
Chrome, Firefox, Edge eller Safari) eller följ länken från startsidan.

> **Friskrivning:** Stormvandrare är ett icke-kommersiellt fanprojekt utan koppling
> till Brandon Sanderson, Dragonsteel eller förlagen. Världens namn och begrepp
> tillhör sina upphovspersoner. Huvudpersonen Arin, följeslagaren Lirra, alla texter,
> all grafik, allt ljud och all kod är egna. Spelet får inte säljas.

Du är Arin, en ung löpare på de Splittrade slätterna som under en
highstorm knyts samman med honorsprenen **Lirra**. Bandet ger dig **Stormlight**:
ljus som läker dig och låter dig ändra din egen gravitation med **Lashings**,
framkalla en **Shardblade** och svära nya **Ideal** som väcker starkare förmågor.
Flyg mellan platåerna, sök lä när highstormen drar fram och besegra chasmfiends
och värre för att skörda deras gemhearts.

### Så spelar du

Varje etapp är en kedja av platåer över djupa klyftor. Målet ligger österut på en
stor arenaplatå. Där väntar väktare eller en boss, och etappen är klar när du tar
gemhearten. Stormlight är både bränsle och liv. Det läker dig, men varje Lashing och
rusning kostar ljus, och tar det slut medan du flyger faller du. Andas in ljus från
laddade **sfärer** (chip, mark och broam i sex ädelstensfärger). När highstormen
kommer laddas slocknade sfärer igen, men stormen gör ont om du inte står i lä bakom
en klippa.

| Handling | Tangentbord och mus | Handkontroll | Pekskärm |
| --- | --- | --- | --- |
| Gå / styr i luften | WASD | Vänster spak | Dra på vänster sida |
| Titta | Mus (klicka för att fånga den), piltangenter | Höger spak | Dra på höger sida |
| Hugg med Shardblade (tre i rad = avslut) | Vänsterklick | X eller RT (håll in) | Hugg (håll in) |
| Lasha dig mot siktet (upprepa = snabbare) | Högerklick eller V | LT | Lash |
| Lasha nedåt (nedslag) | E | LB | Ned |
| Ta tillbaka vanlig gravitation | Q | Styrkorset vänster | Åter |
| Hopp / Stormlight-rusning | Mellanslag / Shift | A / B | Hopp / Rusa |
| Full Lashing, Lasha fiende, spjut, vindkallelse | R, F, G (mittenklick), C | RB, styrkorset höger, Y, styrkorset upp | Knapparna längst upp |
| Karta | Tab | Back | Karta |
| Paus / ljud av | Esc eller P / M | Start | II |

Med handkontroll styr du menyerna med styrkorset, A och B. På pekskärm och med
handkontroll siktar Shardbladen och spjutet lite mer generöst.

#### Kampanjen

Fyra regioner med tre etapper var. Den sista etappen i varje region har en boss
med tre faser:

| Region | Miljö | Boss |
| --- | --- | --- |
| De Splittrade slätterna | Varma sandstensplatåer, broar och stenspiror | Chasmfiend, som klättrar upp ur klyftan |
| Klyftornas djup | Gröna klyftbottnar under platåerna | Vev-Tarun, en himmelsk Fused |
| Frostlanden | Snö, is och gles dimma | Thunderclast, det vandrande berget |
| Ursprunget | Svävande öar och den röda Everstormen | Everstormens härold |

Efter varje boss svär du nästa **Ideal**. Det låser upp Full Lashing och Lasha
fiende, Shardblade-spjut, Stormlight-rustning med en fjärde Lashing och till sist
vindkallelse. Sfärer du samlar blir valuta i **lägret**, där du köper färdigheter i
fyra grenar (Vind, Klinga, Stormlight och Kropp). Efter kampanjen väntar den
**oändliga expeditionen** med allt svårare slumpade etapper och ett rekord.

**Fiender:** kremlingar, Parshendi-krigare, -bågskyttar och -sköldbärare,
stormform som slungar röd blixt, flygande Fused, voidspren som suger Stormlight och
stenbjässar. Varje varelse du möter tecknas i **skissboken** med en procedurell
bläckteckning, tillsammans med anteckningar, 14 prestationer och statistik.

**Sparning:** framsteg, Ideal, färdigheter, skissbok, rekord och inställningar
sparas i `localStorage`. I inställningarna finns volym, musik, ljudeffekter,
muskänslighet, inverterad höjdled, synfält, grafikkvalitet, skuggor, glöd,
partiklar, skadesiffror, skärmskakning, minikarta och bildfrekvens.

### Arkitektur

Vanlig HTML, CSS och JavaScript med en **egen WebGL2-motor**. Spelet har inga
bibliotek och inga byggverktyg, och filerna laddas med vanliga `<script>`-taggar,
så det fungerar via `file://` och GitHub Pages.

| Fil | Ansvar |
| --- | --- |
| `js/engine/math.js` | Vektorer, matriser, brus, deterministisk slump, `Pool` |
| `js/engine/gl.js` | Shaderprogram, buffertar, `Mesh`, `DynamicMesh` och `MeshBuilder` (lådor, cylindrar, sfärer, loft, ellipsoider) |
| `js/engine/renderer.js` | Skuggkarta (PCF), målerisk himmel, dimma, punktljus, instansiering, partiklar, band, MSAA, bloom, tonmappning och stormväggens shader |
| `js/storage.js` | Sparfil i `localStorage` med tysta fel |
| `js/input.js` | Tangentbord, mus med pekarlås och gemensam rörelse/blick |
| `js/touch.js` | Virtuell joystick, kameradrag och knappar på pekskärm |
| `js/gamepad.js` | Handkontroll via Gamepad API, menystyrning och vibration |
| `js/world.js` | Procedurgenererade platåer (prismor), broar, spiror, klyftor, svävande öar, kollision, strålkastning och gräs |
| `js/camera.js` | Tredjepersonskamera som följer spelarens gravitation, med kollision och frustumgallring |
| `js/models.js` | Vapen och varelsemodeller (kremlingar, voidspren, stenbjässar) |
| `js/character.js` | Mjuka kroppar med fullt skelett, animation och en verlet-simulerad rock |
| `js/player.js` | Windrunnern: rörelse relativt egen gravitation, Lashings, rusning och Stormlight |
| `js/abilities.js` | Shardblade (kombo, parering, sikteshjälp, skär löst berg) och förmågorna |
| `js/enemies.js` | Åtta fiendetyper, projektiler, beteenden och detaljnivåer |
| `js/bosses.js` | Fyra bossar med träffzoner och faser |
| `js/storm.js` | Highstorm och Everstorm: varning, stormmur, vind, lä, blixtar och regn |
| `js/pickups.js` | Sfärer, gemhearts och helande örter |
| `js/progression.js` | Ideal, förmågor och färdighetsträdet |
| `js/spren.js` | Lirra och andra spren (windspren, gloryspren, painspren m.fl.) |
| `js/regions.js` | Regioner, etapper, Lirras repliker och den oändliga expeditionen |
| `js/codex.js` | Skissbokens varelser, anteckningar och prestationer |
| `js/sketch.js` | Bläckteckningar av 3D-modellerna (kontur och skraffering) |
| `js/audio.js`, `js/music.js` | Syntetiserade ljud och procedurell musik |
| `js/effects.js` | Partiklar, skärmskakning och skadesiffror |
| `js/ui.js` | Menyer i skissboksstil, karta, läger, skissbok och inställningar |
| `js/game.js` | Spel-loop med fast tidssteg, tillstånd, HUD, karta och händelser |

**Konststil:** målerisk himmel med dramatiskt ljus och disigt djup, varma
sandstensplatåer i skikt och kallt blåvitt Stormlight, inspirerat av stämningen i
seriens officiella konst utan att kopiera någon bild. Menyerna ser ut som en
forskares skissbok med pergament, bläck och egna glyfliknande emblem.

**Tester:** `node stormvandrare/test/run.js stormvandrare/test/<scenario>.js <katalog>`
kör ett scenario i headless Chromium (Playwright, WebGL2 via SwiftShader), sparar
skärmbilder i katalogen och rapporterar konsolfel. Scenarier finns för rök,
menyer, skissbok, pekskärm, handkontroll, karta, storm, bossar (`BOSS=typ`) och
regioner.
