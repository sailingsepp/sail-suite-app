import 'leaflet/dist/leaflet.css';
import { aktualisiereVorhalt, vorhaltWeg } from './vorhalt';
import { naechsterSonnenwechsel } from '@/core/tagesende';
import { initAngelegt, pruefeAngelegt } from './angelegt';
import { besitzeTab } from './zweiterTab';
import { hellerRand, mondhoehe, mondphase, mondzeiten } from '@/core/moon';
import { mondSvg } from '@/map/mondbild';
import { setzeTiefgang } from '@/map/seekarte';
import { escapeHtml } from '@/core/html';
import { wetterOrt } from '@/core/zielwetter';
import { zeichneZielwetter } from './zielwetter';
import { eintragArtName, eintragInhalt, liegeartName, LIEGEARTEN, type Liegeart } from '@/core/logbuchText';
import { antriebsZeit, eintragsZeit, positionZurZeit, uhrzeitFeld } from '@/core/logbuchBearbeiten';
import '@/shell/tokens.css'; 
import './style.css';

import { setzeAppTexte } from '@/shell/strings';
import { initSprache, aktuelleSprache, aufSprachwechsel, sichereSpracheWahl } from '@/shell/sprache';
import { initTheme, nimmGemerktenOrt, setzeReferenzOrt, sichereThemeWahl } from '@/shell/theme';
import { merktSich, setzeMerktSich } from '@/shell/merken';
import { initTour } from '@/shell/tour';
import { initUserMenu, liesSitzungsToken, liesEigeneNutzerId } from '@/shell/session';
import { sichereFahrten, gleicheMotordatenAb } from '@/data/spurablage';
import { holeFahrtenZurueck } from './zurueckholen';
import { initModal } from '@/shell/modal';
import { icon, initIcons, type IconName } from '@/shell/icons';
import { lage, type Lage } from '@/core/lageSymbol';
import { wechselAusEintraegen } from '@/core/antriebsbilanz';
import { initHandbuchModal } from '@/shell/handbuch';
import { initSupport } from '@/shell/support';
import { kursGrad, nf, uhrLtVon, zeitzoneText } from '@/core/time';
import { abstandZurYacht } from '@/core/fehlstart';
import { positionText } from '@/core/koordinaten';
import { STRINGS, TITLE, DESCRIPTION, TOUR_STEPS } from './strings';
import {
  initAufzeichnung, setzeNurLesen, starte, pausiere, fortsetzen, aktiviereAnkerwache, hebeAnkerwacheAuf,
  beendeToernJetzt,
  wachHolen, neuerEintrag, setzeAntrieb,
  aktuelleFixe, aktuelleManuellePausen, setzeToern, aktuellerZustand, ergaenzeEintrag, ergaenzeEintragText,
  uebernehmeFixe,
  aktualisiereFahrt,
  type Zustand,
} from './aufzeichnung';
import {
  initKarte, zeichneSpur, setzePosition, setzeVorauslinie, entferneVorauslinie, zentriere, karteNeuMessen, sichtbarerAusschnitt,
  setzeKurs, ausrichtung, setzeAusrichtung, setzeDrehRueckruf, alsKartenelement, type Ausrichtung,
} from './karte';
import { kursFuerKarte } from '@/core/kursoben';
import { geglaetteteSog } from '@/core/navigation';
import { initToernAuswahl, oeffneToernFenster } from './toernauswahl';
import { initCoastguard, aktualisiereCoastguard } from './coastguard';
import { initFunkspruch } from './funkspruch';
import { initSeewetter, seewetterNeuZeichnen } from './seewetter';
import { initGezeiten, gezeitenNeuZeichnen, gezeitenStreifen } from './gezeiten';
import { initKompendium } from '@/shell/kompendium';
import { initTechnik } from '@/shell/technik';
import { initWarnlage } from './warnlage';
import {
  initMotorwache, pruefeMotorwache, motorwacheToern, motorwacheZuruecksetzen, motorwacheVonHand, letzterKlang,
} from './motorwache';
import { initWetter } from './wetter';
import { initAis, pruefeAis, aisNeuZeichnen, aisRuhtLiegend } from './ais';
import { initStationen, pruefeStationen } from './stationen';
import { initWarnblock } from './warnblock';


const AIS_RUHE_AB_STILLSTAND_S = 120;
import { initSeegrenze, pruefeSeegrenze } from './seegrenze';
import { initMeeresgebiet, pruefeMeeresgebiet } from './meeresgebiet';
import { initAnkerwache, pruefeAnkerwache, oeffneAnkerwacheSetup } from './ankerwache';
import { initDatensicherung } from './datensicherung';
import {
  initWetterlog, pruefeWetterlog, zeigeWetterkopf, zeigeGenauigkeit, wetterlogZuruecksetzen,
} from './wetterlog';
import { initFoto, zeigeVorschau } from './foto';
import { initLogBearbeiten, macheBedienbar, listeGesperrt } from './logzeilen';
import { initSpurimport } from './spurimport';
import { initStatistik, zeigeStatistik } from './statistik';
import { ergaenzeRevier, revierZuruecksetzen } from './revier';
import { entsperreBeiBeruehrung, entsperreTon } from './ton';
import { initAnsage, probe, sage } from './ansage';
import { ANSAGE } from '@/core/ansagen';
import { initMikrofon, mikrofonStarten, motorklangAn, setzeMotorklangAn, aufMikrofonStatus, mikrofonStatus } from './mikrofon';
import { baueGpx, gpxDateiname, biete } from './export';
import { loeseOrteAuf } from './orte';
import { initNetz, aufNetzwechsel, istOnline } from './netz';
import { initLivestream, liveBeiZustand, meldeStopp } from './livestream';
import { initTankstopp, sucheTankstelle, merkeTankstelle, nachWeiterfahren, beobachteUnterwegs } from './tankstopp';
import { ladeRevierVor, vorladePlan, kachelZahl, brichVorladenAb, MAX_KACHELN } from './vorladen';
import {
  laufendeFahrt, alleFahrten, alleToerne, ladeFixe, ladeEintraege,
  aktuellerToern, fahrtenZuToern,
} from '@/data/logdb';
import { werteSpurAus, lueckenAmSelbenOrt, schnittSeit, type Luecke } from '@/core/spur';
import { initNavigation, navTakt, navStopp, merkeRegion, zielDerRoute } from './navigation';
import { ladeNavDatenVor } from '@/data/navroute';
import { ladeLandImGebiet } from '@/data/landKacheln';
import { ladeHoehenImGebiet } from '@/data/hoehenKacheln';
import { ladeSeekartenObjekte } from '@/data/seekartenObjekte';
import { holeEtappen } from '@/data/toernApi';
import { initEinBildschirm } from './einbildschirm';
import type { LogEintrag } from '@/data/logdb';
import { ladebildGezeichnet, ladebildWeg } from '@/shell/ladebild';




await ladebildGezeichnet();
initIcons();

setzeAppTexte({ titel: TITLE, beschreibung: DESCRIPTION, strings: STRINGS, tour: TOUR_STEPS });

initSprache();

nimmGemerktenOrt();
initTheme();
initTour();
initUserMenu();
initHandbuchModal();
initSupport('trackbook');



