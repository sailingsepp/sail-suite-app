import { escapeHtml } from '@/core/html';
import { beaufort } from '@/briefing/wind';
import { druckTendenz, gewitterLage, gewitterUrteil, ortszeit, schwuele, seegangAnzeige, sichtAnzeige, richtungKurz, stundenIndex, type DruckTendenz, type Stunde, type Stundenwetter, type WetterOrt } from '@/core/zielwetter';
import { douglasTabelle } from '@/kompendium/daten';
import { nf } from '@/core/time';
import { gewitterStufe } from '@/core/wetterkarte';
import { druckStufe } from '@/briefing/stationen';
import { holeStundenwetter } from '@/data/stundenwetter';
import { bftBalken, himmelAus, himmelBild, himmelText, windBild } from '@/map/wetterbild';
import { distNM } from '@/core/geo';
import { positionText } from '@/core/koordinaten';
import { aktuelleSprache } from '@/shell/sprache';
import { STRINGS } from './strings';
import { standOrt } from './standortName';
import { beiZielname, zielname } from '@/shell/zielname';
import { beiBlitzen, beobachteterBlitz } from './blitzwache';
import { amtlicheGewitterwarnung, beiWarnung } from './stationen';
import { uhrLtVon } from '@/core/time';
import { richtungAusgeschrieben } from '@/map/wetterbild';

const isoLt = (iso: string): string => `${iso.slice(11, 13)}${iso.slice(14, 16)} LT`;

const NEU_NACH_MS = 30 * 60_000;
const NEU_AB_SM = 2;
const VERLAUF_STUNDEN = 6;

const wort = (k: string): string => STRINGS[aktuelleSprache()][k] ?? k;

let daten: Stundenwetter | null = null;
let datenOrt: { lat: number; lon: number } | null = null;
let datenMs = 0;
let laedt = false;
let fehlgeschlagen = false;
let fehlerMs = 0;
let zuletzt: WetterOrt | null = null;

const NEU_NACH_FEHLER_MS = 2 * 60_000;

function brauchtAbruf(o: WetterOrt): boolean {
  if (laedt) return false;
  if (fehlgeschlagen && Date.now() - fehlerMs < NEU_NACH_FEHLER_MS) return false;
  if (!daten || !datenOrt) return true;
  if (distNM(datenOrt.lat, datenOrt.lon, o.lat, o.lon) > NEU_AB_SM) return true;
  return Date.now() - datenMs > NEU_NACH_MS;
}

async function lade(o: WetterOrt): Promise<void> {
  laedt = true;
  const neu = await holeStundenwetter(o.lat, o.lon);
  laedt = false;
  if (neu) {
    daten = neu; datenOrt = { lat: o.lat, lon: o.lon }; datenMs = Date.now(); fehlgeschlagen = false;
  } else {
    fehlgeschlagen = true;
    fehlerMs = Date.now();
  }
  if (zuletzt) zeichneZielwetter(zuletzt);
}

function pfeil(windAus: number): string {
  return `<svg class="tb-zw-pfeil" viewBox="0 0 16 16" aria-hidden="true"><g transform="rotate(${Math.round((windAus + 180) % 360)} 8 8)">`
    + '<path d="M8 1.5l4 5.5h-2.5v7.5h-3V7H4z" fill="currentColor"/></g></svg>';
}

const stufe = (bft: number) => (bft <= 3 ? 0 : bft <= 5 ? 1 : bft <= 7 ? 2 : 3);

function druckZelle(t: DruckTendenz | null, sprache: 'de' | 'en'): { zelle: string; folgerung: string | null } {
  if (!t) return { zelle: '', folgerung: null };
  const wortTendenz = t.stufe === 0 ? wort('zw.tendenz.0') : wort(`zw.${t.aenderung > 0 ? 'steigt' : 'faellt'}.${t.stufe}`);
  const zahl = `${t.aenderung > 0 ? '+' : t.aenderung < 0 ? '−' : '±'}${nf(Math.abs(t.aenderung), 1, sprache)}`;
  const aenderung = wort('zw.in3h').replace('{d}', zahl);
  const hPa = `${Math.round(t.hPa)} hPa`;
  const ampel = druckStufe({ druckHpa: t.hPa, druckTendenzHpa: t.aenderung });
  const farbe = ampel === 'rot' ? ' tb-zw-farbig tb-zw-stufe-3' : ampel === 'gelb' ? ' tb-zw-farbig tb-zw-stufe-1' : '';
  const folgerung = ampel === 'rot' ? wort('zw.druckKaltfront')
    : ampel === 'gelb' ? wort(t.aenderung < 0 ? 'zw.druckFall' : 'zw.druckAnstieg') : null;
  return {
    zelle: zelle(wort('zw.druck'), escapeHtml(hPa),
      `<span class="tb-zw-tendenz${farbe}">${escapeHtml(`${wortTendenz}, `)}<span class="tb-zw-nb">${escapeHtml(aenderung)}</span></span>`, true),
    folgerung,
  };
}

