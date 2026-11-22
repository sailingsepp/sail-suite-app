import { datumUhrLtVon } from '@/core/time';
import { initModal } from '@/shell/modal';
import { aktuelleSprache } from '@/shell/sprache';
import { icon } from '@/shell/icons';
import { liesExif, exifZeitpunkt } from '@/core/exif';
import { positionText } from '@/core/koordinaten';
import { verkleinere } from '@/data/bild';
import {
  holeCrewFotos, ladeCrewFotoHoch, loescheCrewFoto, holeCrewFotoBlob, setzeCrewFotoOrt,
  type CrewFoto, type ZeitQuelle, type OrtQuelle,
} from '@/data/crewFotos';
import { fotoOrtText } from '@/core/standortName';
import { fotoOrt } from './fotoOrt';
import { oeffneLiegeplatzWahl } from '@/ui/liegeplatzWahl';
import type { ToernZeile } from '@/data/toernApi';
import { spurPositionUm, revierZone, tagIn } from './statistik';
import { STRINGS } from './strings';



const wort = (s: string, e: Record<string, string> = {}): string =>
  (STRINGS[aktuelleSprache()][s] ?? s).replace(/\{(\w+)\}/g, (_, k: string) => e[k] ?? '');
const $ = (id: string) => document.getElementById(id);

interface Entwurf {
  vorschau: string;
  bild: Blob;
  breite: number;
  hoehe: number;
  t: number;
  zeitQuelle: ZeitQuelle;
  
  ort: { lat: number; lon: number; quelle: OrtQuelle; name?: string; endgueltig?: boolean } | null;
  text: string;
}


const angefragt = new WeakSet<object>();

let entwuerfe: Entwurf[] = [];
const urls: string[] = [];