const merkenBox = document.getElementById('in-menu-merken') as HTMLInputElement | null;
if (merkenBox) {
  merkenBox.checked = merktSich();
  merkenBox.addEventListener('change', () => {
    setzeMerktSich(merkenBox.checked);
    if (merkenBox.checked) {
      sichereSpracheWahl();
      sichereThemeWahl();
    }
  });
}

const $ = (id: string) => document.getElementById(id);


const LAGE_ICON: Record<Lage, IconName> = {
  motor: 'propeller', segel: 'segel', angelegt: 'poller', treibend: 'treiben', ankernd: 'anker', liegeplatz: 'kai',
};
let letzteLage: string | null = null;

const LAGE_TEXT_MS = 5000;
let lageTextUhr: number | undefined;
function lageTextZeigen(): void {
  const el = $('tb-lage');
  if (!el) return;
  el.classList.remove('nur-symbol');
  window.clearTimeout(lageTextUhr);
  lageTextUhr = window.setTimeout(() => {
    const l = el.dataset['lage'];
    if (l === 'motor' || l === 'segel') el.classList.add('nur-symbol');
  }, LAGE_TEXT_MS);
}
function zeigeLage(z: Zustand): void {
  const el = $('tb-lage');
  if (!el) return;
  const l0 = lage(z);
  el.hidden = l0 === null;
  if (!l0) { letzteLage = null; return; }
  
  if (antriebVorschau && z.betriebsart !== 'laeuft') uebernimmAntriebVorschau();
  const l: Lage = (l0 === 'motor' || l0 === 'segel') && antriebVorschau ? antriebVorschau.ziel : l0;
  
  (el as HTMLButtonElement).disabled = !((l === 'motor' || l === 'segel') && z.betriebsart === 'laeuft');
  
  
  const schluessel = `${l}|${aktuelleSprache()}`;
  if (schluessel === letzteLage) return;
  letzteLage = schluessel;
  el.dataset['lage'] = l;
  const bild = $('tb-lage-icon');
  if (bild) bild.innerHTML = icon(LAGE_ICON[l]);
  const text = $('tb-lage-text');
  const wortLage = STRINGS[aktuelleSprache()][`lage.${l}`] ?? l;
  if (text) text.textContent = wortLage;
  el.setAttribute('aria-label', wortLage);
  if (l === 'motor' || l === 'segel') lageTextZeigen();
  else { window.clearTimeout(lageTextUhr); el.classList.add('nur-symbol'); }
}


const ANTRIEB_VERZUG_MS = 10_000;
let antriebVorschau: { ziel: 'motor' | 'segel'; t: number; uhr: number } | null = null;
function tippeLage(): void {
  const z = aktuellerZustand();
  const l = lage(z);
  if (z.betriebsart !== 'laeuft' || (l !== 'motor' && l !== 'segel')) return;
  const ist = z.antrieb === 'motor' ? 'motor' : 'segel';
  const gezeigt = antriebVorschau?.ziel ?? ist;
  const neu = gezeigt === 'motor' ? 'segel' : 'motor';
  if (antriebVorschau) window.clearTimeout(antriebVorschau.uhr);
  antriebVorschau = neu === ist ? null
    : { ziel: neu, t: Date.now(), uhr: window.setTimeout(uebernimmAntriebVorschau, ANTRIEB_VERZUG_MS) };
  letzteLage = null;
  zeigeLage(z);
  lageTextZeigen();
}
function uebernimmAntriebVorschau(): void {
  const v = antriebVorschau;
  if (!v) return;
  window.clearTimeout(v.uhr);
  antriebVorschau = null;
  const z = aktuellerZustand();
  letzteLage = null;
  if (!z.fahrt || (z.antrieb === 'motor' ? 'motor' : 'segel') === v.ziel) { zeigeLage(z); return; }
  
  motorwacheVonHand();
  const pos = positionZurZeit(aktuelleFixe(), v.t) ?? z.position;
  void setzeAntrieb(v.ziel, { t: v.t, lat: pos?.lat ?? null, lon: pos?.lon ?? null });
}
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;


const uhr = (t: number) => uhrLtVon(t);

function dauer(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')} h` : `${m}:${String(s % 60).padStart(2, '0')} min`;
}


function setzeDauer(sekunden: number | null): void {
  const el = $('w-dauer');
  if (!el) return;
  if (sekunden === null) { el.textContent = '–'; return; }
  const t = dauer(sekunden);
  const k = t.lastIndexOf(' ');
  el.textContent = t.slice(0, k);
  const einheit = document.createElement('i');
  einheit.textContent = t.slice(k + 1);
  el.appendChild(einheit);
}


function wert(id: string, text: string): void {
  const el = $(id);
  if (!el) return;
  const einheit = el.querySelector('i');
  el.textContent = text;
  if (einheit) el.appendChild(einheit);
}

let letzterZustand: Zustand | null = null;

let letzterZustandMs = 0;

let laufenderToern: Awaited<ReturnType<typeof aktuellerToern>> = null;

const karteEl = $('tb-karte');
if (karteEl) {
  initKarte(karteEl, (folgt) => {
    
    
    ($('btn-zentrieren') as HTMLElement | null)?.toggleAttribute('hidden', folgt);
    ($('btn-nav-zentrieren') as HTMLElement | null)?.toggleAttribute('hidden', folgt);
    karteEl.classList.toggle('tb-folgt', folgt);
  });
  karteEl.classList.add('tb-folgt');
  
  
  requestAnimationFrame(() => karteNeuMessen());
}
$('btn-zentrieren')?.addEventListener('click', () => zentriere());


const AUSRICHTUNG_KEY = 'sail-suite:karten-ausrichtung';
function beschrifteAusrichtung(): void {
  const knopf = $('btn-ausrichtung');
  if (!knopf) return;
  const kurs = ausrichtung() === 'kurs';
  
  
  
  const text = $('tb-ausrichtung-text');
  if (text) text.textContent = wort(kurs ? 'karte.kurzKurs' : 'karte.kurzNord');
  knopf.setAttribute('aria-label', wort('karte.kursOben'));
  knopf.setAttribute('aria-pressed', String(kurs));
  knopf.title = wort('karte.ausrichtungTitel');
}
if (karteEl) {
  let gespeichert: Ausrichtung = 'nord';
  try {
    if (localStorage.getItem(AUSRICHTUNG_KEY) === 'kurs') gespeichert = 'kurs';
  } catch {  }
  const knopf = $('btn-ausrichtung');
  if (knopf) alsKartenelement(knopf);
  
  setzeAusrichtung(gespeichert);
  setzeDrehRueckruf((bearing) => {
    
    
    const nadel = $('tb-nordnadel');
    if (nadel) nadel.style.transform = `rotate(${bearing}deg)`;
  });
  beschrifteAusrichtung();
  $('btn-ausrichtung')?.addEventListener('click', () => {
    const neu: Ausrichtung = ausrichtung() === 'kurs' ? 'nord' : 'kurs';
    setzeAusrichtung(neu);
    try { localStorage.setItem(AUSRICHTUNG_KEY, neu); } catch {  }
    beschrifteAusrichtung();
  });
}


let vorigeFahrtId: string | null = null;


let themeOrt: { lat: number; lon: number } | null = null;
function folgeThemeOrt(): void {
  const p = bekanntePosition();
  if (!p || (themeOrt && Math.abs(p.lat - themeOrt.lat) < 0.05 && Math.abs(p.lon - themeOrt.lon) < 0.05)) return;
  themeOrt = p;
  setzeReferenzOrt(p, true);
}

