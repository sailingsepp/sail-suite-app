import type { Sprache } from '@/core/types';
import { holeDhmzBericht } from '@/data/dhmz';
import { ladeHnmsSeegebiete } from '@/data/hnms';
import { holeGebietsBericht, ladeMeteomarSeegebiete } from '@/data/seebericht';
import { describeSeewetterbericht, describeGebietsSeewetterbericht, gebietsBerichtAlsAmtlich, amtlicheWarnung, describeZweitfassung } from '@/briefing/amtlich';
import { seegebieteAn, istGriechisch } from '@/core/hnmsSeegebiet';
import { mgmGebietAn } from '@/core/mgmSeegebiet';
import { seeberichtLand, inAdriaBox, beiZypern, passendeGebiete, ZYPERN_KUESTE, gewaesserStaat, warnlageUnklar, staatGefragt, type SeeberichtLand } from '@/core/seeberichtWahl';
import { fetchSeegebiet } from '@/data/seegebiete';
import { hoheitAusKacheln } from '@/data/hoheitKacheln';
import { hoheitsStaat } from '@/briefing/seegebiet';
import { aemetRegionAn } from '@/core/aemetRegion';
import { aktuelleFixe, aktuellerZustand } from './aufzeichnung';

import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { istOnline } from './netz';
import { STRINGS } from './strings';
import { holeWarnungen } from '@/data/warnungen';
import { warnungenFuer, type WarnDaten } from '@/core/warnungen';
import { warnDienste, warnGebiete, warnName, warnQuelle, warnZeitraum } from '@/briefing/warnungen';
import type { WarnTreffer } from '@/core/warnungen';

function yachtPosition(): { lat: number; lon: number } | undefined {
  return aktuellerZustand().position ?? aktuelleFixe().at(-1) ?? undefined;
}

const $ = (id: string) => document.getElementById(id);
const wort = (k: string): string => STRINGS[aktuelleSprache()][k] ?? k;

let modal: ModalHandle | null = null;

let abruf = 0;

type Land = SeeberichtLand;

const ZEITZONE: Record<Land, string> = {
  hr: 'Europe/Zagreb', gr: 'Europe/Athens', it: 'Europe/Rome', tr: 'Europe/Istanbul',
  es: 'Europe/Madrid', cy: 'Asia/Nicosia',
};

