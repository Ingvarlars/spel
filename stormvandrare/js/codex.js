'use strict';
// Skissboken: anteckningar om varelser, spren, platser och Ideal (egna texter),
// samt prestationer.

const CODEX_CREATURES = {
  crab: { name: 'Kremling', text: 'Små skalklädda djur som kryper ur varje spricka efter en storm. Ensamma är de ofarliga; i svärmar kan de övermanna en trött löpare.' },
  warrior: { name: 'Parshendi-krigare', text: 'Krigare med karapax som växer ur huden. De rör sig i takt med rytmer som bara de hör. Yxslaget laddas synligt – kliv undan när armen lyfts.' },
  archer: { name: 'Parshendi-bågskytt', text: 'Håller avstånd och skjuter i höga bågar. En Shardblade i rätt ögonblick slår pilen ur luften.' },
  shield: { name: 'Parshendi-sköldbärare', text: 'Den höga skölden tar emot allt som kommer framifrån. Den vänder sig långsamt – en Lashing över huvudet på den avgör striden.' },
  thunder: { name: 'Stormform', text: 'Parshendi i en form som bär röd blixt. Siktlinjen glöder svagt innan den låser sig. Flytta dig i sista stund.' },
  hover: { name: 'Fused – de Himmelska', text: 'Uråldriga krigare som rider vinden lika lätt som en Windrunner. De anfaller ovanifrån med långa spjut och flaggande tygband.' },
  leech: { name: 'Voidspren', text: 'En mörk spren som dras till Stormlight och suger det ur den som bär det. Den flyr när den blir träffad.' },
  brute: { name: 'Stenbjässe', text: 'Ett väsen av sten och glöd som slår marken så att chockvågor rullar ut. Hoppa över dem – eller flyg.' },
  chasmfiend: { name: 'Chasmfiend', text: 'Klyftornas härskare, stor som ett hus. Den bär en gemheart i bröstet, värd en förmögenhet. Huvudet är sårbart när den vrålar.' },
  heavenly: { name: 'Vev-Tarun, Himmelsk mästare', text: 'En Fused som jagar Windrunners för nöjes skull. Kan Lasha andras gravitation – en stund i fel riktning kan bli dödlig.' },
  thunderclast: { name: 'Thunderclast', text: 'Ett berg som har rest sig. Dess glödande kärnor sitter högt upp, bortom räckhåll för den som inte kan flyga.' },
  herald: { name: 'Everstormens härold', text: 'Den röda stormens röst – mer storm än varelse. Dess kärna syns bara när den släppt lös sina blixtar.' },
};

const CODEX_NOTES = {
  stormlight: { title: 'Stormlight', text: 'Ljus som stannar kvar i ädelstenar efter en highstorm. Den som andas in det läker, rör sig snabbare och kan – om ett spren har valt en – Lasha sin egen gravitation.', always: true },
  lashing: { title: 'Lashings', text: 'En Basic Lashing ändrar åt vilket håll man faller. Flera Lashings åt samma håll gör fallet snabbare. En Full Lashing binder fast det man rör vid.', always: true },
  spheres: { title: 'Sfärer', text: 'Glaskulor med ädelstenar i: chip, mark och broam. Laddade glöder de; tomma är de matta tills nästa storm.', always: true },
  highstorm: { title: 'Highstormen', text: 'Stormarna drar fram från öster med en vägg av vatten, sten och crem. Söker man lä på klippornas västra sida kan man överleva – och fylla sig med ljus.', always: true },
  lirra: { title: 'Lirra', text: 'En honorspren: ett litet ljus som valde Arin i en klyfta mitt i en storm. Hon är nyfiken, envis och säger alltid vad hon tycker.', always: true },
  windspren: { title: 'Windspren', text: 'Lekfulla band av ljus som följer vinden och den som flyger snabbt.', event: 'fly' },
  gloryspren: { title: 'Gloryspren', text: 'Gyllene ljusklot som samlas kring den som just vunnit något stort.', event: 'glory' },
  plains: { title: 'De Splittrade slätterna', text: 'Ett landskap sönderslaget i tusen platåer, med djupa klyftor emellan. Brolag bär sina broar från platå till platå.', event: 'region0' },
  chasms: { title: 'Klyftornas djup', text: 'Nere i klyftorna är det grönt och fuktigt. Lifespren svävar över frillväxter, och gamla skal vittnar om vad som jagar där.', event: 'region1' },
  frost: { title: 'Frostlanden', text: 'Stormarna har tappat sin kraft här. Snön lägger sig på klipporna, och tystnaden är nästan värre än vinden.', event: 'region2' },
  origin: { title: 'Ursprunget', text: 'Där highstormarna föds. Stenar svävar fritt i luften, och himlen ljusnar aldrig riktigt.', event: 'region3' },
};

const ACHIEVEMENTS = [
  { id: 'firstLash', name: 'Upp i himlen', desc: 'Lasha dig själv för första gången.' },
  { id: 'tripleLash', name: 'Fallande stjärna', desc: 'Lasha dig tre gånger åt samma håll.' },
  { id: 'slam', name: 'Nedslag', desc: 'Slå ned i marken i mycket hög fart.' },
  { id: 'fallKill', name: 'Gravitationens nåd', desc: 'Besegra en fiende med fallskada.' },
  { id: 'parry10', name: 'Pilfångare', desc: 'Parera tio pilar med din Shardblade.' },
  { id: 'carve', name: 'Stenhuggare', desc: 'Skär sönder ett block med din Shardblade.' },
  { id: 'storm', name: 'Stormens barn', desc: 'Överlev en hel highstorm.' },
  { id: 'chasmfiend', name: 'Gemheart', desc: 'Besegra en chasmfiend.' },
  { id: 'heavenly', name: 'Himlens herre', desc: 'Besegra Vev-Tarun.' },
  { id: 'thunderclast', name: 'Bergsfällare', desc: 'Besegra en Thunderclast.' },
  { id: 'herald', name: 'Stormen tystnar', desc: 'Besegra Everstormens härold.' },
  { id: 'ideal5', name: 'Femte idealet', desc: 'Svär alla fem Ideal.' },
  { id: 'endless5', name: 'Expeditionsledare', desc: 'Nå etapp 5 i den oändliga expeditionen.' },
  { id: 'rich', name: 'Broamens vän', desc: 'Samla 500 sfärer totalt i lägret.' },
];

const Achievements = {
  unlock(id, game) {
    const a = Save.data.achievements;
    if (a[id]) return;
    a[id] = true;
    Save.save();
    const def = ACHIEVEMENTS.find((x) => x.id === id);
    if (def && game) game.toast('Prestation: ' + def.name, def.desc);
  },
};
