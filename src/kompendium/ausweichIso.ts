import { Iso } from './iso';
import { pfeile, esc } from './svg';
import {
  fahrzeug, wasser, strich, kurve, beschrift, richtung, flaeche, tiefe, isoSvg,
  raster, type Fahrzeug, type V3,
} from './yacht';
import type { T } from './bausteine';

const L = 7;
type Pf = ReturnType<typeof pfeile>;

function szene(label: string, inhalt: (iso: Iso, p: Pf) => string): string {
  const p = pfeile();
  const iso = new Iso(7.5, 150, 158);
  return isoSvg(300, 242, label, wasser(iso, -11, 11, -11, 11, 'var(--panel)') + raster(iso, -11, 11, 4) + inhalt(iso, p), p.defs, 'kp-rr kp-iso');
}

function flotte(iso: Iso, ...f: Fahrzeug[]): string {
  return [...f].sort((a, b) => tiefe(a) - tiefe(b)).map((x) => fahrzeug(iso, { L, ...x })).join('');
}

function kurs(iso: Iso, p: Pf, f: Fahrzeug, laenge = 5): string {
  const [ux, uy] = richtung(f.kurs);
  const a: V3 = [f.x + ux * (L * 0.6), f.y + uy * (L * 0.6), 0];
  const b: V3 = [a[0] + ux * laenge, a[1] + uy * laenge, 0];
  return strich(iso, a, b, 'var(--muted)', 1.3, ` stroke-dasharray="3 3" marker-end="url(#${p.grau})"`);
}

const weg = (iso: Iso, p: Pf, a: V3, c: V3, b: V3) => kurve(iso, a, c, b, 'var(--gelb)', 2, ` marker-end="url(#${p.akzent})"`);

function wind(iso: Iso, p: Pf, aus: number): string {
  const [ux, uy] = richtung(aus);
  const mitte: V3 = [-9.5, 0, 0];
  const a: V3 = [mitte[0] + ux * 3, mitte[1] + uy * 3, 0];
  const b: V3 = [mitte[0] - ux * 3, mitte[1] - uy * 3, 0];
  return strich(iso, a, b, 'var(--text)', 2, ` marker-end="url(#${p.text})"`) + beschrift(iso, a, 'Wind', 'kp-rr-w', 'middle', -6);
}

const unter = (iso: Iso, f: { x: number; y: number }, text: string) => beschrift(iso, [f.x, f.y, 0], text, 'kp-rr-l kp-l-h', 'middle', 24);
const kopf = (zeilen: string[]) => zeilen.map((z, i) => `<text x="8" y="${16 + i * 13}" class="kp-rr-s">${esc(z)}</text>`).join('');