function zeichne(z: Zustand): void {
  letzterZustand = z;
  letzterZustandMs = Date.now();
  folgeThemeOrt();
  liveBeiZustand(z);
  const fahrtId = z.fahrt?.id ?? null;
  if (vorigeFahrtId && fahrtId !== vorigeFahrtId) {
    
    
    
    setTimeout(() => void sichereSpuren(), 30_000);
  }
  vorigeFahrtId = fahrtId;
  const de = aktuelleSprache() === 'de';

  
  
  wert('w-sog', z.laeuft && !z.wartetAufFix ? nf(z.sog, 1) : '–');
  wert('w-cog', z.cog === null ? '–' : kursGrad(z.cog, false));
  wert('w-strecke', z.fahrt && z.abgelegt ? nf(z.streckeNM, 1) : '–');
  
  
  
  setzeDauer(z.fahrt && z.abgelegt ? z.dauerS : null);
  
  
  const fahrzeit = $('w-fahrzeit');
  if (fahrzeit) {
    const anders = z.fahrt && z.abgelegt && z.pausen.length > 0;
    fahrzeit.textContent = anders ? `${wort('kachel.fahrzeit')} ${dauer(z.fahrzeitS)}` : '';
  }

  
  
  
  
  const position = $('tb-position');
  if (position) position.textContent = z.position ? positionText(z.position.lat, z.position.lon, aktuelleSprache()) : '–';
  zeichneSonne();
  zeichneMond();
  zeichneZielwetter(wetterOrt(z, zielDerRoute(), bekanntePosition()));

  
  
  
  
  
  const gpsStatus = $('gps-status');
  const gpsAn = (z.betriebsart === 'laeuft' || z.betriebsart === 'pausiert-anker')
    && !z.wartetAufFix && !z.fehler;
  if (gpsStatus) {
    gpsStatus.classList.toggle('an', gpsAn);
    gpsStatus.textContent = wort(gpsAn ? 'gps.an' : 'gps.aus');
  }
  
  
  const gpsGenauigkeit = $('gps-genauigkeit');
  if (gpsGenauigkeit) {
    const zeigen = gpsAn && z.genauigkeitM !== null;
    gpsGenauigkeit.hidden = !zeigen;
    if (zeigen) {
      gpsGenauigkeit.textContent = wort('gps.genauigkeit').replace('{m}', nf(z.genauigkeitM!, 0));
    }
  }

  
  
  const wach = $('btn-wach');
  if (wach) wach.hidden = !(z.laeuft && z.wake === 'fehlt');

  const fehler = $('tb-fehler') as HTMLElement | null;
  if (fehler) {
    fehler.hidden = !z.fehler;
    if (z.fehler) {
      fehler.textContent = z.fehler.startsWith('fehler.') && STRINGS[aktuelleSprache()][z.fehler]
        ? wort(z.fehler)
        : z.fehler;
    }
  }

  
  
  
  
  const setzeTaste = (id: string, aus: boolean, textKey: string, titelKey: string): void => {
    const knopf = $(id) as HTMLButtonElement | null;
    if (!knopf) return;
    knopf.disabled = aus;
    
    
    const txt = knopf.querySelector('.tb-transport-txt');
    if (txt) txt.textContent = wort(textKey);
    knopf.title = wort(titelKey);
  };
  const bart = z.betriebsart;
  
  
  const setztFort = bart === 'pausiert' || bart === 'pausiert-anker';
  
  gezeitenStreifen(setztFort);
  
  
  
  
  
  
  const keinToernAusgewaehlt = !laufenderToern || Boolean(laufenderToern.beendet);
  
  
  
  
  const toernZeile = $('tb-toern-zeile') as HTMLElement | null;
  if (toernZeile) {
    toernZeile.hidden = keinToernAusgewaehlt;
    if (!keinToernAusgewaehlt && laufenderToern) {
      const nameEl = $('tb-toern-zeile-name');
      
      if (nameEl && nameEl.textContent !== `${wort('toern.oeffnen')}: ${laufenderToern.name}`) {
        const name = document.createElement('b');
        name.className = 'tb-toern-zeile-titel';
        name.textContent = laufenderToern.name;
        nameEl.replaceChildren(`${wort('toern.oeffnen')}: `, name);
      }
    }
  }
  
  setzeTaste('btn-start', bart === 'laeuft',
    setztFort ? 'btn.fortsetzen' : 'btn.start',
    setztFort ? 'btn.fortsetzenTitel' : 'btn.startTitel');
  setzeTaste('btn-pause', bart !== 'laeuft', 'btn.pause', 'btn.pauseTitel');
  
  
  
  const ankerAn = bart === 'pausiert-anker';
  setzeTaste('btn-pause-anker', bart === 'gestoppt',
    ankerAn ? 'btn.ankerwacheAufheben' : 'btn.pauseAnker',
    ankerAn ? 'btn.ankerwacheAufhebenTitel' : 'btn.pauseAnkerTitel');
  $('btn-pause-anker')?.setAttribute('aria-pressed', String(ankerAn));
  setzeTaste('btn-stop', bart === 'gestoppt', 'btn.stop', 'btn.stopTitel');
  const wachwechselKnopf = $('btn-wachwechsel') as HTMLButtonElement | null;
  if (wachwechselKnopf) wachwechselKnopf.disabled = keinToernAusgewaehlt;
  
  
  
  for (const id of ['btn-statistik', 'btn-coastguard']) {
    const knopf = $(id) as HTMLButtonElement | null;
    if (knopf) knopf.disabled = keinToernAusgewaehlt;
  }
  
  
  
  
  
  
  
  const ohneFahrt = z.betriebsart === 'gestoppt';
  for (const id of ['btn-wetter-zeile', 'btn-ais-zeile', 'btn-eintrag', 'btn-foto']) {
    const knopf = $(id) as HTMLButtonElement | null;
    if (knopf) knopf.disabled = ohneFahrt;
  }
  const antriebKnopf = $('btn-antrieb') as HTMLButtonElement | null;
  if (antriebKnopf) {
    antriebKnopf.disabled = z.betriebsart !== 'laeuft';
    
    
    
    
    const motor = z.antrieb === 'motor';
    antriebKnopf.innerHTML = icon(motor ? 'zahnrad' : 'segel')
      + `<span>${wort(motor ? 'btn.motor' : 'btn.segel')}</span>`;
  }

  
  const luecken = $('tb-luecken') as HTMLElement | null;
  if (luecken) {
    luecken.hidden = z.luecken.length === 0;
    if (z.luecken.length) {
      const gesamt = z.luecken.reduce((s, l) => s + l.dauer, 0);
      const name = z.luecken.length === 1 ? wort('luecke.eine') : wort('luecke.mehrere');
      
      
      
      const amOrt = lueckenAmSelbenOrt(z.luecken);
      const hinweis = amOrt >= gesamt - 60
        ? wort('luecke.stillAlle')
        : amOrt > 0
          ? wort('luecke.stillTeil')
          : wort('luecke.hinweis');
      luecken.textContent = `${z.luecken.length} ${name} · ${dauer(gesamt)}, ${hinweis}`;
    }
  }

  
  const pausen = $('tb-pausen') as HTMLElement | null;
  if (pausen) {
    pausen.hidden = z.pausen.length === 0;
    if (z.pausen.length) {
      const gesamt = z.pausen.reduce((s, p) => s + p.dauer, 0);
      const name = z.pausen.length === 1 ? wort('pause.eine') : wort('pause.mehrere');
      pausen.textContent = `${z.pausen.length} ${name} · ${dauer(gesamt)}, ${wort('pause.hinweis')}`;
    }
  }

  
  zeigeLage(z);

  
  const liste = $('tb-eintraege');
  
  
  
  if (liste && !listeGesperrt()) {
    liste.innerHTML = '';
    if (!z.eintraege.length) {
      const li = document.createElement('li');
      li.className = 'tb-leer';
      li.textContent = wort('log.leer');
      liste.appendChild(li);
    }
    for (const e of [...z.eintraege].sort((a, b) => b.t - a.t)) {
      const li = document.createElement('li');
      const zeit = document.createElement('b');
      zeit.textContent = uhr(e.t);
      const text = document.createElement('span');
      if (e.art === 'hand') {
        text.textContent = e.text || (de ? '(ohne Text)' : '(no text)');
      } else if (e.art === 'foto') {
        
        
        text.className = 'tb-fotozeile';
        if (e.text) text.appendChild(document.createTextNode(e.text));
        zeigeVorschau(text, e);
      } else if (e.art === 'wetter') {
        
        
        
        text.className = e.wetter?.quelle === 'beobachtet' ? 'tb-beobachtet' : 'tb-vorhergesagt';
        text.textContent = e.text ?? '';
      } else {
        const art = document.createElement('span');
        art.className = 'tb-art';
        art.textContent = beschriftung(e.art, de, e.liegeart) + ' ';
        text.append(art, document.createTextNode(eintragInhalt(e.art, e.text, de ? 'de' : 'en')));
      }
      li.append(zeit, text);
      macheBedienbar(li, e);
      liste.appendChild(li);
    }
  }

  
  
  
  
  
  
  
  const manuellePausen = aktuelleManuellePausen();
  const auswertung = werteSpurAus(aktuelleFixe(), {}, manuellePausen);
  if (karteEl) {
    
    
    
    
    const lueckenFuerKarte: Luecke[] = [
      ...auswertung.luecken,
      ...manuellePausen.map((p) => ({ von: p.von, bis: p.bis, dauer: (p.bis - p.von) / 1000, sehneNM: 0 })),
    ];
    zeichneSpur(auswertung.punkte, lueckenFuerKarte, wechselAusEintraegen(z.eintraege));
    const legende = $('tb-spurlegende');
    if (legende) legende.hidden = auswertung.punkte.length < 2;
    if (z.position) setzePosition(z.position.lat, z.position.lon, z.betriebsart === 'laeuft' ? z.cog : null);
    if (z.position && z.betriebsart === 'laeuft' && !z.wartetAufFix) {
      const fueg = geglaetteteSog(auswertung.punkte.slice(0, -1), Date.now(), undefined, auswertung.laufAnfaenge) ?? z.sog;
      
      
      const vh = aktualisiereVorhalt(z.position.lat, z.position.lon, z.cog, z.sog);
      setzeVorauslinie(z.position.lat, z.position.lon, z.cog, fueg, vh?.kdw ?? null);
    } else { vorhaltWeg(); entferneVorauslinie(); }
    setzeKurs(kursFuerKarte(auswertung.punkte));
  }

  
  
  if (z.fahrt && wartendeNavEintraege.length) {
    for (const e of wartendeNavEintraege.splice(0)) void ergaenzeEintrag({ ...e, fahrt: z.fahrt.id });
  }
  navTakt(z, auswertung.punkte, auswertung.laufAnfaenge);

  
  aktualisiereCoastguard(z, auswertung);

  
  pruefeMotorwache(z, auswertung);
  
  pruefeAngelegt(z, auswertung);

  
  
  
  const fixe = aktuelleFixe();
  pruefeAnkerwache(z, fixe[fixe.length - 1], fixe);

  
  
  if (z.laeuft) ergaenzeRevier(laufenderToern, z.position);

  
  
  
  
  
  
  
  
  
  pruefeStationen();
  if (z.betriebsart !== 'pausiert' && z.stillstandS < AIS_RUHE_AB_STILLSTAND_S) pruefeAis();
  else if (z.stillstandS >= AIS_RUHE_AB_STILLSTAND_S) aisRuhtLiegend();

  
  
  
  
  if (z.betriebsart !== 'pausiert') pruefeSeegrenze(z);
  
  pruefeMeeresgebiet(z);
  beobachteUnterwegs(z, aktuelleFixe());

  
  pruefeWetterlog(z);
  zeigeWetterkopf(z.fahrt);
  zeigeGenauigkeit(z.fahrt);

  
  const zeile = $('tb-speicher-zeile');
  if (zeile && z.speicher) {
    const s = z.speicher;
    
    const groesse = (n: number) => (n >= 1024 ** 3 ? `${nf(n / 1024 ** 3, 1)} GB` : `${nf(n / 1048576, 0)} MB`);
    zeile.className = s.dauerhaft ? 'ok' : 'warn';
    zeile.textContent = (s.dauerhaft ? wort('speicher.dauerhaft') : wort('speicher.fluechtig'))
      + (s.kontingent ? ` · ${wort('speicher.belegt').replace('{b}', groesse(s.belegt)).replace('{k}', groesse(s.kontingent))}` : '');
    
    const lage = $('tb-speicher-lage') as HTMLElement | null;
    if (lage) {
      lage.hidden = s.lage === 'ok';
      lage.className = s.lage === 'kritisch' ? 'warn' : '';
      if (s.lage !== 'ok') lage.textContent = wort(s.lage === 'knapp' ? 'speicher.knapp' : 'speicher.kritisch').replace('{export}', wort('menu.export'));
    }
    const hinweis = $('tb-speicher-hinweis') as HTMLElement | null;
    if (hinweis) hinweis.hidden = s.dauerhaft;
  }
}