function zelle(k: string, wertHtml: string, zusatzHtml = '', breit = false): string {
  return `<div class="tb-zw-zelle${breit ? ' tb-zw-breit' : ''}"><span class="tb-zw-k">${escapeHtml(k)}</span>`
    + `<b>${wertHtml}</b>${zusatzHtml ? `<span class="tb-zw-zusatz">${zusatzHtml}</span>` : ''}</div>`;
}

const farbig = (txt: string, stufeNr: number | null): string =>
  stufeNr == null ? escapeHtml(txt) : `<span class="tb-zw-farbig tb-zw-marke tb-zw-marke-${stufeNr}">${escapeHtml(txt)}</span>`;

function seegangZelle(s: Stunde, sprache: 'de' | 'en'): string {
  const a = seegangAnzeige(s);
  const wasser = s.wasserTemp != null ? `${wort('zw.wasser')} ${nf(Math.round(s.wasserTemp), 0, sprache)} °C` : null;
  if (!a) return zelle(wort('zw.seegang'), '–', wasser ? escapeHtml(wasser) : '', true);
  const name = douglasTabelle(sprache)[a.stufe]!.name;
  const m = (x: number) => `${nf(Math.round(x * 10) / 10, 1, sprache)} m`;
  const teil = (h: number | null | undefined, t: number | null | undefined, aus: number | null | undefined): string | null =>
    h == null ? null : [`${m(h)}${t != null ? `, ${Math.round(t)} s` : ''}`, aus != null ? wort('zw.aus').replace('{r}', richtungKurz(aus, sprache)) : null]
      .filter(Boolean).join(' ');
  const gesamt = [s.periodeS != null ? `${Math.round(s.periodeS)} s` : null, s.seeAus != null ? wort('zw.aus').replace('{r}', richtungKurz(s.seeAus, sprache)) : null].filter(Boolean).join(' ');
  const windsee = teil(s.windseeM, s.windseePeriodeS, s.windseeAus);
  const duenung = teil(s.duenungM, s.duenungPeriodeS, s.duenungAus);
  const zeile2 = [windsee ? `${wort('zw.windsee')} ${windsee}` : null, duenung ? `${wort('zw.duenung')} ${duenung}` : null, wasser].filter(Boolean).join(' · ');
  const wert = `${escapeHtml(`${m(a.hsM)}${gesamt ? ` · ${gesamt}` : ''}`)}${a.steil ? farbig(wort(`zw.steil.${a.steil}`), a.steil) : ''}`;
  const zusatz = `${escapeHtml(sprache === 'en' ? name.toLowerCase() : name)}${zeile2 ? `<br>${escapeHtml(zeile2)}` : ''}`;
  return zelle(wort('zw.seegang'), wert, zusatz, true);
}