export function vortag(tag: string): string {
  return new Date(Date.parse(`${tag}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

function heuteImRevier(land: Land): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZEITZONE[land], year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

interface Lage { gr: string[]; it: string[]; tr: string[]; es: string[]; zypern: boolean; adria: boolean; staat: string | null }

const staaten = new Map<string, string | null>();
async function staatAn(lat: number, lon: number): Promise<string | null> {
  const k = `${(Math.round(lat * 20) / 20).toFixed(2)},${(Math.round(lon * 20) / 20).toFixed(2)}`;
  if (staaten.has(k)) return staaten.get(k)!;

  const h = await hoheitAusKacheln(lat, lon, istOnline()).catch(() => undefined);
  const ausKachel = h?.zone ? hoheitsStaat(h.zone.name) : null;
  if (ausKachel) { staaten.set(k, ausKachel); return ausKachel; }
  const a = await fetchSeegebiet(lat, lon).catch(() => null);
  const s = gewaesserStaat(a, hoheitsStaat);
  if (s) staaten.set(k, s);
  return s;
}

async function eigeneLage(f: { lat: number; lon: number } | undefined = yachtPosition()): Promise<Lage> {
  if (!f) return { gr: [], it: [], tr: [], es: [], zypern: false, adria: false, staat: null };
  const namen = async (laden: () => Promise<Parameters<typeof seegebieteAn>[2]>) => {
    try { return seegebieteAn(f.lat, f.lon, await laden()).map((t) => t.name); } catch { return []; }
  };
  const tr = mgmGebietAn(f.lat, f.lon);
  const es = aemetRegionAn(f.lat, f.lon);
  const gr = await namen(ladeHnmsSeegebiete);
  const adria = inAdriaBox(f.lat, f.lon);
  return {
    es: es ? [es] : [],
    zypern: beiZypern(f.lat, f.lon),
    gr,
    it: await namen(ladeMeteomarSeegebiete),
    tr: tr ? [tr] : [],
    adria,
    staat: staatGefragt({ adria, griechisch: istGriechisch(gr) }) ? await staatAn(f.lat, f.lon) : null,
  };
}

const LANDNAME: Record<Land, string> = {
  hr: 'seewetter.kroatien', gr: 'seewetter.griechenland', it: 'seewetter.italien', tr: 'seewetter.tuerkei',
  es: 'seewetter.spanien', cy: 'seewetter.zypern',
};
function zeigeTitel(land: Land | null): void {
  const t = $('tb-seewetter-titel');
  if (t) t.textContent = land ? `${wort('seewetter.titel')} ${wort(LANDNAME[land])}` : wort('seewetter.titel');
}

async function lade(): Promise<void> {
  const inhalt = $('tb-seewetter-inhalt');
  const erneut = $('btn-seewetter-erneut');
  if (!inhalt) return;
  const nr = ++abruf;
  if (erneut) erneut.hidden = true;
  zeigeTitel(null);
  inhalt.innerHTML = '';
  const laedt = document.createElement('p');
  laedt.className = 'tb-hinweis';
  laedt.textContent = wort('seewetter.laedt');
  inhalt.appendChild(laedt);

  const sprache = aktuelleSprache();
  const lage = await eigeneLage();
  if (nr !== abruf) return;

  const land: Land = seeberichtLand({
    griechisch: istGriechisch(lage.gr), zypern: lage.zypern, tuerkisch: lage.tr.length > 0,
    spanisch: lage.es.length > 0, adria: lage.adria, italienisch: lage.it.length > 0, staat: lage.staat,
  }) ?? 'hr';
  zeigeTitel(land);

  const pos = yachtPosition();
  const warnP = pos ? holeWarnungen([pos.lat - 0.5, pos.lon - 0.7, pos.lat + 0.5, pos.lon + 0.7]) : Promise.resolve(null);

  try {
    if (land === 'hr') {
      const bericht = await holeDhmzBericht(sprache);
      if (nr !== abruf) return;
      if (bericht) {
        inhalt.innerHTML = describeSeewetterbericht(bericht, heuteImRevier('hr'), sprache);
        return;
      }
    } else {
      const b = await holeGebietsBericht(({ gr: 'hnms', it: 'meteomar', tr: 'mgm', es: 'aemet', cy: 'dom' } as const)[land]);
      if (nr !== abruf) return;
      if (b) {
        const eigene = passendeGebiete(b.gebiete, land === 'es' ? { gruppen: lage.es }
          : land === 'cy' ? { gruppen: lage.zypern ? [ZYPERN_KUESTE] : [], hnms: lage.gr }
            : { namen: lage[land] });
        inhalt.innerHTML = describeGebietsSeewetterbericht(b, eigene, heuteImRevier(land), sprache);
        if (land === 'es') await zweitfassungSpanien(inhalt, lage.it, nr, sprache);
        return;
      }
    }

    inhalt.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'tb-sw-fehlt';
    p.textContent = wort(!istOnline() ? 'seewetter.offline'
      : land === 'hr' ? 'seewetter.nichtVerfuegbar' : `seewetter.nichtVerfuegbar${land.charAt(0).toUpperCase()}${land.slice(1)}`);
    inhalt.appendChild(p);
    if (erneut) erneut.hidden = false;
  } finally {
    void haengeWarnungenAn(inhalt, nr, warnP, pos ?? null);
  }
}

async function haengeWarnungenAn(
  inhalt: HTMLElement, nr: number, warnP: Promise<WarnDaten | null>, pos: { lat: number; lon: number } | null,
): Promise<void> {
  if (!pos) return;
  const daten = await warnP.catch(() => null);
  if (nr !== abruf) return;
  const sprache = aktuelleSprache();
  const jetzt = Date.now();
  const box = document.createElement('section');
  box.className = 'tb-sw-wetterwarnungen';
  const h = document.createElement('h3');
  h.textContent = wort('seewetter.warnTitel');
  box.appendChild(h);

  const unter = document.createElement('p');
  unter.className = 'tb-hinweis';
  unter.textContent = wort('seewetter.warnUnter');
  box.appendChild(unter);
  if (!daten) {
    const p = document.createElement('p');
    p.className = 'tb-hinweis';
    p.textContent = wort(istOnline() ? 'seewetter.warnFehlt' : 'seewetter.warnOffline');
    box.appendChild(p);
  } else {
    const treffer = warnungenFuer(daten, [pos], jetzt, jetzt + 24 * 3600_000);
    if (!treffer.length) {
      const p = document.createElement('p');
      p.textContent = wort('seewetter.warnKeine');
      box.appendChild(p);
    }

    for (const t of treffer) {
      const d = document.createElement('div');
      d.className = `tb-sw-mw stufe-${t.stufe}`;
      if (t.stufe >= 3) d.setAttribute('role', 'alert');
      const name = warnName(t, sprache);
      const k = document.createElement('b');
      k.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      const wo = document.createElement('span');
      wo.textContent = `${warnGebiete(t, sprache)} · ${warnZeitraum(t, sprache)}`;
      const wer = document.createElement('span');
      wer.className = 'tb-sw-mw-dienst';
      wer.textContent = warnDienste(t);
      d.append(k, wo, wer);
      box.appendChild(d);
    }
    const q = document.createElement('p');
    q.className = 'tb-hinweis';
    q.textContent = warnQuelle(sprache);
    box.appendChild(q);
  }

  const stand = inhalt.firstElementChild;
  if (stand?.classList.contains('tb-sw-stand')) stand.after(box);
  else inhalt.prepend(box);
}

async function zweitfassungSpanien(inhalt: HTMLElement, gebiete: string[], nr: number, sprache: Sprache): Promise<void> {
  if (!gebiete.length) return;
  const mm = await holeGebietsBericht('meteomar');
  if (nr !== abruf || !mm) return;
  const b = gebietsBerichtAlsAmtlich(mm, passendeGebiete(mm.gebiete, { namen: gebiete }));
  if (!b) return;
  const heute = heuteImRevier('it');
  const warn = amtlicheWarnung(b, heute, sprache);
  const div = document.createElement('div');
  div.className = 'tb-sw-zweit';
  div.innerHTML = `${warn ? `<div class="tb-sw-warnung" role="alert">${warn}</div>` : ''}${describeZweitfassung(b, heute, sprache)}`;
  inhalt.appendChild(div);
}

export function oeffneSeewetter(): void { oeffne(); }

function oeffne(): void {
  const el = $('tb-seewetter-modal');
  if (!el) return;
  el.removeAttribute('hidden');
  modal?.beimOeffnen();
  void lade();
}

function schliesse(): void {
  abruf++;
  $('tb-seewetter-modal')?.setAttribute('hidden', '');
  modal?.beimSchliessen();
}

export function seewetterNeuZeichnen(): void {
  if ($('tb-seewetter-modal')?.hasAttribute('hidden') === false) void lade();
}

export function initSeewetter(): void {
  const el = $('tb-seewetter-modal');
  if (el) modal = initModal(el, schliesse);
  $('btn-seewetter-zu')?.addEventListener('click', schliesse);
  $('btn-seewetter-erneut')?.addEventListener('click', () => void lade());
}

export async function warnlageAktuell(
  pos: { lat: number; lon: number } | null = aktuelleFixe().at(-1) ?? null,
): Promise<{ land: 'hr' | 'gr' | 'it' | 'es'; gebiete: string[]; gruppen: string[] } | null> {
  const f = pos ?? undefined;
  if (!f) return null;
  const lage = await eigeneLage(f);
  const land = seeberichtLand({
    griechisch: istGriechisch(lage.gr), zypern: lage.zypern, tuerkisch: lage.tr.length > 0,
    spanisch: lage.es.length > 0, adria: lage.adria, italienisch: lage.it.length > 0, staat: lage.staat,
  });

  if (warnlageUnklar({ adria: lage.adria, italienisch: lage.it.length > 0, staat: lage.staat })) return null;
  if (land === 'hr') return { land, gebiete: [], gruppen: [] };
  if (land === 'gr') return { land, gebiete: lage.gr, gruppen: [] };
  if (land === 'it') return { land, gebiete: lage.it, gruppen: [] };
  if (land === 'es') return { land, gebiete: lage.it, gruppen: lage.es };
  return null;
}

export async function warnungenAnPosition(
  pos: { lat: number; lon: number } | undefined = yachtPosition(),
): Promise<{ seewetter: boolean | null; meteoalarm: WarnTreffer[] | null }> {
  if (!pos) return { seewetter: null, meteoalarm: null };
  const sprache = aktuelleSprache();
  const jetzt = Date.now();
  const [lage, daten] = await Promise.all([eigeneLage(pos), holeWarnungen([pos.lat - 0.5, pos.lon - 0.7, pos.lat + 0.5, pos.lon + 0.7])]);
  const meteoalarm = daten ? warnungenFuer(daten, [pos], jetzt, jetzt + 60_000) : null;
  const land = seeberichtLand({
    griechisch: istGriechisch(lage.gr), zypern: lage.zypern, tuerkisch: lage.tr.length > 0,
    spanisch: lage.es.length > 0, adria: lage.adria, italienisch: lage.it.length > 0, staat: lage.staat,
  });
  if (!land) return { seewetter: false, meteoalarm };
  let seewetter: boolean | null = null;
  try {
    if (land === 'hr') {
      const b = await holeDhmzBericht(sprache);
      seewetter = b ? amtlicheWarnung(b, heuteImRevier('hr'), sprache, new Date()) != null : null;
    } else {
      const b = await holeGebietsBericht(({ gr: 'hnms', it: 'meteomar', tr: 'mgm', es: 'aemet', cy: 'dom' } as const)[land]);
      if (b) {
        const eigene = passendeGebiete(b.gebiete, land === 'es' ? { gruppen: lage.es }
          : land === 'cy' ? { gruppen: lage.zypern ? [ZYPERN_KUESTE] : [], hnms: lage.gr }
            : { namen: lage[land] });

        const heute = heuteImRevier(land);
        const tag = b.datum === vortag(heute) ? b.datum : heute;
        seewetter = amtlicheWarnung(gebietsBerichtAlsAmtlich(b, eigene), tag, sprache) != null;
      }
    }
  } catch {
    seewetter = null;
  }
  return { seewetter, meteoalarm };
}
