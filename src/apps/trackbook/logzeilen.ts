import { icon } from '@/shell/icons';
import { initModal } from '@/shell/modal';
import { aktuelleSprache } from '@/shell/sprache';
import { STRINGS } from './strings';
import { ORTS_EINTRAEGE } from '@/core/ortsmarken';
import { eintragArtName } from '@/core/logbuchText';
import {
  wischStufe, mitUhrzeit, uhrzeitFeld, KNOPF_BREITE_PX, ART_WAHL, artWaehlbar, artWahlVon, artWahlWert, artWahlAusWert,
  type WischStufe,
} from '@/core/logbuchBearbeiten';
import { ortsangabeLogbuch } from '@/data/places';
import { loescheBild, type LogEintrag } from '@/data/logdb';
import { bearbeiteEintrag, loescheEintragVonHand } from './aufzeichnung';



const RUECKGAENGIG_MS = 6000;

const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;

let gezogen = false;
let offeneZeile: HTMLElement | null = null;
let dialogOffen = false;

export function listeGesperrt(): boolean {
  return gezogen || offeneZeile !== null || dialogOffen;
}

function schliesseOffene(): void {
  if (!offeneZeile) return;
  const inhalt = offeneZeile.querySelector<HTMLElement>('.tb-wisch-inhalt');
  if (inhalt) inhalt.style.transform = '';
  offeneZeile.classList.remove('tb-offen-klick', 'tb-voll-rot');
  offeneZeile = null;
}


export function macheBedienbar(li: HTMLLIElement, e: LogEintrag): void {
  const inhalt = document.createElement('div');
  inhalt.className = 'tb-wisch-inhalt';
  while (li.firstChild) inhalt.appendChild(li.firstChild);
  const aktionen = document.createElement('div');
  aktionen.className = 'tb-wisch-aktionen';
  const bearbeiten = document.createElement('button');
  bearbeiten.type = 'button';
  bearbeiten.className = 'tb-akt-bearbeiten';
  bearbeiten.innerHTML = icon('stift');
  bearbeiten.setAttribute('aria-label', wort('bearbeiten.knopf'));
  const loeschen = document.createElement('button');
  loeschen.type = 'button';
  loeschen.className = 'tb-akt-loeschen';
  loeschen.innerHTML = icon('papierkorb');
  loeschen.setAttribute('aria-label', wort('loeschen.knopf'));
  aktionen.append(bearbeiten, loeschen);
  li.classList.add('tb-wisch');
  li.append(aktionen, inhalt);

  bearbeiten.addEventListener('click', (ev) => {
    ev.stopPropagation();
    schliesseOffene();
    oeffneBearbeiten(e);
  });
  loeschen.addEventListener('click', (ev) => {
    ev.stopPropagation();
    schliesseOffene();
    void loesche(e);
  });

  
  inhalt.addEventListener('click', (ev) => {
    const pe = ev as PointerEvent;
    if (pe.pointerType === 'touch' || pe.pointerType === 'pen') return;
    if (offeneZeile === li) { schliesseOffene(); return; }
    schliesseOffene();
    li.classList.add('tb-offen-klick');
    offeneZeile = li;
  });

  
  
  let startX = 0, startY = 0, basis = 0, richtung: 'offen' | 'waagrecht' | 'senkrecht' = 'offen';
  let stufe: WischStufe = 'zu';
  let dx = 0;
  const setze = (px: number): void => {
    inhalt.style.transform = px > 0 ? `translateX(${-px}px)` : '';
    aktionen.style.width = `${Math.max(KNOPF_BREITE_PX, px)}px`;
  };
  inhalt.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    if (offeneZeile && offeneZeile !== li) schliesseOffene();
    startX = ev.clientX; startY = ev.clientY;
    basis = offeneZeile === li ? KNOPF_BREITE_PX : 0;
    richtung = 'offen';
    dx = basis;
  });
  inhalt.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'touch') return;
    const mx = startX - ev.clientX, my = ev.clientY - startY;
    if (richtung === 'offen') {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      richtung = Math.abs(mx) > Math.abs(my) ? 'waagrecht' : 'senkrecht';
      if (richtung === 'waagrecht') {
        gezogen = true;
        li.classList.add('tb-zieht');
        try { inhalt.setPointerCapture(ev.pointerId); } catch {  }
      }
    }
    if (richtung !== 'waagrecht') return;
    dx = Math.max(0, basis + mx);
    stufe = wischStufe(dx, li.clientWidth);
    li.classList.toggle('tb-voll-rot', stufe === 'loeschen');
    setze(dx);
  });
  const ende = (): void => {
    if (richtung !== 'waagrecht') { richtung = 'offen'; return; }
    richtung = 'offen';
    gezogen = false;
    li.classList.remove('tb-zieht');
    if (stufe === 'loeschen') {
      setze(li.clientWidth);
      offeneZeile = null;
      void loesche(e);
    } else if (stufe === 'offen') {
      setze(KNOPF_BREITE_PX);
      li.classList.remove('tb-voll-rot');
      offeneZeile = li;
    } else {
      setze(0);
      li.classList.remove('tb-voll-rot');
      if (offeneZeile === li) offeneZeile = null;
    }
  };
  inhalt.addEventListener('pointerup', ende);
  inhalt.addEventListener('pointercancel', ende);
}



