import { nf, pad, uhrLt } from '@/core/time';
import type { GezeitenLage } from '@/core/gezeitenLage';
import type { Sprache } from '@/core/types';
import { escapeHtml } from '@/core/html';

const H = 250;
const PAD = { l: 34, r: 70, t: 34, b: 36 };

export interface GezeitenGrafikEingabe {

  lage: GezeitenLage;
  jetzt?: Date | null;

  marke?: { zeit: Date; text: string } | null;
  sprache: Sprache;

  breite?: number;
}

interface Skala { t0: number; t1: number; y0: number; y1: number; w: number }

const x = (s: Skala, ms: number) => PAD.l + ((ms - s.t0) / (s.t1 - s.t0)) * (s.w - PAD.l - PAD.r);
const y = (s: Skala, h: number) => PAD.t + (1 - (h - s.y0) / (s.y1 - s.y0)) * (H - PAD.t - PAD.b);
const r1 = (v: number) => Math.round(v * 10) / 10;

function schrittWahl(spanne: number): number {
  for (const s of [0.05, 0.1, 0.2, 0.25, 0.5, 1]) if (spanne / s <= 6) return s;
  return 2;
}

function bezugslinien(lage: GezeitenLage, en: boolean): { name: string; h: number; rang: number }[] {
  const k = lage.kennwerte;
  if (!k || lage.bezug !== 'ngzw') return [];
  const u = -k.lat;
  return [
    { name: en ? 'MHWS' : 'MSpHW', h: k.mspHW + u, rang: 1 },
    { name: en ? 'MHWN' : 'MNpHW', h: k.mnpHW + u, rang: 3 },
    { name: en ? 'MSL' : 'MW', h: u, rang: 2 },
    { name: en ? 'MLWN' : 'MNpNW', h: k.mnpNW + u, rang: 3 },
    { name: en ? 'MLWS' : 'MSpNW', h: k.mspNW + u, rang: 1 },
    { name: en ? 'LAT' : 'NGzW', h: 0, rang: 2 },
  ];
}