function geraetePosition(): Promise<{ lat: number; lon: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((ok) => navigator.geolocation.getCurrentPosition(
    (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok(null),
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
  ));
}


function zeitText(t: number): string {
  try {
    return datumUhrLtVon(t, aktuelleSprache() === 'de' ? 'de' : 'en', { weekday: 'short', day: 'numeric', month: 'numeric' }, revierZone());
  } catch {
    return new Date(t).toLocaleString();
  }
}


function alsEingabe(t: number): string {
  const d = new Date(t);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

async function entwurfAus(datei: File, kamera: boolean): Promise<Entwurf | null> {
  let exif: ReturnType<typeof liesExif> = { aufnahme: null, gps: null };
  try { exif = liesExif(await datei.arrayBuffer()); } catch {  }
  let klein: Awaited<ReturnType<typeof verkleinere>>;
  try { klein = await verkleinere(datei); } catch { return null; }
  const t = exif.aufnahme ? exifZeitpunkt(exif.aufnahme, revierZone()) : kamera ? Date.now() : datei.lastModified || Date.now();
  const zeitQuelle: ZeitQuelle = exif.aufnahme ? 'exif' : kamera ? 'kamera' : 'datei';
  let ort: Entwurf['ort'] = exif.gps ? { ...exif.gps, quelle: 'exif' } : null;
  if (!ort && kamera) {
    const p = await geraetePosition();
    if (p) ort = { ...p, quelle: 'geraet' };
  }
  if (!ort) {
    const p = spurPositionUm(t);
    if (p) ort = { ...p, quelle: 'spur' };
  }
  const vorschau = URL.createObjectURL(klein.blob);
  urls.push(vorschau);
  return { vorschau, bild: klein.blob, breite: klein.breite, hoehe: klein.hoehe, t, zeitQuelle, ort, text: '' };
}

function zeigeEntwuerfe(): void {
  const liste = $('foto-liste');
  if (!liste) return;
  const sprache = aktuelleSprache();
  liste.replaceChildren(...entwuerfe.map((e, i) => {
    const karte = document.createElement('div');
    karte.className = 'vb-foto-entwurf';
    const img = document.createElement('img');
    img.src = e.vorschau;
    img.alt = '';
    const felder = document.createElement('div');

    const zeitLabel = document.createElement('label');
    const zeitSpan = document.createElement('span');
    zeitSpan.textContent = `${wort('fotos.zeit')} (${wort(`fotos.quelle.${e.zeitQuelle}`)})`;
    const zeit = document.createElement('input');
    zeit.type = 'datetime-local';
    zeit.value = alsEingabe(e.t);
    zeit.addEventListener('change', () => {
      const neu = new Date(zeit.value).getTime();
      if (!Number.isFinite(neu)) return;
      e.t = neu;
      e.zeitQuelle = 'hand';
      
      if (!e.ort || e.ort.quelle === 'spur') {
        const p = spurPositionUm(neu);
        e.ort = p ? { ...p, quelle: 'spur' } : null;
      }
      zeigeEntwuerfe();
    });
    zeitLabel.append(zeitSpan, zeit);

    const ort = document.createElement('p');
    ort.className = 'vb-foto-ort';
    ort.textContent = `${wort('fotos.ort')}: ${e.ort ? `${e.ort.name || positionText(e.ort.lat, e.ort.lon, sprache)} (${wort(`fotos.quelle.${e.ort.quelle}`)})` : wort('fotos.ortKeiner')}`;
    
    const o = e.ort;
    if (o && o.name === undefined && !angefragt.has(o)) {
      angefragt.add(o);
      void fotoOrt(o.lat, o.lon).then((r) => {
        if (!r || e.ort !== o) return;
        o.name = r.name;
        o.endgueltig = r.endgueltig;
        zeigeEntwuerfe();
      });
    }
    const knoepfe = document.createElement('div');
    knoepfe.className = 'vb-aktionen';
    const knopf = (text: string, aktion: () => void | Promise<void>) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = text;
      b.addEventListener('click', () => void aktion());
      knoepfe.append(b);
    };
    knopf(wort('fotos.ortAktuell'), async () => {
      const status = $('foto-dialog-status');
      if (status) status.textContent = wort('fotos.ortSucht');
      const p = await geraetePosition();
      if (status) status.textContent = p ? '' : wort('fotos.ortNichtDa');
      if (p) { e.ort = { ...p, quelle: 'geraet' }; zeigeEntwuerfe(); }
    });
    knopf(wort('fotos.ortKarte'), async () => {
      const wahl = await oeffneLiegeplatzWahl({
        titel: wort('fotos.ortKarteTitel'), sprache, ...(e.ort ? { mitte: { lat: e.ort.lat, lon: e.ort.lon } } : {}),
      });
      if (wahl) { e.ort = { lat: wahl.lat, lon: wahl.lon, quelle: 'hand' }; zeigeEntwuerfe(); }
    });
    if (e.ort) knopf(wort('fotos.ortWeg'), () => { e.ort = null; zeigeEntwuerfe(); });
    knopf(wort('fotos.entfernen'), () => { entwuerfe.splice(i, 1); zeigeEntwuerfe(); });

    const textLabel = document.createElement('label');
    const textSpan = document.createElement('span');
    textSpan.textContent = wort('fotos.text');
    const text = document.createElement('input');
    text.type = 'text';
    text.maxLength = 300;
    text.value = e.text;
    text.addEventListener('input', () => { e.text = text.value; });
    textLabel.append(textSpan, text);

    felder.append(zeitLabel, ort, knoepfe, textLabel);
    karte.append(img, felder);
    return karte;
  }));
  const hoch = $('btn-foto-hochladen') as HTMLButtonElement | null;
  if (hoch) hoch.disabled = entwuerfe.length === 0;
}


async function zeigeGalerie(token: string, toern: ToernZeile): Promise<void> {
  const ziel = $('vb-fotos');
  if (!ziel) return;
  const liste = await holeCrewFotos(token, toern.id);
  if (!liste) return;
  if (!liste.length) {
    const p = document.createElement('p');
    p.className = 'vb-hinweis';
    p.textContent = wort('fotos.keine');
    ziel.replaceChildren(p);
    return;
  }
  const zone = revierZone();
  const tage = new Map<string, CrewFoto[]>();
  for (const f of liste) {
    const k = tagIn(f.t, zone);
    tage.set(k, [...(tage.get(k) ?? []), f]);
  }
  const sprache = aktuelleSprache();
  const gruppen: HTMLElement[] = [];
  for (const [, fotos] of [...tage.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const gruppe = document.createElement('div');
    gruppe.className = 'vb-foto-tag';
    const kopf = document.createElement('h4');
    kopf.textContent = new Intl.DateTimeFormat(sprache === 'de' ? 'de-AT' : 'en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(fotos[0]!.t);
    const raster = document.createElement('ul');
    raster.className = 'vb-foto-raster';
    for (const f of fotos) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.target = '_blank';
      a.rel = 'noopener';
      const img = document.createElement('img');
      img.alt = f.text ?? '';
      img.loading = 'lazy';
      a.append(img);
      void holeCrewFotoBlob(token, toern.id, f.id).then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        img.src = url;
        a.href = url;
      });
      const unter = document.createElement('p');
      const name = f.von ? `${f.von.vorname} ${f.von.nachname}`.trim() : '';
      const beschrifte = () => {
        unter.textContent = [zeitText(f.t), fotoOrtText(f, sprache) ?? wort('fotos.ortKeiner'), name, f.text ?? ''].filter(Boolean).join(' · ');
      };
      beschrifte();
      
      if (f.lat !== null && f.lon !== null && f.ort === undefined) {
        void fotoOrt(f.lat, f.lon).then((r) => {
          if (!r) return;
          f.ort = r.name;
          beschrifte();
          if (r.endgueltig && !toern.archiviert_am) void setzeCrewFotoOrt(token, toern.id, f.id, r.name);
        });
      }
      li.append(a, unter);
      if (f.eigenes && !toern.archiviert_am) {
        const weg = document.createElement('button');
        weg.type = 'button';
        weg.className = 'btn ghost';
        weg.innerHTML = icon('papierkorb') + wort('fotos.loeschen');
        weg.addEventListener('click', () => void (async () => {
          if (await loescheCrewFoto(token, toern.id, f.id)) {
            const s = $('foto-status');
            if (s) s.textContent = wort('fotos.geloescht');
            await zeigeGalerie(token, toern);
          }
        })());
        li.append(weg);
      }
      raster.append(li);
    }
    gruppe.append(kopf, raster);
    gruppen.push(gruppe);
  }
  ziel.replaceChildren(...gruppen);
}