let rueckgaengig: (() => Promise<void>) | null = null;
let rueckgaengigTimer: ReturnType<typeof setTimeout> | null = null;
let bildNachFrist: string | null = null;

async function loesche(e: LogEintrag): Promise<void> {
  
  beendeFrist();
  try {
    rueckgaengig = await loescheEintragVonHand(e);
  } catch {
    return;
  }
  bildNachFrist = e.art === 'foto' && e.bild ? e.bild : null;
  const leiste = document.getElementById('tb-rueckgaengig');
  if (leiste) leiste.hidden = false;
  rueckgaengigTimer = setTimeout(beendeFrist, RUECKGAENGIG_MS);
}

function beendeFrist(): void {
  if (rueckgaengigTimer) clearTimeout(rueckgaengigTimer);
  rueckgaengigTimer = null;
  rueckgaengig = null;
  const leiste = document.getElementById('tb-rueckgaengig');
  if (leiste) leiste.hidden = true;
  
  
  if (bildNachFrist) void loescheBild(bildNachFrist).catch(() => {});
  bildNachFrist = null;
}



let aktuell: LogEintrag | null = null;
let modal: ReturnType<typeof initModal> | null = null;

function modalEl(): HTMLElement | null { return document.getElementById('tb-bearbeiten-modal'); }

function schliesseBearbeiten(): void {
  modalEl()?.setAttribute('hidden', '');
  modal?.beimSchliessen();
  dialogOffen = false;
  aktuell = null;
}

function oeffneBearbeiten(e: LogEintrag): void {
  const el = modalEl();
  if (!el) return;
  aktuell = e;
  dialogOffen = true;
  const de = aktuelleSprache() === 'de';
  const art = document.getElementById('tb-bearbeiten-art');
  if (art) art.textContent = eintragArtName(e.art, de ? 'de' : 'en', e.liegeart);
  
  const wahlBox = document.getElementById('tb-bearbeiten-artwahl');
  const wahl = document.getElementById('in-bearbeiten-art') as HTMLSelectElement | null;
  const jetzt = artWahlVon(e);
  if (wahlBox) wahlBox.hidden = !artWaehlbar(e.art) || !jetzt;
  if (wahl && jetzt) {
    wahl.innerHTML = '';
    for (const w of ART_WAHL) {
      const o = document.createElement('option');
      o.value = artWahlWert(w);
      o.textContent = w.art === 'hand' ? wort('bearbeiten.eigener') : eintragArtName(w.art, de ? 'de' : 'en', w.liegeart);
      wahl.appendChild(o);
    }
    wahl.value = artWahlWert(jetzt);
  }
  if (art) art.hidden = !!(wahlBox && !wahlBox.hidden);
  const zeit = document.getElementById('in-bearbeiten-zeit') as HTMLInputElement | null;
  if (zeit) zeit.value = uhrzeitFeld(e.t);
  const text = document.getElementById('in-bearbeiten-text') as HTMLTextAreaElement | null;
  if (text) text.value = e.text ?? '';
  const ort = document.getElementById('tb-bearbeiten-ort');
  const hatOrt = (ORTS_EINTRAEGE as readonly string[]).includes(e.art) && e.lat !== null && e.lon !== null;
  if (ort) ort.hidden = !hatOrt;
  const protokoll = document.getElementById('tb-bearbeiten-protokoll');
  if (protokoll) { protokoll.hidden = true; protokoll.textContent = ''; }
  el.removeAttribute('hidden');
  modal?.beimOeffnen(null, text);
}

