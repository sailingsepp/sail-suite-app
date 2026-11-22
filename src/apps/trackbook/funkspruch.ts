import { positionText } from '@/core/koordinaten';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { STRINGS } from './strings';
import { escapeHtml } from '@/core/html';
import { lateinisch } from '@/core/umschrift';
import { marinaVoraus, VORAUS_MAX_SM } from '@/core/marinaVoraus';



export type FunkspruchArt = 'securite' | 'panpan' | 'mayday' | 'maydayrelay' | 'maydaycancel' | 'liegeplatz';

export interface FunkspruchDaten {
  schiffsname: string;
  mmsi: string;
  position: { lat: number; lon: number } | null;
  
  personenAnBord: number | null;
  
  laengeM?: number | null;
  breiteM?: number | null;
  tiefgangM?: number | null;
  
  ziel?: string | null;
  
  cog?: number | null;
  laeuft?: boolean;
  
  marinaVoraus?: { name: string; distanzSm: number } | null;
}

const $ = (id: string) => document.getElementById(id);

function wort(schluessel: string): string {
  return STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
}



function alsHtmlMitPlatzhaltern(text: string): string {
  return text
    .split(/(\[[^[\]]*\])/g)
    .map((teil) => (teil.startsWith('[') && teil.endsWith(']')
      ? `<span class="tb-funkspruch-platzhalter">${escapeHtml(teil)}</span>`
      : escapeHtml(teil)))
    .join('');
}


const POSITION_TIMEOUT_MS = 8_000;

function holeFrischePosition(): Promise<{ lat: number; lon: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: POSITION_TIMEOUT_MS },
    );
  });
}

function kennung(d: FunkspruchDaten): { name: string; mmsi: string } {
  return {
    name: d.schiffsname.trim() || '[VESSEL NAME]',
    mmsi: d.mmsi.trim() || '[MMSI]',
  };
}


function positionsZeile(d: FunkspruchDaten): string {
  return d.position
    ? positionText(d.position.lat, d.position.lon, 'en')
    : '[STATE YOUR POSITION, OR BEARING AND DISTANCE FROM A KNOWN POINT]';
}

function personenZeile(d: FunkspruchDaten): string {
  return d.personenAnBord !== null && d.personenAnBord > 0
    ? `${d.personenAnBord} PERSON${d.personenAnBord === 1 ? '' : 'S'} ON BOARD`
    : '[NUMBER] PERSONS ON BOARD';
}