export function initCrewFotos(holeToken: () => string | null, holeToern: () => ToernZeile | null): {
  lade: (toern: ToernZeile) => Promise<void>;
} {
  const overlay = $('foto-overlay');
  const modalEl = $('foto-modal');
  const datei = $('in-foto-datei') as HTMLInputElement | null;
  const kamera = $('in-foto-kamera') as HTMLInputElement | null;
  const status = $('foto-status');
  if (!overlay || !modalEl || !datei || !kamera) return { lade: async () => {} };
  const schliesse = () => {
    overlay.hidden = true;
    modal.beimSchliessen();
    entwuerfe = [];
    for (const u of urls.splice(0)) URL.revokeObjectURL(u);
  };
  const modal = initModal(modalEl, schliesse);

  
  
  const kameraKnopf = $('btn-foto-kamera');
  if (kameraKnopf && window.matchMedia('(pointer: coarse)').matches && navigator.mediaDevices?.enumerateDevices) {
    void navigator.mediaDevices.enumerateDevices()
      .then((g) => { if (g.some((x) => x.kind === 'videoinput')) kameraKnopf.hidden = false; })
      .catch(() => { kameraKnopf.hidden = false; });
  }

  const nimm = async (dateien: FileList | null, mitKamera: boolean) => {
    if (!dateien?.length) return;
    if (status) status.textContent = wort('fotos.lesen');
    const neu: Entwurf[] = [];
    for (const f of Array.from(dateien)) {
      const e = await entwurfAus(f, mitKamera);
      if (e) neu.push(e); else if (status) status.textContent = wort('fotos.unlesbar');
    }
    if (!neu.length) return;
    if (status) status.textContent = '';
    entwuerfe = neu;
    zeigeEntwuerfe();
    overlay.hidden = false;
    modal.beimOeffnen();
  };
  $('btn-foto-datei')?.addEventListener('click', () => datei.click());
  kameraKnopf?.addEventListener('click', () => kamera.click());
  datei.addEventListener('change', () => { void nimm(datei.files, false).finally(() => { datei.value = ''; }); });
  kamera.addEventListener('change', () => { void nimm(kamera.files, true).finally(() => { kamera.value = ''; }); });
  $('foto-schliessen')?.addEventListener('click', schliesse);
  $('btn-foto-abbrechen')?.addEventListener('click', schliesse);

  $('btn-foto-hochladen')?.addEventListener('click', () => void (async () => {
    const token = holeToken(), toern = holeToern();
    const dialogStatus = $('foto-dialog-status');
    if (!token || !toern || !entwuerfe.length) return;
    let n = 0;
    for (const e of entwuerfe) {
      if (dialogStatus) dialogStatus.textContent = wort('fotos.laedtHoch', { n: String(n + 1), m: String(entwuerfe.length) });
      
      const ort = e.ort
        ? { lat: e.ort.lat, lon: e.ort.lon, quelle: e.ort.quelle, ...(e.ort.endgueltig && e.ort.name !== undefined ? { name: e.ort.name } : {}) }
        : null;
      const id = await ladeCrewFotoHoch(token, toern.id, {
        bild: e.bild, breite: e.breite, hoehe: e.hoehe, t: e.t, zeitQuelle: e.zeitQuelle, ort, text: e.text.trim() || null,
      });
      if (!id) { if (dialogStatus) dialogStatus.textContent = wort('fotos.fehler'); return; }
      n++;
    }
    if (dialogStatus) dialogStatus.textContent = '';
    schliesse();
    if (status) status.textContent = wort('fotos.fertig', { n: String(n) });
    await zeigeGalerie(token, toern);
  })());

  return {
    lade: async (toern: ToernZeile) => {
      const token = holeToken();
      if (token) await zeigeGalerie(token, toern);
    },
  };
}