let schnittMerk: { ms: number; n: number; p: number; kn: number | null } | null = null;
function schnittSeitGemerkt(ms: number): number | null {
  const fixe = aktuelleFixe(), pausen = aktuelleManuellePausen();
  if (schnittMerk && schnittMerk.ms === ms && schnittMerk.n === fixe.length && schnittMerk.p === pausen.length) return schnittMerk.kn;
  const kn = schnittSeit(fixe, ms, pausen)?.kn ?? null;
  schnittMerk = { ms, n: fixe.length, p: pausen.length, kn };
  return kn;
}

function bekanntePosition(): { lat: number; lon: number } | null {
  const z = aktuellerZustand();
  if (z.position) return { lat: z.position.lat, lon: z.position.lon };
  const letzter = aktuelleFixe().at(-1);
  if (letzter) return { lat: letzter.lat, lon: letzter.lon };
  
  
  const mitOrt = [...z.eintraege].reverse().find((e) => e.lat !== null && e.lon !== null);
  return mitOrt ? { lat: mitOrt.lat!, lon: mitOrt.lon! } : null;
}


function restzeit(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}


function zeichneSonne(): void {
  const el = $('tb-sonne');
  if (!el) return;
  const pos = bekanntePosition();
  const jetzt = Date.now();
  const w = pos ? naechsterSonnenwechsel(pos.lat, pos.lon, jetzt) : null;
  el.hidden = !w;
  if (!w) return;
  el.textContent = wort(w.art === 'unter' ? 'sonne.unter' : 'sonne.auf')
    .replace('{uhr}', uhr(w.t)).replace('{rest}', restzeit(w.t - jetzt));
}