function zeitUtc(t = Date.now()): string {
  const d = new Date(t);
  return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

const MONATE = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function datumUtc(t: number): string {
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONATE[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${zeitUtc(t)}`;
}

function baueSecurite(d: FunkspruchDaten): string {
  const { name, mmsi } = kennung(d);
  return [
    'Sécurité Sécurité Sécurité',
    'All stations, all stations, all stations',
    `This is sailing vessel ${name}, ${name}, ${name}`,
    `MMSI ${mmsi}`,
    '',
    '[nature of safety message, e.g. navigational hazard or weather warning]',
    `Position ${positionsZeile(d)}`,
    `Time of origin ${zeitUtc()}`,
    'Out',
  ].join('\n');
}

function bauePanPan(d: FunkspruchDaten): string {
  const { name, mmsi } = kennung(d);
  return [
    'Pan pan, pan pan, pan pan',
    'All stations, all stations, all stations',
    `This is sailing vessel ${name}, ${name}, ${name}`,
    `MMSI ${mmsi}`,
    '',
    'Pan pan',
    `Sailing vessel ${name}, MMSI ${mmsi}`,
    `My position is ${positionsZeile(d)}`,
    '[nature of urgency]',
    '[assistance required, if any]',
    personenZeile(d),
    '[any other information]',
    'Over',
  ].join('\n');
}

function baueMayday(d: FunkspruchDaten): string {
  const { name, mmsi } = kennung(d);
  return [
    'Mayday, mayday, mayday',
    `This is sailing vessel ${name}, ${name}, ${name}`,
    `MMSI ${mmsi}`,
    '',
    'Mayday',
    `Sailing vessel ${name}, MMSI ${mmsi}`,
    `My position is ${positionsZeile(d)}`,
    '[nature of distress]',
    'I require immediate assistance',
    personenZeile(d),
    '[any other information that may help rescuers]',
    'Over',
  ].join('\n');
}

function baueMaydayRelay(d: FunkspruchDaten): string {
  const { name, mmsi } = kennung(d);
  return [
    'Mayday relay, mayday relay, mayday relay',
    `This is sailing vessel ${name}, ${name}, ${name}`,
    `MMSI ${mmsi}`,
    '',
    'Mayday',
    '[name of vessel in distress]',
    '[MMSI or call sign of vessel in distress]',
    'Position [position of vessel in distress]',
    '[nature of distress]',
    '[assistance required]',
    '[number] persons on board',
    '[any other information, e.g. time the distress call was heard]',
    'Over',
  ].join('\n');
}


function baueMaydayCancel(d: FunkspruchDaten, urspruenglicherMayday: number | null): string {
  const { name, mmsi } = kennung(d);
  const zeitpunkt = urspruenglicherMayday
    ? datumUtc(urspruenglicherMayday)
    : '[date and time of your original distress alert]';
  return [
    'All stations, all stations, all stations',
    `This is sailing vessel ${name}`,
    `MMSI ${mmsi}`,
    `Position ${positionsZeile(d)}`,
    `Cancel my distress alert of ${zeitpunkt}`,
    `This is sailing vessel ${name}, MMSI ${mmsi}`,
    'Out',
  ].join('\n');
}


function zahlMeter(m: number | null | undefined, ersatz: string): string {
  return m != null && m > 0 ? `${Number(m.toFixed(1))} metres` : ersatz;
}

function baueLiegeplatz(d: FunkspruchDaten): string {
  const { name } = kennung(d);
  const ziel = d.ziel?.trim() ? lateinisch(d.ziel.trim()) : '';
  
  const voraus = d.marinaVoraus ? lateinisch(d.marinaVoraus.name) : '';
  const marina = voraus || (/marina/i.test(ziel) ? ziel : '[MARINA NAME]');
  return [
    '[Call on the marina working channel: Croatia Ch 17, Italy mostly Ch 9, UK Ch 80, otherwise see pilot book or marina website]',
    ...(d.marinaVoraus
      ? [`[Found ${d.marinaVoraus.distanzSm.toFixed(1)} NM ahead in OpenStreetMap: check the name before calling]`]
      : []),
    `${marina}, ${marina}, ${marina}`,
    `This is sailing yacht ${name}, ${name}, ${name}`,
    'Over',
    '',
    '[After the marina answers]',
    `${marina}, this is sailing yacht ${name}`,
    'Request berth for one night, tonight',
    `Sailing yacht, length ${zahlMeter(d.laengeM, '[LENGTH] metres')}, beam ${zahlMeter(d.breiteM, '[BEAM] metres')}, draught ${zahlMeter(d.tiefgangM, '[DRAUGHT] metres')}`,
    'Approaching from the [north / south / east / west], ETA [time]',
    personenZeile(d),
    'Over',
    '',
    '[After the marina gives a berth: repeat berth number and mooring instructions]',
    'Received, [berth number], thank you',
    `Sailing yacht ${name}, out`,
  ].join('\n');
}


const SUCHE_TIMEOUT_MS = 10_000;


let paket: import('@/core/vorrechnung').VorrechnungPaket | null = null;

function mitZeitschranke<T>(zusage: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([zusage, new Promise<null>((ok) => { setTimeout(() => ok(null), ms); })]);
}


async function plaetzeUm(pos: { lat: number; lon: number }): Promise<import('@/core/marinaVoraus').Liegeplatz[]> {
  const box = { swLat: pos.lat - 0.05, swLon: pos.lon - 0.07, neLat: pos.lat + 0.05, neLon: pos.lon + 0.07 };
  const { deckt, kandidatenInBox } = await import('@/core/vorrechnung');
  if (!paket || !deckt(paket.bbox, box)) {
    const { holeVorrechnung } = await import('@/data/vorrechnung');
    paket = await mitZeitschranke(holeVorrechnung(box), SUCHE_TIMEOUT_MS);
  }
  if (paket && deckt(paket.bbox, box)) {
    return kandidatenInBox(paket, box).map((k) => ({ name: k.name, art: k.art, ort: { lat: k.lat, lon: k.lon } }));
  }
  const { liegeplaetzeUmOrt } = await import('@/data/haefen');
  return liegeplaetzeUmOrt(pos, VORAUS_MAX_SM + 0.2, { timeoutMs: SUCHE_TIMEOUT_MS, versuche: 1, pauseMs: 0 });
}


async function sucheMarinaVoraus(d: FunkspruchDaten): Promise<FunkspruchDaten> {
  if (!d.laeuft || !d.position) return d;
  try {
    const treffer = marinaVoraus(d.position, d.cog ?? null, await plaetzeUm(d.position));
    return treffer ? { ...d, marinaVoraus: { name: treffer.name, distanzSm: treffer.distanzSm } } : d;
  } catch {
    return d;
  }
}


const LETZTER_MAYDAY_SCHLUESSEL = 'sail-suite:letzter-mayday';

function merkeMaydayZeit(): void {
  try { localStorage.setItem(LETZTER_MAYDAY_SCHLUESSEL, String(Date.now())); } catch {  }
}

function letzteMaydayZeit(): number | null {
  try {
    const t = Number(localStorage.getItem(LETZTER_MAYDAY_SCHLUESSEL));
    return Number.isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
}

interface FunkspruchTyp {
  art: FunkspruchArt;
  
  proword: string;
  
  klasse: string;
  bauen: (d: FunkspruchDaten) => string;
  
  brauchtPosition: boolean;
  
  vorbereiten?: (d: FunkspruchDaten) => Promise<FunkspruchDaten>;
}


const TYPEN: FunkspruchTyp[] = [
  { art: 'securite', proword: 'SÉCURITÉ', klasse: 'securite', bauen: baueSecurite, brauchtPosition: true },
  { art: 'panpan', proword: 'PAN PAN', klasse: 'panpan', bauen: bauePanPan, brauchtPosition: true },
  { art: 'mayday', proword: 'MAYDAY', klasse: 'mayday', bauen: baueMayday, brauchtPosition: true },
  { art: 'maydayrelay', proword: 'MAYDAY RELAY', klasse: 'mayday', bauen: baueMaydayRelay, brauchtPosition: false },
  {
    art: 'maydaycancel', proword: 'MAYDAY CANCEL', klasse: 'maydaycancel',
    bauen: (d) => baueMaydayCancel(d, letzteMaydayZeit()), brauchtPosition: true,
  },
  
  {
    art: 'liegeplatz', proword: 'BERTH REQUEST', klasse: 'routine', bauen: baueLiegeplatz, brauchtPosition: false,
    vorbereiten: sucheMarinaVoraus,
  },
];

let auswahlModal: ModalHandle | null = null;
let textModal: ModalHandle | null = null;
let holeDaten: () => FunkspruchDaten = () => ({ schiffsname: '', mmsi: '', position: null, personenAnBord: null });


let abbruchAngefordert = false;

function schliesseAuswahl(): void {
  $('tb-funkspruch-auswahl-modal')?.setAttribute('hidden', '');
  auswahlModal?.beimSchliessen();
}

function schliesseAuswahlDurchNutzer(): void {
  abbruchAngefordert = true;
  setzeAuswahlStatus('');
  schliesseAuswahl();
}

function schliesseVorlage(): void {
  $('tb-funkspruch-text-modal')?.setAttribute('hidden', '');
  textModal?.beimSchliessen();
}


function setzeAuswahlStatus(text: string): void {
  const statusEl = $('tb-funkspruch-auswahl-status');
  if (statusEl) statusEl.textContent = text;
  const gesperrt = text !== '';
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.tb-funkspruch-knopf')) {
    btn.disabled = gesperrt;
  }
}

async function zeigeVorlage(t: FunkspruchTyp): Promise<void> {
  abbruchAngefordert = false;
  let d = holeDaten();
  
  
  
  
  
  if (!d.position && t.brauchtPosition) {
    setzeAuswahlStatus(wort('funkspruch.ortLaeuft'));
    const frisch = await holeFrischePosition();
    setzeAuswahlStatus('');
    if (abbruchAngefordert) return; 
    d = { ...d, position: frisch };
  }
  if (t.vorbereiten) {
    setzeAuswahlStatus(wort('funkspruch.marinaSucht'));
    d = await t.vorbereiten(d);
    setzeAuswahlStatus('');
    if (abbruchAngefordert) return;
  }

  schliesseAuswahl();
  const text = t.bauen(d).toUpperCase();
  if (t.art === 'mayday') merkeMaydayZeit();
  const titelEl = $('tb-funkspruch-text-titel');
  if (titelEl) titelEl.textContent = t.proword;
  const textEl = $('tb-funkspruch-text');
  if (textEl) textEl.innerHTML = alsHtmlMitPlatzhaltern(text);
  const hinweisEl = $('tb-funkspruch-hinweis');
  if (hinweisEl) hinweisEl.textContent = wort('funkspruch.hinweis');
  $('tb-funkspruch-text-modal')?.removeAttribute('hidden');
  textModal?.beimOeffnen();
}

function oeffneAuswahl(): void {
  const liste = $('tb-funkspruch-liste');
  if (liste) {
    liste.innerHTML = '';
    for (const t of TYPEN) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tb-funkspruch-knopf ${t.klasse}`;
      const proword = document.createElement('span');
      proword.className = 'proword';
      proword.textContent = t.proword;
      const beschreibung = document.createElement('span');
      beschreibung.className = 'beschreibung';
      beschreibung.textContent = wort('funkspruch.' + t.art);
      btn.append(proword, beschreibung);
      btn.addEventListener('click', () => { void zeigeVorlage(t); });
      li.appendChild(btn);
      liste.appendChild(li);
    }
  }
  setzeAuswahlStatus('');
  $('tb-funkspruch-auswahl-modal')?.removeAttribute('hidden');
  auswahlModal?.beimOeffnen();
}


export function initFunkspruch(daten: () => FunkspruchDaten): void {
  holeDaten = daten;
  const auswahlEl = $('tb-funkspruch-auswahl-modal');
  if (auswahlEl) auswahlModal = initModal(auswahlEl, schliesseAuswahlDurchNutzer);
  const textEl = $('tb-funkspruch-text-modal');
  if (textEl) textModal = initModal(textEl, schliesseVorlage);

  $('btn-funkspruch')?.addEventListener('click', oeffneAuswahl);
  $('tb-funkspruch-auswahl-zu')?.addEventListener('click', schliesseAuswahlDurchNutzer);
  $('btn-funkspruch-text-zu')?.addEventListener('click', schliesseVorlage);
  $('btn-funkspruch-zurueck')?.addEventListener('click', () => {
    schliesseVorlage();
    oeffneAuswahl();
  });
}