export function initLogBearbeiten(): void {
  const el = modalEl();
  if (el) modal = initModal(el, schliesseBearbeiten);
  document.getElementById('btn-bearbeiten-weg')?.addEventListener('click', schliesseBearbeiten);
  
  document.getElementById('in-bearbeiten-art')?.addEventListener('change', (ev) => {
    const e = aktuell;
    const w = artWahlAusWert((ev.target as HTMLSelectElement).value);
    const ort = document.getElementById('tb-bearbeiten-ort');
    if (!e || !w || !ort) return;
    ort.hidden = !((ORTS_EINTRAEGE as readonly string[]).includes(w.art) && e.lat !== null && e.lon !== null);
  });
  document.getElementById('btn-bearbeiten-ok')?.addEventListener('click', () => {
    const e = aktuell;
    if (!e) return;
    const zeit = document.getElementById('in-bearbeiten-zeit') as HTMLInputElement | null;
    const text = document.getElementById('in-bearbeiten-text') as HTMLTextAreaElement | null;
    
    
    let t = e.t;
    if (zeit && zeit.value && zeit.value !== uhrzeitFeld(e.t)) t = mitUhrzeit(e.t, zeit.value) ?? e.t;
    const wahl = document.getElementById('in-bearbeiten-art') as HTMLSelectElement | null;
    const wahlBox = document.getElementById('tb-bearbeiten-artwahl');
    const artWahl = wahl && wahlBox && !wahlBox.hidden ? artWahlAusWert(wahl.value) ?? undefined : undefined;
    schliesseBearbeiten();
    void bearbeiteEintrag(e, (text?.value ?? '').trim(), t, artWahl);
  });
  document.getElementById('btn-bearbeiten-ort')?.addEventListener('click', () => {
    const e = aktuell;
    if (!e || e.lat === null || e.lon === null) return;
    const protokoll = document.getElementById('tb-bearbeiten-protokoll');
    const text = document.getElementById('in-bearbeiten-text') as HTMLTextAreaElement | null;
    if (protokoll) { protokoll.hidden = false; protokoll.textContent = wort('bearbeiten.ortSucht'); }
    void ortsangabeLogbuch({ lat: e.lat, lon: e.lon }, aktuelleSprache()).then((r) => {
      if (aktuell !== e) return;
      
      
      const uebernehmen = !!r.name && (r.vollstaendig || !text?.value.trim());
      if (uebernehmen && text && r.name) text.value = r.name;
      if (protokoll) {
        protokoll.textContent = [r.name ?? '–', ...(r.vollstaendig ? [] : [wort('bearbeiten.unvollstaendig')]), ...r.protokoll].join('\n');
      }
    }, () => {
      if (protokoll && aktuell === e) protokoll.textContent = wort('bearbeiten.ortFehler');
    });
  });
  document.getElementById('btn-rueckgaengig')?.addEventListener('click', () => {
    const r = rueckgaengig;
    bildNachFrist = null; 
    beendeFrist();
    if (r) void r();
  });
  
  document.addEventListener('pointerdown', (ev) => {
    if (offeneZeile && !offeneZeile.contains(ev.target as Node)) schliesseOffene();
  });
}