export function lagebilderIso(t: T): { d1: string; d2: string; d3: string; d4: string; d5: string } {

  const a1: Fahrzeug = { x: -5, y: -6, kurs: 45, art: 'segel', windAus: 0, hervor: true };
  const b1: Fahrzeug = { x: 2.5, y: -3.5, kurs: 315, art: 'segel', windAus: 0 };
  const d1 = szene(t('Zwei Segler, Wind von verschiedenen Seiten', 'Two sailing vessels, wind on different sides'), (iso, p) =>
    wind(iso, p, 0) + kurs(iso, p, b1) + flotte(iso, a1, b1) + weg(iso, p, [-2.8, -3.8, 0], [1.5, -5.8, 0], [7, -4.5, 0])
    + unter(iso, a1, t('Bb-Bug: weicht', 'Port tack: gives way')) + unter(iso, b1, t('Stb-Bug', 'Starboard tack')));

  const a2: Fahrzeug = { x: -3, y: 4, kurs: 90, art: 'segel', windAus: 0, hervor: true };
  const b2: Fahrzeug = { x: -3, y: -4, kurs: 90, art: 'segel', windAus: 0 };
  const d2 = szene(t('Zwei Segler, Wind von derselben Seite', 'Two sailing vessels, wind on the same side'), (iso, p) =>
    wind(iso, p, 0) + kurs(iso, p, b2) + flotte(iso, a2, b2) + weg(iso, p, [1, 4, 0], [4.5, 4.4, 0], [6.5, 8.5, 0])
    + unter(iso, a2, t('Luv: weicht', 'Windward: gives way')) + unter(iso, b2, t('Lee', 'Leeward')));

  const a3: Fahrzeug = { x: -1.5, y: -7.5, kurs: 20, art: 'motor', hervor: true };
  const b3: Fahrzeug = { x: 1.5, y: 2.5, kurs: 20, art: 'motor' };
  const d3 = szene(t('Überholen', 'Overtaking'), (iso, p) => {
    const r = 9;
    const bogen: V3[] = [[b3.x, b3.y, 0]];
    for (let w = 112.5; w <= 247.5 + 0.01; w += 7.5) {
      const [ux, uy] = richtung(b3.kurs + w);
      bogen.push([b3.x + ux * r, b3.y + uy * r, 0]);
    }
    const ende = (w: number, rr: number): V3 => { const [ux, uy] = richtung(b3.kurs + w); return [b3.x + ux * rr, b3.y + uy * rr, 0]; };
    return flaeche(iso, bogen, 'var(--gelb)', ' fill-opacity=".1" stroke="var(--gelb)" stroke-opacity=".5" stroke-dasharray="3 3"')
      + beschrift(iso, ende(112.5, r + 1.8), t('112,5°', '112.5°'), 'kp-rr-s') + beschrift(iso, ende(247.5, r + 2), t('247,5°', '247.5°'), 'kp-rr-s')
      + kurs(iso, p, b3) + flotte(iso, a3, b3) + weg(iso, p, [-0.3, -3.6, 0], [-5.5, 0, 0], [-1.8, 8, 0])
      + unter(iso, b3, t('Kurshalter', 'Stand-on')) + unter(iso, a3, t('Überholer: weicht', 'Overtaking: gives way'))
      + kopf([t('Sektor: mehr als 22,5°', 'Sector: more than 22.5°'), t('achterlicher als querab', 'abaft the beam')]);
  });

  const a4: Fahrzeug = { x: 0, y: 7.5, kurs: 180, art: 'motor', hervor: true };
  const b4: Fahrzeug = { x: 0, y: -7.5, kurs: 0, art: 'motor', hervor: true };
  const d4 = szene(t('Entgegengesetzte Kurse', 'Head-on situation'), (iso, p) =>
    flotte(iso, a4, b4) + weg(iso, p, [0, 3.4, 0], [0, 0.5, 0], [-3.5, -1.8, 0]) + weg(iso, p, [0, -3.4, 0], [0, -0.5, 0], [3.5, 1.8, 0])
    + kopf([t('beide ändern nach Steuerbord', 'both alter course to starboard')]));

  const a5: Fahrzeug = { x: -2.5, y: -7.5, kurs: 0, art: 'motor', hervor: true };
  const b5: Fahrzeug = { x: 6.5, y: 1, kurs: 270, art: 'motor' };
  const d5 = szene(t('Kreuzende Kurse', 'Crossing situation'), (iso, p) =>
    kurs(iso, p, a5) + kurs(iso, p, b5) + flotte(iso, a5, b5) + weg(iso, p, [-2.5, -3.6, 0], [3.5, -4.5, 0], [10, 2.5, 0])
    + unter(iso, a5, t('weicht', 'gives way')) + unter(iso, b5, t('Kurshalter', 'Stand-on'))
    + kopf([t('hat den anderen an Steuerbord:', 'has the other on her starboard side:'),
      t('weicht, möglichst nicht vor dessen Bug', 'gives way, avoids crossing ahead')]));

  return { d1, d2, d3, d4, d5 };
}

