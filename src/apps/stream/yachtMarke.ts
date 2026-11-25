import { Iso } from '@/kompendium/iso';
import { fahrzeug, imSchiff, masse, rigg, strich, type Fahrzeug } from '@/kompendium/yacht';
import { seeflagge, FLAGGE_B, FLAGGE_H } from '@/core/seeflaggen';

const C30 = Math.cos(Math.PI / 6);

export function isoKurs(peilung: number): number {
  const b = (peilung * Math.PI) / 180;
  const ux = (Math.sin(b) / C30 - 2 * Math.cos(b)) / 2;
  const uy = (Math.sin(b) / C30 + 2 * Math.cos(b)) / 2;
  return ((Math.atan2(ux, uy) * 180) / Math.PI + 360) % 360;
}

export const MARKE_PX = 84;
export const MARKE_ANKER: [number, number] = [42, 60];

const zwischen = new Map<string, string>();
const stufeVon = (kurs: number | null) => ((Math.round((kurs ?? 0) / 10) * 10) % 360 + 360) % 360;
const ISO = () => new Iso(4.2, 32, 46);

const L_MARKE = 8;

const LICHT_R = 2.2;

function lichterfuehrung(iso: Iso, f: Fahrzeug, motor: boolean): string {
  const m = masse(L_MARKE);
  const licht = (lx: number, ly: number, z: number, farbe: 'R' | 'G' | 'W') => {
    const [x, y, zz] = imSchiff(f, lx, ly, z);
    return iso.licht(x, y, zz, farbe, LICHT_R);
  };

  const out = [
    licht(-L_MARKE * 0.48, 0, m.fb, 'W'),
    licht(L_MARKE * 0.3, m.B * 0.42, m.fb, 'R'),
    licht(L_MARKE * 0.3, -m.B * 0.42, m.fb, 'G'),
  ];
  if (motor) out.push(licht(m.mast + 0.05, 0, m.fb + m.H * 0.55, 'W'));
  return out.join('');
}

const FLAGGE_AM_STAG = 0.42;
const FLAGGE_HOCH = 1.0;
const FLAGGE_LANG = FLAGGE_HOCH * (FLAGGE_B / FLAGGE_H);

const STAG = '#0B1E2D';

const FLAGGE_AUSWEHEN = 40;
type V3 = readonly [number, number, number];

function flaggeAmStag(iso: Iso, f: Fahrzeug, code: string): string {
  const fl = seeflagge(code);
  if (!fl) return '';
  const m = masse(L_MARKE);
  const heck = imSchiff(f, -L_MARKE * 0.46, 0, m.fb);
  const top = rigg(f, 0).mastTop;

  const a: [number, number, number] = [0, 1, 2].map((i) => heck[i]! + (top[i]! - heck[i]!) * FLAGGE_AM_STAG) as [number, number, number];
  const stagLaenge = Math.hypot(top[0] - heck[0], top[1] - heck[1], top[2] - heck[2]);
  const runter = [0, 1, 2].map((i) => ((heck[i]! - top[i]!) / stagLaenge) * FLAGGE_HOCH) as [number, number, number];

  const w = (FLAGGE_AUSWEHEN * Math.PI) / 180;
  const flaeche = (v: V3) => {
    const [x0, y0] = iso.p(0, 0, 0);
    const [x1, y1] = iso.p(v[0], v[1], v[2]);
    const [x2, y2] = iso.p(runter[0], runter[1], runter[2]);
    return Math.abs((x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0));
  };
  const [achtern] = [1, -1]
    .map((seite) => imSchiff({ ...f, x: 0, y: 0 }, -FLAGGE_LANG * Math.cos(w), seite * FLAGGE_LANG * Math.sin(w), 0))
    .sort((p, q) => flaeche(q) - flaeche(p)) as [V3];
  const punkt = (u: number, v: number): [number, number] => {
    const su = u / FLAGGE_B;
    const sv = v / FLAGGE_H;
    return iso.p(a[0] + achtern[0] * su + runter[0] * sv, a[1] + achtern[1] * su + runter[1] * sv, a[2] + achtern[2] * su + runter[2] * sv);
  };
  const vieleck = (pts: [number, number][], farbe: string, rand = '') =>
    `<polygon points="${pts.map(([u, v]) => punkt(u, v).map((z) => z.toFixed(2)).join(',')).join(' ')}" fill="${farbe}"${rand}/>`;
  const teile = fl.formen.map((form) => {
    if ('r' in form) {
      const [x, y, b, h] = form.r;
      return vieleck([[x, y], [x + b, y], [x + b, y + h], [x, y + h]], form.f);
    }
    if ('c' in form) {
      const [cx, cy, r] = form.c;
      return vieleck(Array.from({ length: 14 }, (_, i) => {
        const w = (i / 14) * 2 * Math.PI;
        return [cx + r * Math.cos(w), cy + r * Math.sin(w)] as [number, number];
      }), form.f);
    }
    return vieleck(form.p, form.f);
  });
  const rand = vieleck([[0, 0], [FLAGGE_B, 0], [FLAGGE_B, FLAGGE_H], [0, FLAGGE_H]], 'none', ` stroke="${STAG}" stroke-width=".25" stroke-linejoin="round"`);
  return `<g class="marke-flagge">${teile.join('')}${rand}</g>`;
}

export function yachtMarke(kurs: number | null, mitSegel = true, lichter: 'segel' | 'motor' | null = null, flagge: string | null = null): string {
  const stufe = stufeVon(kurs);
  const code = seeflagge(flagge) ? flagge!.trim().toUpperCase() : null;
  const schluessel = `${stufe}|${mitSegel ? 's' : 'r'}|${lichter ?? ''}|${code ?? ''}`;
  const bekannt = zwischen.get(schluessel);
  if (bekannt) return bekannt;
  const k = isoKurs(stufe);
  const iso = ISO();
  const f: Fahrzeug = { x: 0, y: 0, kurs: k, art: 'segel', windAus: k + 50, L: L_MARKE, marke: true, ohneSegel: !mitSegel };
  const svg = `<svg viewBox="0 0 64 64" width="${MARKE_PX}" height="${MARKE_PX}" aria-hidden="true">`
    + fahrzeug(iso, f)

    + (code && mitSegel ? strich(iso, imSchiff(f, -L_MARKE * 0.46, 0, masse(L_MARKE).fb), rigg(f, 0).mastTop, STAG, 0.7) : '')
    + (code ? flaggeAmStag(iso, f, code) : '')
    + (lichter ? lichterfuehrung(iso, f, lichter === 'motor') : '') + '</svg>';
  zwischen.set(schluessel, svg);
  return svg;
}

export function markePunkt(kurs: number | null, teil: 'heck' | 'bug' | 'bb' | 'stb'): [number, number] {
  const f = { x: 0, y: 0, kurs: isoKurs(stufeVon(kurs)), art: 'segel' as const, L: L_MARKE };
  const B = masse(L_MARKE).B;

  const [lx, ly] = teil === 'heck' ? [-L_MARKE / 2, 0] : teil === 'bug' ? [L_MARKE / 2, 0] : [0, (teil === 'bb' ? 1 : -1) * B / 2];
  const w = imSchiff(f, lx, ly, 0);
  const [x, y] = ISO().p(w[0], w[1], 0);
  const m = MARKE_PX / 64;
  return [x * m, y * m];
}