function zeichneMond(): void {
  const el = $('tb-mond');
  if (!el) return;
  const pos = bekanntePosition();
  el.hidden = !pos;
  if (!pos) return;
  const jetzt = new Date();
  const ph = mondphase(jetzt);
  const ueber = mondhoehe(pos.lat, pos.lon, jetzt) > 0;
  const rand = ueber ? hellerRand(pos.lat, pos.lon, jetzt) : (ph.zunehmend === (pos.lat >= 0) ? 270 : 90);
  const z = mondzeiten(pos.lat, pos.lon, jetzt);
  const termine = [
    z.auf ? { t: z.auf.getTime(), k: 'mond.auf' } : null,
    z.unter ? { t: z.unter.getTime(), k: 'mond.unter' } : null,
  ].filter((x): x is { t: number; k: string } => !!x).sort((a, b) => a.t - b.t);
  const anteil = wort('mond.anteil').replace('{phase}', wort(`mond.${ph.name}`)).replace('{p}', String(Math.round(ph.beleuchtung * 100)));
  
  const teile = [anteil, ...termine.map((x) => wort(x.k).replace('{uhr}', uhr(x.t)))]
    .map((t) => `<span class="tb-mond-teil">${escapeHtml(t)}</span>`).join(' · ');
  el.innerHTML = `<span class="tb-mond-teil">${mondSvg(ph.beleuchtung, rand, ueber, 20)}</span>${teile}`;
  
  el.title = [anteil, ...termine.map((x) => wort(`${x.k}Text`).replace('{uhr}', uhr(x.t)))].join(', ');
  el.setAttribute('aria-label', el.title);
}

setInterval(() => {
  zeichneSonne();
  zeichneMond();
  
  if (letzterZustand) zeichneZielwetter(wetterOrt(letzterZustand, zielDerRoute(), bekanntePosition()));
}, 30_000);

setInterval(() => {
  if (!letzterZustand?.fahrt || !letzterZustand.abgelegt) return;
  const seit = (Date.now() - letzterZustandMs) / 1000;
  setzeDauer(letzterZustand.dauerS + Math.max(0, seit));
}, 1000);

function beschriftung(art: string, de: boolean, liegeart?: Liegeart): string {
  return eintragArtName(art, de ? 'de' : 'en', liegeart);
}



initCoastguard(() => aktuellerZustand());
initFunkspruch(() => ({
  schiffsname: laufenderToern?.schiff.name ?? '',
  mmsi: laufenderToern?.schiff.mmsi ?? '',
  position: aktuellerZustand().position,
  
  
  
  personenAnBord: laufenderToern?.crew.length ?? null,
  laengeM: laufenderToern?.schiff.laengeM ?? null,
  breiteM: laufenderToern?.schiff.breiteM ?? null,
  tiefgangM: laufenderToern?.schiff.tiefgangM ?? null,
  ziel: aktuellerZustand().fahrt?.ziel ?? null,
  cog: aktuellerZustand().cog,
  laeuft: aktuellerZustand().betriebsart === 'laeuft',
}));
initMotorwache((a, erkanntBei) => void setzeAntrieb(a, erkanntBei));
initAngelegt();

initMikrofon();
{
  const schalter = $('in-motorklang') as HTMLInputElement | null;
  const statusEl = $('tb-motorklang-status');
  const zeigeStatus = (): void => {
    if (!statusEl) return;
    const st = mikrofonStatus();
    if (st === 'laeuft') {
      const k = letzterKlang();
      statusEl.textContent = wort(k ? (k.treffer >= 3 ? 'motorklang.laeuftMotor' : 'motorklang.laeuftStill') : 'motorklang.laeuft');
    } else {
      statusEl.textContent = st === 'aus' ? (motorklangAn() ? wort('motorklang.bereit') : '') : wort(`motorklang.${st}`);
    }
    statusEl.hidden = !statusEl.textContent;
  };
  if (schalter) {
    schalter.checked = motorklangAn();
    schalter.addEventListener('change', () => {
      setzeMotorklangAn(schalter.checked);
      if (schalter.checked && aktuellerZustand().betriebsart === 'laeuft') mikrofonStarten();
      zeigeStatus();
    });
  }
  aufMikrofonStatus(zeigeStatus);
  aufSprachwechsel(zeigeStatus);
  setInterval(zeigeStatus, 5000);
  zeigeStatus();
}

function ankerwacheMitAnsage(ziel: Parameters<typeof aktiviereAnkerwache>[0]): ReturnType<typeof aktiviereAnkerwache> {
  const lief = aktuellerZustand().betriebsart === 'laeuft';
  const r = aktiviereAnkerwache(ziel);
  if (lief) void Promise.resolve(r).then(() => sage(ANSAGE.logPause));
  return r;
}
initAnkerwache(
  () => aktuellerZustand().position,
  (ziel) => ankerwacheMitAnsage(ziel),
  () => aktuellerZustand().fahrt?.id ?? null,
  
  
  
  (e) => void ergaenzeEintrag(e),
  
  
  
  () => laufenderToern?.schiff.laengeM,
  
  
  () => hebeAnkerwacheAuf(),
);
initWetterlog(
  () => {
    const z = aktuellerZustand();
    return z.fahrt ? { id: z.fahrt.id, position: z.position } : null;
  },
  
  
  (e) => void ergaenzeEintrag(e),
  (kopf) => aktualisiereFahrt({ wetterkopf: kopf }),
);

initAis(
  
  
  () => {
    const z = aktuellerZustand();
    if (!z.position) return null;
    return { lat: z.position.lat, lon: z.position.lon, sog: z.sog, cog: z.cog ?? 0 };
  },
  () => aktuellerZustand().fahrt?.id ?? null,
  
  
  
  (e) => void ergaenzeEintrag(e),
);


initSeegrenze((e) => {
  const fahrt = aktuellerZustand().fahrt;
  if (fahrt) void ergaenzeEintrag({ ...e, fahrt: fahrt.id });
});
initMeeresgebiet((e) => {
  const fahrt = aktuellerZustand().fahrt;
  if (fahrt) void ergaenzeEintrag({ ...e, fahrt: fahrt.id });
});



initStationen(() => {
  const p = aktuellerZustand().position;
  return p ? { lat: p.lat, lon: p.lon } : null;
});

initLogBearbeiten();
initFoto(
  () => {
    const z = aktuellerZustand();
    return z.fahrt ? { id: z.fahrt.id, position: z.position } : null;
  },
  
  
  
  (t) => {
    const alle = aktuelleFixe();
    if (!alle.length) return null;
    let naechster = alle[0]!;
    for (const f of alle) {
      if (Math.abs(f.t - t) < Math.abs(naechster.t - t)) naechster = f;
    }
    
    
    return Math.abs(naechster.t - t) <= 5 * 60_000
      ? { lat: naechster.lat, lon: naechster.lon }
      : null;
  },
  (e) => void ergaenzeEintrag(e),
  (e, text) => void ergaenzeEintragText(e, text),
);