function uebersicht(d: Stundenwetter, i: number, sprache: 'de' | 'en', o: WetterOrt): string {
  const s = d.stunden[i]!;
  const strich = '–';
  const h = himmelAus(s.code);
  const zellen: string[] = [];
  zellen.push(zelle(wort('zw.himmel'), `<span class="tb-zw-farbig tb-zw-himmelbild">${himmelBild(h, s.tag)}</span>${escapeHtml(himmelText(h, s.tag, sprache))}`,
    escapeHtml([
      s.wolken != null ? wort('zw.wolken').replace('{p}', String(Math.round(s.wolken))) : null,
      s.tag && s.uv != null ? `${wort('zw.uv')} ${nf(Math.round(s.uv), 0, sprache)}` : null,
    ].filter(Boolean).join(' · '))));
  zellen.push(zelle(wort('zw.temp'), escapeHtml(`${nf(Math.round(s.temperatur), 0, sprache)} °C`),
    s.gefuehlt != null ? escapeHtml(wort('zw.gefuehlt').replace('{t}', `${nf(Math.round(s.gefuehlt), 0, sprache)} °C`)) : ''));
  zellen.push(zelle(wort('zw.feuchte'), escapeHtml(s.feuchte != null ? `${Math.round(s.feuchte)} %` : strich)));
  const sw = schwuele(s.taupunkt);
  zellen.push(zelle(wort('zw.taupunkt'), escapeHtml(s.taupunkt != null ? `${nf(Math.round(s.taupunkt), 0, sprache)} °C` : strich),
    sw ? farbig(wort(`zw.schwuel.${sw}`), sw) : ''));
  const regen = s.regenMm != null ? `${nf(Math.round(s.regenMm * 10) / 10, 1, sprache)} mm` : strich;
  zellen.push(zelle(wort('zw.regen'), escapeHtml(regen),
    s.regenWahrsch != null ? escapeHtml(wort('zw.regenWahrsch').replace('{p}', String(Math.round(s.regenWahrsch)))) : ''));
  if (s.sichtM != null) {
    const v = sichtAnzeige(s.sichtM, sprache);
    zellen.push(zelle(wort('zw.sicht'), escapeHtml(v.text), farbig(wort(`zw.sicht.${v.stufe}`), v.stufe ? v.stufe : null)));
  } else {
    zellen.push(zelle(wort('zw.sicht'), strich));
  }
  zellen.push(seegangZelle(s, sprache));
  const druck = druckZelle(druckTendenz(d, i), sprache);
  if (druck.zelle) zellen.push(druck.zelle);

  const g = gewitterLage(d, i, VERLAUF_STUNDEN);
  const u = gewitterUrteil(g, beobachteterBlitz({ lat: o.lat, lon: o.lon }), o.art === 'position' ? amtlicheGewitterwarnung() : null);
  let gewitterFolge: string | null = null;
  if (u && g) {
    const cape = g.capeMax != null ? `CAPE ${Math.round(g.capeMax)} J/kg` : '';
    let wert: string, nr: number | null, zusatz: string;
    if (u.art === 'beobachtet') {
      wert = wort('zw.gewitter.beobachtet').replace('{sm}', nf(u.sm, u.sm < 10 ? 1 : 0, sprache))
        .replace('{richtung}', richtungAusgeschrieben(u.peilung, sprache));
      nr = 3;
      zusatz = [wort('zw.gewitter.quelleBlitze').replace('{uhr}', uhrLtVon(u.t)), cape].filter(Boolean).join(' · ');
      gewitterFolge = wort('zw.gewitterFolge.gewitter');
    } else if (u.art === 'amtlich') {
      wert = wort('zw.gewitter.amtlich');
      nr = u.stufe >= 3 ? 3 : 2;
      zusatz = [wort(`zw.gewitter.amtlichStufe${u.stufe}`), cape].filter(Boolean).join(' · ');
      gewitterFolge = wort('zw.gewitterFolge.gewitter');
    } else if (u.art === 'modell') {
      wert = wort(`zw.gewitter.${u.stufe}`).replace('{uhr}', u.ab ? isoLt(u.ab) : '');
      nr = u.stufe === 'gewitter' ? 3 : 2;
      zusatz = cape;
      gewitterFolge = wort(`zw.gewitterFolge.${u.stufe}`);
    } else {
      wert = g.capeMax == null && s.code < 95 ? strich : wort('zw.gewitter.keine');
      nr = null;
      zusatz = cape;
    }
    zellen.push(zelle(wort('zw.gewitter'), farbig(wert, nr), escapeHtml(zusatz), true));
  }
  const folgen = [gewitterFolge, druck.folgerung].filter((x): x is string => !!x)
    .map((f) => `<p class="tb-zw-folge">${escapeHtml(f)}</p>`).join('');
  return `<div class="tb-zw-tabelle">${zellen.join('')}</div>${folgen}`;
}

beiZielname(() => { if (zuletzt) zeichneZielwetter(zuletzt); });

beiBlitzen(() => { if (zuletzt) zeichneZielwetter(zuletzt); });
beiWarnung(() => { if (zuletzt) zeichneZielwetter(zuletzt); });
function ortsname(o: WetterOrt): string | null {
  if (o.art === 'position') return standOrt({ lat: o.lat, lon: o.lon })?.name ?? positionText(o.lat, o.lon, aktuelleSprache());

  return zielname(o.lat, o.lon) ?? o.name ?? positionText(o.lat, o.lon, aktuelleSprache());
}