export function gezeitenGrafikHtml(e: GezeitenGrafikEingabe): string {
  const { lage, sprache } = e;
  const en = sprache === 'en';
  if (lage.kurve.length < 2) return '';
  const linien = bezugslinien(lage, en);
  const t0 = lage.kurve[0]!.zeit.getTime();
  const t1 = lage.kurve[lage.kurve.length - 1]!.zeit.getTime();
  const hoehen = [...lage.kurve, ...lage.mitWetter].map((p) => p.hoeheM).concat(linien.map((l) => l.h));
  let y0 = Math.min(...hoehen), y1 = Math.max(...hoehen);

  const luft = ((y1 - y0) || 0.1) * 0.22;
  y0 -= luft; y1 += luft;
  const schritt = schrittWahl((y1 - y0) || 0.1);
  y0 = Math.floor(y0 / schritt) * schritt;
  y1 = Math.ceil(y1 / schritt) * schritt;
  const W = e.breite ?? 600;
  const s: Skala = { t0, t1, y0, y1, w: W };
  const teile: string[] = [];

  for (let h = y0; h <= y1 + 1e-9; h += schritt) {
    const yy = y(s, h);
    teile.push(`<line class="gz-raster" x1="${PAD.l}" x2="${W - PAD.r}" y1="${yy}" y2="${yy}"/>`
      + `<text class="gz-achse" x="${PAD.l - 6}" y="${yy + 4}" text-anchor="end">${nf(h, schritt < 0.1 ? 2 : 1, sprache)}</text>`);
  }

  const stundenSchritt = ((t1 - t0) / 3600e3) / ((W - PAD.l - PAD.r) / 45) > 3 ? 6 : 3;
  const ersteStunde = Math.ceil(t0 / 3600e3 / stundenSchritt) * stundenSchritt;
  for (let st = ersteStunde; st * 3600e3 <= t1; st += stundenSchritt) {
    const ms = st * 3600e3;
    const d = new Date(ms);
    const xx = x(s, ms);
    const mitternacht = d.getUTCHours() === 0;
    teile.push(`<line class="${mitternacht ? 'gz-raster gz-tag' : 'gz-raster'}" x1="${xx}" x2="${xx}" y1="${PAD.t}" y2="${H - PAD.b}"/>`
      + `<text class="gz-achse" x="${xx}" y="${H - PAD.b + 15}" text-anchor="middle">${pad(d.getUTCHours())}</text>`
      + (mitternacht ? `<text class="gz-achse gz-datum" x="${xx}" y="${H - PAD.b + 29}" text-anchor="middle">`
        + `${en ? `${d.getUTCDate()}/${d.getUTCMonth() + 1}` : `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`}</text>` : ''));
  }

  const belegt: number[] = [];
  for (const l of [...linien].sort((a, b) => a.rang - b.rang)) {
    const yy = y(s, l.h);
    teile.push(`<line class="gz-bezug" x1="${PAD.l}" x2="${W - PAD.r}" y1="${yy}" y2="${yy}"/>`);
    if (belegt.every((b) => Math.abs(b - yy) >= 12)) {
      belegt.push(yy);
      teile.push(`<text class="gz-bezugtext" x="${W - PAD.r + 4}" y="${yy + 4}">${l.name} ${nf(r1(l.h), 1, sprache)}</text>`);
    }
  }

  const pfad = (pkt: readonly { zeit: Date; hoeheM: number }[]) =>
    pkt.map((p, i) => `${i ? 'L' : 'M'}${x(s, p.zeit.getTime()).toFixed(1)},${y(s, p.hoeheM).toFixed(1)}`).join('');
  if (lage.mitWetter.length > 1) teile.push(`<path class="gz-wetter" d="${pfad(lage.mitWetter)}"/>`);
  teile.push(`<path class="gz-kurve" d="${pfad(lage.kurve)}"/>`);

  const senkrecht = (ms: number, text: string, klasse: string) => {
    if (ms < t0 || ms > t1) return;
    const xx = x(s, ms);
    teile.push(`<line class="${klasse}" x1="${xx}" x2="${xx}" y1="${PAD.t - 4}" y2="${H - PAD.b}"/>`
      + `<text class="gz-markentext" x="${xx}" y="${PAD.t - 8}" text-anchor="middle">${escapeHtml(text)}</text>`);
  };
  if (e.marke) senkrecht(e.marke.zeit.getTime(), e.marke.text, 'gz-marke');
  if (e.jetzt) senkrecht(e.jetzt.getTime(), en ? 'now' : 'jetzt', 'gz-jetzt');

  for (const ex of lage.extreme) {
    const ms = ex.zeit.getTime();
    if (ms < t0 || ms > t1) continue;
    const xx = x(s, ms), yy = y(s, ex.hoeheM);
    const hw = ex.art === 'HW';

    const ty = hw ? yy - 22 : yy + 16;
    const anker = xx < PAD.l + 24 ? 'start' : xx > W - PAD.r - 24 ? 'end' : 'middle';
    teile.push(`<circle class="gz-scheitel" cx="${xx}" cy="${yy}" r="4"/>`
      + `<text class="gz-scheiteltext" x="${xx}" y="${ty}" text-anchor="${anker}">`
      + `${hw ? 'HW' : en ? 'LW' : 'NW'} ${uhrLt(ex.zeit)}`
      + `<tspan x="${xx}" dy="12" class="gz-scheitelhoehe">${nf(r1(ex.hoeheM), 1, sprache)} m</tspan></text>`);
  }

  const einheit = lage.bezug === 'ngzw' ? (en ? 'm above LAT' : 'm über NGzW') : (en ? 'm relative to mean level' : 'm zum Mittelwasser');
  teile.push(`<text class="gz-achse gz-einheit" x="2" y="11">${einheit}</text>`);
  teile.push('<g class="gz-hover" visibility="hidden"><line class="gz-hoverlinie" y1="' + PAD.t + '" y2="' + (H - PAD.b) + '"/>'
    + '<rect class="gz-tipp" rx="4" height="20"/><text class="gz-tipptext"></text></g>');

  const quelle = lage.quelle === 'pegel' && lage.station
    ? (en ? `Astronomical tide, gauge ${lage.station.daten.name}` : `Astronomische Gezeit, Pegel ${lage.station.daten.name}`)
    : (en ? 'Tide, Copernicus model' : 'Gezeit, Copernicus-Modell');
  const legende = lage.mitWetter.length > 1
    ? `<span class="gz-leg"><i class="gz-sw gz-sw-kurve"></i>${escapeHtml(quelle)}</span>`
      + `<span class="gz-leg"><i class="gz-sw gz-sw-wetter"></i>${en ? 'with weather-driven part (Copernicus model)' : 'mit Wetteranteil (Copernicus-Modell)'}</span>`
    : `<span class="gz-leg">${escapeHtml(quelle)}</span>`;
  const daten = {
    s, w: W, pl: PAD.l, pr: PAD.r, sprache,
    k: lage.kurve.map((p) => [p.zeit.getTime(), Math.round(p.hoeheM * 1000) / 1000]),
    m: lage.mitWetter.map((p) => [p.zeit.getTime(), Math.round(p.hoeheM * 1000) / 1000]),
    e: einheit,
  };
  const beschreibung = en
    ? `Tide curve, ${lage.extreme.length} high and low waters; the text above lists them.`
    : `Gezeitenkurve mit ${lage.extreme.length} Hoch- und Niedrigwassern; der Text oben nennt sie einzeln.`;
  return `<figure class="gz-grafik"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(beschreibung)}" `
    + `data-gz="${escapeHtml(JSON.stringify(daten))}">${teile.join('')}</svg>`
    + `<figcaption>${legende}</figcaption></figure>`;
}