initSpurimport(
  async () => {
    
    
    const z = aktuellerZustand();
    if (z.fahrt) return { id: z.fahrt.id, fixe: aktuelleFixe() };
    const letzte = (await alleFahrten()).sort((a, b) => b.begonnen - a.begonnen)[0];
    return letzte ? { id: letzte.id, fixe: await ladeFixe(letzte.id) } : null;
  },
  (fixe) => {
    uebernehmeFixe(fixe);
    if (letzterZustand) zeichne(aktuellerZustand());
  },
  (e) => void ergaenzeEintrag(e),
  (nachricht) => alert(nachricht),
);
initSeewetter();

initWarnblock();


initGezeiten(bekanntePosition);

initKompendium();

initTechnik({ yacht: () => laufenderToern?.schiff?.name ?? null });

initWarnlage();

{
  const zeigeZone = (): void => {
    const el = $('tb-log-zone');
    if (el) el.textContent = `LT = ${zeitzoneText(Date.now(), undefined, aktuelleSprache() === 'en' ? 'en' : 'de')}`;
  };
  zeigeZone();
  aufSprachwechsel(zeigeZone);
  setInterval(zeigeZone, 10 * 60_000);
}

initAnsage();

$('btn-stimme-test')?.addEventListener('click', () => {
  entsperreTon();
  void probe().then((ok) => { if (!ok) alert(wort('menu.stimmeTestFehlt')); });
});
void initWetter();
initDatensicherung();
initStatistik();


entsperreBeiBeruehrung();
$('btn-start')?.addEventListener('click', () => {
  
  
  entsperreTon();
  
  mikrofonStarten();
  const bart = aktuellerZustand().betriebsart;
  if (bart === 'pausiert' || bart === 'pausiert-anker') {
    
    void (async () => {
      if (!(await geraetBeiDerYacht())) return;
      await fortsetzen();
      sage(ANSAGE.logWeiter);
      nachWeiterfahren();
    })();
    return;
  }
  motorwacheZuruecksetzen();
  wetterlogZuruecksetzen();
  void starte().then(() => sage(ANSAGE.logGestartet));
});

async function geraetBeiDerYacht(): Promise<boolean> {
  const yacht = aktuellerZustand().position;
  if (!yacht || !('geolocation' in navigator)) return true;
  const fix = await new Promise<GeolocationPosition | null>((ok) => {
    try {
      navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, maximumAge: 30_000, timeout: 8_000 });
    } catch { ok(null); }
  });
  if (!fix) return true;
  const d = abstandZurYacht({ lat: fix.coords.latitude, lon: fix.coords.longitude, accM: fix.coords.accuracy }, yacht);
  if (d === null) return true;
  const sprache = aktuelleSprache();
  const abstand = `${nf(d, d < 10 ? 1 : 0, sprache)} ${sprache === 'en' ? 'NM' : 'sm'}`;
  return confirm(wort('weiter.fernFrage').replace('{abstand}', abstand));
}


$('btn-stop')?.addEventListener('click', () => {
  void (async () => {
    const toern = await aktuellerToern();
    const anzahl = toern ? (await fahrtenZuToern(toern.id)).length : 0;
    
    const frage = toern && !toern.beendet ? wort('ende.frage').replace('{n}', String(anzahl)) : wort('ende.frageOhneToern');
    if (!confirm(frage)) return;
    await beendeToernJetzt();
    sage(ANSAGE.logStopp);
    
    void meldeStopp();
    setzeToern(null);
    
    navStopp();
    
    
    
    if (toern) oeffneToernFenster(toern.id);
  })();
});

$('btn-statistik')?.addEventListener('click', () => {
  void (async () => {
    const toern = await aktuellerToern();
    const z = aktuellerZustand();
    await zeigeStatistik(toern?.id ?? null, z.position);
  })();
});

const liegeartModalEl = $('tb-liegeart-modal') as HTMLElement | null;
const schliesseLiegeartModal = (): void => {
  liegeartModalEl?.setAttribute('hidden', '');
  liegeartModal?.beimSchliessen();
};
const liegeartModal = liegeartModalEl ? initModal(liegeartModalEl, schliesseLiegeartModal) : null;
function zeichneLiegearten(): void {
  const liste = $('tb-liegearten');
  if (!liste) return;
  liste.innerHTML = '';
  for (const l of LIEGEARTEN) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn tb-gross';
    b.dataset['liegeart'] = l;
    b.textContent = liegeartName(l, aktuelleSprache());
    b.addEventListener('click', () => {
      schliesseLiegeartModal();
      
      motorwacheVonHand();
      void merkeTankstelle(l);
      void pausiere(l).then(() => sage(ANSAGE.logPause));
    });
    liste.appendChild(b);
  }
}
$('btn-pause')?.addEventListener('click', () => {
  if (aktuellerZustand().betriebsart !== 'laeuft') return;
  zeichneLiegearten();
  
  sucheTankstelle();
  liegeartModalEl?.removeAttribute('hidden');
  liegeartModal?.beimOeffnen();
});
$('btn-liegeart-weg')?.addEventListener('click', schliesseLiegeartModal);
$('btn-liegeart-ankerwache')?.addEventListener('click', () => {
  schliesseLiegeartModal();
  motorwacheVonHand();
  oeffneAnkerwacheSetup();
});

function ankerwacheKnopf(): void {
  const bart = aktuellerZustand().betriebsart;
  if (bart === 'pausiert-anker') {
    if (confirm(wort('ankerwache.aufhebenFrage'))) void hebeAnkerwacheAuf();
  } else if (bart === 'laeuft' || bart === 'pausiert') {
    oeffneAnkerwacheSetup();
  }
}
$('btn-pause-anker')?.addEventListener('click', ankerwacheKnopf);
$('btn-ankerwache')?.addEventListener('click', ankerwacheKnopf);
$('btn-wach')?.addEventListener('click', () => void wachHolen());
$('tb-lage')?.addEventListener('click', tippeLage);