export function zeichneZielwetter(o: WetterOrt | null): void {
  const el = document.getElementById('tb-zielwetter');
  if (!el) return;
  zuletzt = o;
  el.hidden = !o;
  if (!o) return;
  if (brauchtAbruf(o)) void lade(o);
  const sprache = aktuelleSprache();
  const titel = wort(o.art === 'ziel' ? 'zw.titelZiel' : 'zw.titelPosition');
  const name = ortsname(o);
  const kopf = `<h2>${escapeHtml(titel)}</h2>${name ? `<p class="tb-zw-ort">${escapeHtml(name)}</p>` : ''}`;

  const passend = daten && datenOrt && distNM(datenOrt.lat, datenOrt.lon, o.lat, o.lon) <= NEU_AB_SM;
  if (!passend || !daten) {

    el.innerHTML = `${kopf}<p class="tb-hinweis">${escapeHtml(wort(fehlgeschlagen ? 'zw.fehlt' : 'zw.laedt'))}</p>`;
    return;
  }
  const zeitpunkt = o.ankunft ?? Date.now();
  let i = stundenIndex(daten, zeitpunkt);
  if (i < 0) i = stundenIndex(daten, Date.now());
  if (i < 0) {
    el.innerHTML = `${kopf}<p class="tb-hinweis">${escapeHtml(wort('zw.fehlt'))}</p>`;
    return;
  }
  const s = daten.stunden[i]!;

  const kn = Math.round(s.windKn);
  const bft = beaufort(kn);
  const boe = s.boeenKn == null ? null : Math.round(s.boeenKn);
  const boeBft = boe == null ? null : beaufort(boe);
  const r = richtungKurz(s.windAus, sprache);
  const stand = [
    o.ankunft ? wort('zw.ankunft').replace('{uhr}', isoLt(ortszeit(o.ankunft, daten.offsetS))) : null,
    wort('zw.vorhersage').replace('{uhr}', isoLt(s.zeit)),
    fehlgeschlagen ? wort('zw.stand').replace('{uhr}', isoLt(ortszeit(datenMs, daten.offsetS))) : null,
  ].filter(Boolean).join(' · ');
  const h = himmelAus(s.code);
  const himmel = himmelText(h, s.tag, sprache);
  const temp = `${Math.round(s.temperatur)} °C`;
  const verlauf = daten.stunden.slice(i, i + VERLAUF_STUNDEN).map((v) => {
    const b = v.boeenKn == null ? null : Math.round(v.boeenKn);

    const gw = gewitterStufe(v.code, v.cape ?? null, v.liftedIndex ?? null);
    return `<div class="tb-zw-stunde${gw ? ` tb-zw-gw-${gw}` : ''}"><span class="tb-zw-uhr">${v.zeit.slice(11, 13)}</span>${pfeil(v.windAus)}`
      + `<b>${Math.round(v.windKn)}</b><i class="tb-zw-farbig tb-zw-stufe-${stufe(beaufort(Math.round(v.boeenKn ?? v.windKn)))}">${b ?? '–'}</i></div>`;
  }).join('');
  const label = [titel, name, stand, `${wort('zw.aus').replace('{r}', r)} ${kn} kn, ${bft} Bft`,
    boe != null ? `${wort('zw.boeen')} ${boe} kn` : null, `${himmel}, ${temp}`].filter(Boolean).join('. ');
  el.innerHTML = kopf
    + `<p class="tb-hinweis tb-zw-zeit">${escapeHtml(stand)}</p>`
    + `<div class="tb-zw-haupt" role="img" aria-label="${escapeHtml(label)}">`
    + `<span class="tb-zw-farbig">${windBild(s.windAus, bft, sprache)}</span>`
    + `<div class="tb-zw-wert"><span class="tb-zw-k">${escapeHtml(wort('zw.wind'))}</span><b>${kn}<small>kn</small></b>`
    + `<span>${escapeHtml(wort('zw.aus').replace('{r}', r))} · ${bft} Bft</span></div>`
    + `<div class="tb-zw-wert"><span class="tb-zw-k">${escapeHtml(wort('zw.boeen'))}</span>`
    + `<b class="tb-zw-farbig tb-zw-stufe-${stufe(boeBft ?? bft)}">${boe ?? '–'}<small>kn</small></b>`
    + `<span>${boeBft != null ? `${boeBft} Bft` : ''}</span></div></div>`
    + `<div class="tb-zw-farbig">${bftBalken(bft)}</div>`
    + `<div class="tb-zw-verlauf" aria-hidden="true">${verlauf}</div>`
    + uebersicht(daten, i, sprache, o)
    + `<p class="tb-zw-quelle">${escapeHtml(wort('zw.quelle'))}: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>, ECMWF (CC BY 4.0)</p>`;
}