export function bindeGezeitenGrafik(wurzel: ParentNode): void {
  wurzel.querySelectorAll<SVGSVGElement>('.gz-grafik svg[data-gz]').forEach((svg) => {
    if (svg.dataset.gzGebunden) return;
    svg.dataset.gzGebunden = '1';
    const d = JSON.parse(svg.dataset.gz!) as {
      s: Skala; w: number; pl: number; pr: number; sprache: Sprache;
      k: [number, number][]; m: [number, number][]; e: string;
    };
    const gruppe = svg.querySelector<SVGGElement>('.gz-hover')!;
    const linie = gruppe.querySelector('line')!;
    const rect = gruppe.querySelector('rect')!;
    const text = gruppe.querySelector('text')!;
    const naechster = (reihe: [number, number][], ms: number) =>
      reihe.reduce<[number, number] | null>((b, p) => (!b || Math.abs(p[0] - ms) < Math.abs(b[0] - ms) ? p : b), null);
    const zeige = (ev: PointerEvent) => {
      const box = svg.getBoundingClientRect();
      const px = ((ev.clientX - box.left) / box.width) * d.w;
      if (px < d.pl || px > d.w - d.pr) { gruppe.setAttribute('visibility', 'hidden'); return; }
      const ms = d.s.t0 + ((px - d.pl) / (d.w - d.pl - d.pr)) * (d.s.t1 - d.s.t0);
      const p = naechster(d.k, ms);
      if (!p) return;
      const xx = d.pl + ((p[0] - d.s.t0) / (d.s.t1 - d.s.t0)) * (d.w - d.pl - d.pr);
      linie.setAttribute('x1', String(xx));
      linie.setAttribute('x2', String(xx));
      const q = d.m.length ? naechster(d.m, p[0]) : null;
      const mitWetter = q && Math.abs(q[0] - p[0]) <= 45 * 60000
        ? (d.sprache === 'en' ? ` (weather incl. ${nf(q[1], 2, 'en')})` : ` (mit Wetter ${nf(q[1], 2)})`) : '';
      text.textContent = `${uhrLt(new Date(p[0]))} · ${nf(p[1], 2, d.sprache)} ${d.e}${mitWetter}`;
      const breite = text.getComputedTextLength?.() ?? 160;
      const tx = Math.min(Math.max(xx - breite / 2, d.pl), d.w - d.pr - breite);
      text.setAttribute('x', String(tx));
      text.setAttribute('y', String(PAD.t + 14));
      rect.setAttribute('x', String(tx - 5));
      rect.setAttribute('y', String(PAD.t));
      rect.setAttribute('width', String(breite + 10));
      gruppe.setAttribute('visibility', 'visible');
    };
    svg.addEventListener('pointermove', zeige);
    svg.addEventListener('pointerdown', zeige);
    svg.addEventListener('pointerleave', () => gruppe.setAttribute('visibility', 'hidden'));
  });
}