let antriebZiel: 'segel' | 'motor' = 'motor';
let antriebGeoeffnet = 0;
const antriebModalEl = $('tb-antrieb-modal') as HTMLElement | null;
const schliesseAntriebModal = (): void => {
  antriebModalEl?.setAttribute('hidden', '');
  antriebModal?.beimSchliessen();
};
const antriebModal = antriebModalEl ? initModal(antriebModalEl, schliesseAntriebModal) : null;
function beschrifteAntriebModal(): void {
  const titel = $('tb-antrieb-titel');
  if (titel) titel.textContent = wort(antriebZiel === 'motor' ? 'antrieb.titelMotor' : 'antrieb.titelSegel');
  const ok = $('btn-antrieb-ok');
  if (ok) ok.textContent = wort(antriebZiel === 'motor' ? 'antrieb.okMotor' : 'antrieb.okSegel');
}
function antriebFehler(text: string | null): void {
  const el = $('tb-antrieb-fehler');
  if (!el) return;
  el.textContent = text ?? '';
  el.hidden = !text;
}
$('btn-antrieb')?.addEventListener('click', () => {
  antriebZiel = letzterZustand?.antrieb === 'motor' ? 'segel' : 'motor';
  antriebGeoeffnet = Date.now();
  const feld = $('in-antrieb-zeit') as HTMLInputElement | null;
  if (feld) feld.value = uhrzeitFeld(antriebGeoeffnet);
  beschrifteAntriebModal();
  antriebFehler(null);
  antriebModalEl?.removeAttribute('hidden');
  
  antriebModal?.beimOeffnen(undefined, $('btn-antrieb-ok'));
});
$('btn-antrieb-ok')?.addEventListener('click', () => {
  const z = aktuellerZustand();
  if (!z.fahrt) { schliesseAntriebModal(); return; }
  const letzter = z.eintraege.filter((e) => e.art === 'antrieb').reduce((m, e) => Math.max(m, e.t + 1), 0);
  const grenze = Math.max(z.fahrt.begonnen, letzter);
  const feld = $('in-antrieb-zeit') as HTMLInputElement | null;
  const r = antriebsZeit(antriebGeoeffnet, feld?.value ?? '', grenze);
  if (!r) { antriebFehler(wort('antrieb.ungueltig')); return; }
  if ('zuFrueh' in r) { antriebFehler(wort('antrieb.zuFrueh').replace('{uhr}', uhr(r.zuFrueh))); return; }
  schliesseAntriebModal();
  
  
  motorwacheVonHand();
  const pos = r.t === antriebGeoeffnet ? z.position : positionZurZeit(aktuelleFixe(), r.t) ?? z.position;
  void setzeAntrieb(antriebZiel, { t: r.t, lat: pos?.lat ?? null, lon: pos?.lon ?? null });
});
$('btn-antrieb-weg')?.addEventListener('click', schliesseAntriebModal);
aufSprachwechsel(beschrifteAntriebModal);


let eintragZeit = 0;
const eintragModalEl = $('tb-eintrag-modal') as HTMLElement | null;
const schliesseEintragModal = (): void => {
  eintragModalEl?.setAttribute('hidden', '');
  eintragModal?.beimSchliessen();
};
const eintragModal = eintragModalEl ? initModal(eintragModalEl, schliesseEintragModal) : null;
$('btn-eintrag')?.addEventListener('click', () => {
  eintragZeit = Date.now();
  const zeitFeld = $('in-eintrag-zeit') as HTMLInputElement | null;
  if (zeitFeld) zeitFeld.value = uhrzeitFeld(eintragZeit);
  zeigeEintragTag();
  eintragModalEl?.removeAttribute('hidden');
  eintragModal?.beimOeffnen();
  ($('in-eintrag') as HTMLTextAreaElement | null)?.focus();
});

function zeigeEintragTag(): void {
  const el = $('tb-eintrag-tag');
  const feld = $('in-eintrag-zeit') as HTMLInputElement | null;
  if (!el) return;
  const t = feld?.value && feld.value !== uhrzeitFeld(eintragZeit) ? eintragsZeit(eintragZeit, feld.value) : null;
  const vortag = t !== null && new Date(t).toDateString() !== new Date(eintragZeit).toDateString();
  el.hidden = !vortag;
  if (vortag) {
    el.textContent = `${wort('eintrag.vortag')} · ${new Date(t).toLocaleDateString(
      aktuelleSprache() === 'en' ? 'en-GB' : 'de-AT', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  }
}
$('in-eintrag-zeit')?.addEventListener('input', zeigeEintragTag);
$('btn-eintrag-ok')?.addEventListener('click', () => {
  const feld = $('in-eintrag') as HTMLTextAreaElement | null;
  
  const zeitFeld = $('in-eintrag-zeit') as HTMLInputElement | null;
  const t = zeitFeld?.value && zeitFeld.value !== uhrzeitFeld(eintragZeit)
    ? eintragsZeit(eintragZeit, zeitFeld.value) ?? eintragZeit : eintragZeit;
  void neuerEintrag(feld?.value.trim() ?? '', t);
  if (feld) feld.value = '';
  schliesseEintragModal();
});
$('btn-eintrag-weg')?.addEventListener('click', () => {
  const feld = $('in-eintrag') as HTMLTextAreaElement | null;
  if (feld) feld.value = '';
  schliesseEintragModal();
});



aufSprachwechsel(() => {
  if (letzterZustand) zeichne(letzterZustand);
  aisNeuZeichnen();
  beschrifteAusrichtung();
  seewetterNeuZeichnen();
  gezeitenNeuZeichnen();
});





void loeseOrteAuf();
window.addEventListener('online', () => void loeseOrteAuf());
setInterval(() => void loeseOrteAuf(), 5 * 60_000);













async function sichereSpuren(): Promise<void> {
  const token = liesSitzungsToken();
  const nutzerId = liesEigeneNutzerId();
  if (!token || !nutzerId || !istOnline()) return;
  
  await holeZurueck();
  await sichereFahrten(token, nutzerId, await alleFahrten().catch(() => []), true);
  const grenze = Date.now() - 30 * 86_400_000;
  for (const t of await alleToerne().catch(() => [])) {
    if (t.beendet !== undefined && t.beendet < grenze) continue;
    await gleicheMotordatenAb(token, nutzerId, t.id, t);
  }
}

let zurueckLaeuft = false;
async function holeZurueck(): Promise<void> {
  const token = liesSitzungsToken();
  const nutzerId = liesEigeneNutzerId();
  if (zurueckLaeuft || !token || !nutzerId || !istOnline()) return;
  zurueckLaeuft = true;
  try {
    
    const liefSchon = !!(await laufendeFahrt().catch(() => null));
    const n = await holeFahrtenZurueck(token, nutzerId).catch(() => 0);
    if (n > 0 && !liefSchon) window.location.reload();
  } finally {
    zurueckLaeuft = false;
  }
}
setTimeout(() => void holeZurueck(), 3_000);
setTimeout(() => void sichereSpuren(), 30_000);
window.addEventListener('online', () => void sichereSpuren());
setInterval(() => void sichereSpuren(), 15 * 60_000);

initTankstopp(() => void sichereSpuren());



initLivestream();




const wartendeNavEintraege: Omit<LogEintrag, 'fahrt'>[] = [];
const ETAPPEN_KEY = (id: string) => `sail-suite:nav-etappen:${id}`;

document.documentElement.classList.add('ein-an');
initNavigation({
  position: bekanntePosition,
  schnittSeit: schnittSeitGemerkt,
  tiefgangM: () => laufenderToern?.schiff.tiefgangM ?? null,
  async etappen() {
    const toernId = laufenderToern && !laufenderToern.beendet ? laufenderToern.id : null;
    if (!toernId) return 'ohneToern';
    type E = { wegpunkte: { lat: number; lon: number }[]; datum: string | null; von_name: string | null; nach_name: string | null; art?: string; gewaehlt?: boolean };
    let etappen: E[] | null = null;
    const token = liesSitzungsToken();
    if (token && istOnline()) etappen = await holeEtappen(token, toernId).catch(() => null);
    
    try {
      if (etappen) localStorage.setItem(ETAPPEN_KEY(toernId), JSON.stringify(etappen));
      else etappen = JSON.parse(localStorage.getItem(ETAPPEN_KEY(toernId)) ?? 'null') as E[] | null;
    } catch {  }
    if (!etappen) return 'offline';
    const heute = new Date().toLocaleDateString('sv'); 
    const fahrten = etappen.filter((e) => e.art !== 'hafentag' && e.wegpunkte.length >= 2);
    const passend = fahrten.filter((e) => !e.datum || e.datum >= heute)
      .sort((a, b) => (a.datum ?? '9').localeCompare(b.datum ?? '9') || Number(!!b.gewaehlt) - Number(!!a.gewaehlt));
    const e = passend[0];
    if (!e) return 'keine';
    return { wegpunkte: e.wegpunkte, vonName: e.von_name, nachName: e.nach_name };
  },
  eintrag(e) {
    const fahrt = aktuellerZustand().fahrt;
    
    
    if (fahrt) void ergaenzeEintrag({ ...e, fahrt: fahrt.id });
    else wartendeNavEintraege.push(e);
  },
  aktiviereAnker(radiusM) {
    const p = bekanntePosition();
    if (!p) return;
    motorwacheVonHand();
    void ankerwacheMitAnsage({ lat: p.lat, lon: p.lon, radiusM });
  },
  hebeAnkerAuf() {
    if (confirm(wort('ankerwache.aufhebenFrage'))) void hebeAnkerwacheAuf();
  },
  vorladen: vorladenAusschnitt,
});

initEinBildschirm();

void initToernAuswahl((t) => {
  setzeToern(t?.id ?? null);
  motorwacheToern(t);
  laufenderToern = t;
  
  setzeTiefgang(t?.schiff.tiefgangM ?? null);
  
  revierZuruecksetzen();
  
  
  
  if (letzterZustand) zeichne(letzterZustand);
}).then(() => {
  
  
  
  
  
  
  
  
  
  
  
  
  
  void besitzeTab(() => location.reload()).then((besitzer) => {
    if (besitzer) { void initAufzeichnung(zeichne); return; }
    setzeNurLesen(zeichne);
    const el = $('tb-zweiter-tab');
    if (el) el.hidden = false;
  });
});



$('btn-export')?.addEventListener('click', () => {
  void (async () => {
    const fahrt = (await laufendeFahrt()) ?? (await alleFahrten())[0];
    if (!fahrt) {
      alert(wort('export.leer'));
      return;
    }
    const [fixe, eintraege, toern] = await Promise.all([
      ladeFixe(fahrt.id), ladeEintraege(fahrt.id), aktuellerToern(),
    ]);
    if (!fixe.length) {
      alert(wort('export.leer'));
      return;
    }
    const datei = gpxDateiname(fahrt, toern);
    await biete(baueGpx({ fahrt, fixe, eintraege, toern }), datei);
  })();
});






if ('serviceWorker' in navigator) {
  
  
  
  
  
  
  
  
  const hatteWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js')
    .then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {});
      });
    })
    .catch((err) => console.warn('Service Worker nicht registriert:', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteWorker) return; 
    const leiste = $('tb-update') as HTMLElement | null;
    if (leiste) leiste.hidden = false;
  });
  $('btn-update')?.addEventListener('click', () => location.reload());
  
  
  
  
  const laufend = document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content ?? null;
  let gefragtUm = 0;
  const frageNeueFassung = (): void => {
    if (!navigator.serviceWorker.controller || !navigator.onLine || Date.now() - gefragtUm < 2 * 60_000) return;
    gefragtUm = Date.now();
    navigator.serviceWorker.controller.postMessage({ art: 'neueFassung' });
  };
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { art?: string; version?: string | null } | null;
    if (d?.art !== 'neueFassung' || !d.version || !laufend || d.version === laufend) return;
    const leiste = $('tb-update') as HTMLElement | null;
    if (leiste) leiste.hidden = false;
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') frageNeueFassung(); });
  setInterval(frageNeueFassung, 15 * 60_000);
  setTimeout(frageNeueFassung, 30_000);
}



initNetz();




aufNetzwechsel((lage) => {
  const el = $('tb-netz') as HTMLElement | null;
  if (el) {
    el.hidden = lage === 'online';
    el.textContent = wort('netz.offline');
  }
  if (lage === 'online') void loeseOrteAuf();
});



function mbText(bytes: number, sp: 'de' | 'en'): string {
  const mb = bytes / 1_000_000;
  return mb < 0.1 ? `< ${nf(0.1, 1, sp)}` : nf(mb, 1, sp);
}

async function vorladenAusschnitt(fortschritt: (text: string) => void): Promise<boolean> {
  if (!istOnline()) {
    alert(wort('vorladen.offline'));
    return false;
  }
  const ausschnitt = sichtbarerAusschnitt();
  if (!ausschnitt) return false;
  const anzahl = kachelZahl(ausschnitt);
  if (anzahl > MAX_KACHELN) {
    alert(wort('vorladen.zuviel').replace('{n}', String(anzahl)));
    return false;
  }
  
  const plan = await vorladePlan(ausschnitt);
  const sp = aktuelleSprache();
  if (plan.neu.length > 0) {
    const frage = wort('vorladen.frage').replace('{n}', String(plan.neu.length))
      + (plan.schonDa > 0 ? ' ' + wort('vorladen.schonDa').replace('{c}', String(plan.schonDa)) : '');
    if (!confirm(`${wort('vorladen.hinweis')}\n\n${frage}`)) return false;
  }
  const f = await ladeRevierVor(plan.neu, (p) => {
    fortschritt(wort('vorladen.laeuft').replace('{a}', String(p.geladen)).replace('{b}', String(p.gesamt))
      .replace('{mb}', mbText(p.bytes, sp)));
  });
  
  fortschritt(wort('vorladen.seekarte'));
  const box = { swLat: ausschnitt.sued, swLon: ausschnitt.west, neLat: ausschnitt.nord, neLon: ausschnitt.ost };
  await Promise.all([
    ladeLandImGebiet(box, true).catch(() => false),
    ladeHoehenImGebiet(box, true).catch(() => false),
    ladeSeekartenObjekte(box, true).catch(() => false),
  ]);
  fortschritt(wort('vorladen.navDaten'));
  await ladeNavDatenVor({ swLat: ausschnitt.sued, swLon: ausschnitt.west, neLat: ausschnitt.nord, neLon: ausschnitt.ost });
  fortschritt(plan.neu.length === 0 ? wort('vorladen.alleDa')
    : wort('vorladen.fertig').replace('{a}', String(f.geladen)).replace('{mb}', mbText(f.bytes, sp))
      + (f.fehlgeschlagen > 0 ? ' ' + wort('vorladen.fehlend').replace('{f}', String(f.fehlgeschlagen)) : ''));
  merkeRegion(ausschnitt);
  return true;
}

$('btn-vorladen')?.addEventListener('click', () => {
  void (async () => {
    const zeile = $('tb-vorladen') as HTMLElement | null;
    if (!zeile) return;
    const text = document.createElement('span');
    const abbruch = document.createElement('button');
    abbruch.type = 'button';
    abbruch.className = 'btn';
    abbruch.textContent = wort('vorladen.abbrechen');
    abbruch.addEventListener('click', () => brichVorladenAb());
    
    
    const geladen = await vorladenAusschnitt((t) => {
      if (zeile.hidden) { zeile.replaceChildren(text, abbruch); zeile.hidden = false; }
      text.textContent = t;
    });
    abbruch.remove();
    if (geladen) setTimeout(() => { zeile.hidden = true; }, 20_000);
  })();
});


ladebildWeg();
