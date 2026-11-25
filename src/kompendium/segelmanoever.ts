import { Iso } from './iso';
import { tFuer, quelle, type T } from './bausteine';
import { esc, k, neueId } from './svg';
import {
  fahrzeug, wasser, raster, strich, kurve, beschrift, richtung, tiefe, isoSvg, imSchiff, anker, masse,
  windZumBug, baumWinkel, type Fahrzeug, type V3,
} from './yacht';
import type { Sprache } from '@/core/types';

const L = 5;
const TEXT = 'var(--text)';
const GRAU = 'var(--muted)';
const AMBER = 'var(--akzent)';

function marker(...farben: string[]): { defs: string; id: (f: string) => string } {
  const ids = new Map<string, string>();
  const defs = farben.map((f) => {
    const id = neueId('mk');
    ids.set(f, id);
    return `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`
      + `<path d="M0 0L10 5L0 10Z" fill="${f}"/></marker>`;
  }).join('');
  return { defs: `<defs>${defs}</defs>`, id: (f) => ids.get(f)! };
}

const tx = (x: number, y: number, s: string, klasse = 'kp-rr-l', anker2 = 'middle') =>
  `<text x="${k(x)}" y="${k(y)}" text-anchor="${anker2}" class="${klasse}">${esc(s)}</text>`;

function bootOben(cx: number, cy: number, kurs: number, hervor = false): string {
  const ww = windZumBug(0, kurs);
  const seite = ww >= 0 ? 1 : -1;
  const b = (baumWinkel(ww) * Math.PI) / 180;
  const vorDemWind = Math.abs(ww) > 170;
  const farbe = hervor ? 'var(--gelb)' : TEXT;

  const baum = `<line x1="0" y1="-3" x2="${k(-seite * Math.sin(b) * 15)}" y2="${k(-3 + Math.cos(b) * 15)}" stroke="${farbe}" stroke-width="2.4" stroke-linecap="round"/>`;
  const bv = vorDemWind ? (80 * Math.PI) / 180 : Math.min(b * 0.9 + 0.03, 1.3);
  const vs = vorDemWind ? -seite : seite;
  const vor = `<line x1="0" y1="-17" x2="${k(-vs * Math.sin(bv) * 12)}" y2="${k(-17 + Math.cos(bv) * 12)}" stroke="${farbe}" stroke-width="1.6" stroke-linecap="round"/>`;
  return `<g transform="translate(${k(cx)},${k(cy)}) rotate(${kurs})">`
    + '<path d="M0 -20 C7 -12 8 -2 8 6 L7 15 L-7 15 L-8 6 C-8 -2 -7 -12 0 -20 Z" fill="var(--panel)" stroke="var(--muted)" stroke-width="1.2"/>'
    + `${baum}${vor}<circle cx="0" cy="-3" r="1.8" fill="${farbe}"/></g>`;
}

export function zeichnungKursrose(t: T): string {
  const m = marker(TEXT);
  const [cx, cy, r] = [310, 250, 165];
  const pkt = (w: number, rr: number): [number, number] => [cx + rr * Math.sin((w * Math.PI) / 180), cy - rr * Math.cos((w * Math.PI) / 180)];
  const kurse: [number, string, string][] = [
    [45, t('hart am Wind', 'close-hauled'), '45°'],
    [62, t('am Wind', 'close reach'), '60°'],
    [90, t('halber Wind', 'beam reach'), '90°'],
    [135, t('raumer Wind', 'broad reach'), '135°'],
    [180, t('vor dem Wind', 'running'), '180°'],
  ];
  const [a0x, a0y] = pkt(-40, r + 20);
  const [a1x, a1y] = pkt(40, r + 20);
  const sektor = `<path d="M${cx} ${cy} L${k(a0x)} ${k(a0y)} A${r + 20} ${r + 20} 0 0 1 ${k(a1x)} ${k(a1y)} Z" fill="var(--gelb)" fill-opacity=".1" stroke="var(--gelb)" stroke-opacity=".45" stroke-dasharray="3 3"/>`;
  const kreis = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="1"/>`
    + [0, 45, 90, 135, 180, 225, 270, 315].map((w) => { const [x, y] = pkt(w, r); return `<line x1="${cx}" y1="${cy}" x2="${k(x)}" y2="${k(y)}" stroke="var(--line)" stroke-width=".8"/>`; }).join('');
  const boote = kurse.flatMap(([w, name, grad]) => {
    const [x, y] = pkt(w, r);
    const [lx, ly] = w === 180 ? [cx + 28, cy + r - 8] : pkt(w, r + 44);
    const rechts = bootOben(x, y, w);
    const links = w < 180 ? bootOben(...pkt(-w, r), 360 - w) : '';
    return [rechts, links, tx(lx + 6, ly, name, 'kp-rr-l kp-l-h', 'start'), tx(lx + 6, ly + 14, grad, 'kp-rr-s', 'start')];
  }).join('');
  return `<svg class="kp-zeichnung" viewBox="0 0 620 470" role="img" aria-label="${esc(t('Kurse zum Wind über 360°: hart am Wind, am Wind, halber Wind, raumer Wind, vor dem Wind, auf beiden Bügen',
    'Points of sail over 360°: close-hauled, close reach, beam reach, broad reach, running, on both tacks'))}">${m.defs}`
    + '<rect width="620" height="470" fill="var(--panel-2)"/>' + sektor + kreis
    + `<line x1="${cx}" y1="14" x2="${cx}" y2="52" stroke="${TEXT}" stroke-width="2.4" marker-end="url(#${m.id(TEXT)})"/>`
    + tx(cx + 10, 30, 'Wind', 'kp-rr-w', 'start')
    + tx(cx, cy - 70, t('im Wind: nicht segelbar', 'head to wind: no-go zone'), 'kp-rr-s kp-l-h')
    + boote
    + tx(16, 26, t('Steuerbordbug', 'Starboard tack'), 'kp-rr-l', 'start') + tx(16, 42, t('Wind von Steuerbord, Baum an Backbord', 'wind from starboard, boom to port'), 'kp-rr-s', 'start')
    + tx(604, 26, t('Backbordbug', 'Port tack'), 'kp-rr-l', 'end') + tx(604, 42, t('Wind von Backbord, Baum an Steuerbord', 'wind from port, boom to starboard'), 'kp-rr-s', 'end')
    + tx(16, 458, t('Winkel zum wahren Wind, Richtwerte für Fahrtenyachten', 'Angles to the true wind, typical values for cruising yachts'), 'kp-rr-s', 'start')
    + '</svg>';
}

function szene(label: string, inhalt: (iso: Iso, m: ReturnType<typeof marker>) => string): string {
  const m = marker(TEXT, AMBER, GRAU);
  const iso = new Iso(11, 172, 178);
  return isoSvg(344, 290, label, wasser(iso, -7.5, 7.5, -7.5, 7.5, 'var(--panel)') + raster(iso, -7.5, 7.5, 2.5) + inhalt(iso, m), m.defs, 'kp-iso');
}

function windPfeil(iso: Iso, m: ReturnType<typeof marker>, aus: number, mitte: V3 = [-5.5, -4.5, 0]): string {
  const [ux, uy] = richtung(aus);
  const a: V3 = [mitte[0] + ux * 2, mitte[1] + uy * 2, 0];
  const b: V3 = [mitte[0] - ux * 2, mitte[1] - uy * 2, 0];
  return strich(iso, a, b, TEXT, 2.2, ` marker-end="url(#${m.id(TEXT)})"`) + beschrift(iso, a, 'Wind', 'kp-rr-w kp-l-h', 'middle', -7);
}

const flotte = (iso: Iso, ...f: Fahrzeug[]) => [...f].sort((a, b) => tiefe(a) - tiefe(b)).map((x) => fahrzeug(iso, { L, ...x })).join('');
const marke = (iso: Iso, p: V3, text: string, dy = 22, anker2 = 'middle') => beschrift(iso, p, text, 'kp-rr-s kp-l-h', anker2, dy);
const weg = (iso: Iso, m: ReturnType<typeof marker>, a: V3, c: V3, b: V3) => kurve(iso, a, c, b, AMBER, 1.8, ` stroke-dasharray="5 3" marker-end="url(#${m.id(AMBER)})"`);

export function zeichnungWende(t: T): string {
  const a: Fahrzeug = { x: 4.6, y: -5.6, kurs: 315, art: 'segel', windAus: 0 };
  const b: Fahrzeug = { x: 0, y: -1.4, kurs: 0, art: 'segel', windAus: 0, baum: 2, baumSeite: 1 };
  const c: Fahrzeug = { x: 4.2, y: 2.8, kurs: 45, art: 'segel', windAus: 0 };
  return szene(t('Wende: vom Steuerbordbug durch den Wind auf den Backbordbug', 'Tacking: from starboard tack through the wind onto port tack'), (iso, m) =>
    windPfeil(iso, m, 0) + kurve(iso, [3.4, -4.4, 0], [1.4, -2.4, 0], [0, 0.6, 0], AMBER, 1.8, ' stroke-dasharray="5 3"') + weg(iso, m, [0, 0.6, 0], [0.6, 3.4, 0], [6.6, 4.4, 0]) + flotte(iso, a, b, c)
    + marke(iso, [a.x, a.y, 0], t('„Klar zur Wende?“ „Ist klar!“', '“Ready about?” “Ready!”'), 24)
    + marke(iso, [b.x - 1.5, b.y - 1.5, 0], t('„Ree!“', '“Lee-oh!”'), 6, 'end')
    + marke(iso, [c.x, c.y, 0], t('„Über die Fock!“', 'new sheet in'), 24, 'start'));
}

export function zeichnungHalse(t: T): string {
  const a: Fahrzeug = { x: 3.4, y: 5.4, kurs: 225, art: 'segel', windAus: 0 };
  const b: Fahrzeug = { x: -0.6, y: 0.6, kurs: 180, art: 'segel', windAus: 0, baum: 6, baumSeite: 1 };
  const c: Fahrzeug = { x: 3, y: -4.6, kurs: 135, art: 'segel', windAus: 0 };
  return szene(t('Halse: vom Steuerbordbug mit dem Heck durch den Wind auf den Backbordbug', 'Gybing: from starboard tack, stern through the wind, onto port tack'), (iso, m) =>
    windPfeil(iso, m, 0) + weg(iso, m, [4.6, 6.8, 0], [-2.4, 0.6, 0], [4.8, -6.4, 0]) + flotte(iso, a, b, c)
    + marke(iso, [a.x, a.y, 0], t('„Hol dicht die Großschot!“', '“Sheet in the main!”'), 24)
    + marke(iso, [b.x + 1.2, b.y - 1.2, 0], t('„Rund achtern!“', '“Gybe-oh!”'), 18, 'start')
    + marke(iso, [c.x, c.y, 0], t('„Fier auf die Großschot!“', '“Ease the main!”'), 24, 'start'));
}

export function zeichnungBeidrehen(t: T): string {
  const f: Fahrzeug = { x: 0, y: 1, kurs: 50, art: 'segel', windAus: 0, baum: 38, vorBack: true, L: 6.5 };
  return szene(t('Beigedreht: Vorsegel back, Groß gefiert, Ruder nach Luv, das Schiff treibt langsam nach Lee',
    'Hove to: headsail backed, main eased, tiller to leeward, the boat drifts slowly to leeward'), (iso, m) => {
    const mm = masse(6.5);
    const heck = imSchiff(f, -3.25, 0, 0.3);
    const ruder = imSchiff(f, -3.25 - 0.9 * Math.cos(0.6), 0.9 * Math.sin(0.6), 0.3);
    return windPfeil(iso, m, 0, [-6.2, 2, 0])
      + strich(iso, [1.5, -1.5, 0], [3.5, -5.5, 0], AMBER, 2, ` stroke-dasharray="5 3" marker-end="url(#${m.id(AMBER)})"`)
      + marke(iso, [3.5, -5.5, 0], t('Abdrift nach Lee', 'drift to leeward'), 18)
      + fahrzeug(iso, f) + strich(iso, heck, ruder, AMBER, 3)
      + marke(iso, imSchiff(f, 3.4, 0.6, mm.fb + 3.5), t('Fock back', 'jib backed'), -4, 'start')
      + marke(iso, imSchiff(f, -2.4, -2.8, mm.fb), t('Groß gefiert', 'main eased'), 18, 'middle')
      + marke(iso, ruder, t('Ruder nach Luv', 'rudder to windward'), 4, 'end');
  });
}

export function zeichnungAnkernSegel(t: T): string {
  const f: Fahrzeug = { x: 0, y: -1.6, kurs: 0, art: 'segel', windAus: 0, baum: 3, baumSeite: 1, ohneVorsegel: true };
  return szene(t('Ankern unter Segel: aus Lee anlaufen, Aufschießer in den Wind, Anker fällt kurz vor dem Stillstand',
    'Anchoring under sail: approach from leeward, shoot up into the wind, let go just before the boat stops'), (iso, m) => {
    const bug = imSchiff(f, L / 2, 0, masse(L).fb);
    return windPfeil(iso, m, 0)
      + kurve(iso, [6.5, -7, 0], [0.5, -7, 0], [0, -4.2, 0], AMBER, 1.8, ' stroke-dasharray="5 3"')
      + marke(iso, [6, -7, 0], t('Anlauf', 'approach'), 18)
      + marke(iso, [0.6, -5.4, 0], t('Aufschießer', 'shoot up'), 10, 'start')
      + fahrzeug(iso, { L, ...f }) + anker(iso, bug, [0, 4.2, 0])
      + marke(iso, [0, 4.2, 0], t('Anker fällt', 'let go'), -14, 'start');
  });
}

export function zeichnungAnkerauf(t: T): string {
  const f: Fahrzeug = { x: 0, y: -1, kurs: 0, art: 'segel', windAus: 0, baum: 3, baumSeite: 1, ohneVorsegel: true };
  return szene(t('Ankerauf unter Segel: Groß gesetzt, Kette kurzstag, nach dem Ausbrechen mit dem Ruder den Bug wählen und abfallen',
    'Weighing anchor under sail: main up, chain up and down, once the anchor breaks out choose the tack with the rudder and bear away'), (iso, m) => {
    const bug = imSchiff(f, L / 2, 0, masse(L).fb);
    return windPfeil(iso, m, 0)
      + fahrzeug(iso, { L, ...f }) + anker(iso, bug, [0, 1.9, 0])
      + kurve(iso, [0.2, 3.4, 0.5], [-2.4, 4.8, 0], [-6.8, 5.6, 0], AMBER, 1.8, ` stroke-dasharray="5 3" marker-end="url(#${m.id(AMBER)})"`)
      + marke(iso, [0, 1.9, 0], t('kurzstag', 'up and down'), -14, 'start')
      + marke(iso, [-6.8, 5.6, 0], t('ab auf Steuerbordbug', 'away on starboard tack'), 18)
      + marke(iso, [0.8, -3.6, 0], t('Ruder hart Steuerbord', 'rudder hard to starboard'), 22, 'start');
  });
}

const fig = (svg: string, unterschrift: string) => `<figure class="kp-fig">${svg}<figcaption class="kp-small">${unterschrift}</figcaption></figure>`;
const schritte = (s: string[]) => `<ol class="kp-steps">${s.map((x) => `<li>${x}</li>`).join('')}</ol>`;
function kommandos(t: T, zeilen: [string, string, string][]): string {
  return `<div class="kp-tw"><table class="kp-data"><thead><tr><th scope="col">${t('Wer', 'Who')}</th><th scope="col">${t('Kommando', 'Call')}</th>`
    + `<th scope="col">${t('Bedeutung', 'Meaning')}</th></tr></thead><tbody>${zeilen.map(([a, b, c]) =>
      `<tr><td>${esc(a)}</td><th scope="row">${esc(b)}</th><td>${esc(c)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function segelmanoever(sprache: Sprache): string {
  const t = tFuer(sprache);
  const en = sprache === 'en';
  const S = t('Steuer', 'Helm');
  const C = t('Crew', 'Crew');
  const wende = en ? [
    'Come onto a close-hauled course with the sails sheeted in. Check that the water to windward and on the new tack is clear. Helm: “Ready about?”',
    'The headsail trimmer takes the working sheet off the cleat or self-tailer, leaving a few turns on the winch, and has the new sheet to hand. Crew: “Ready!”',
    'Helm: “Lee-oh!” and puts the helm down (tiller to leeward, wheel to windward), steadily and not too hard: a hard-over rudder brakes the boat.',
    'As the headsail starts to luff and the bow passes through the wind, release the old sheet. In light air the headsail can be left backed for a moment to help the bow round.',
    'Haul in the new sheet quickly before the sail fills, finish with the winch handle. The main comes across by itself; adjust the traveller.',
    'Steady the helm on the new close-hauled course. A cruising yacht turns through about 90°.',
  ] : [
    'Auf Am-Wind-Kurs gehen, Segel dicht. Prüfen, dass das Wasser in Luv und auf dem neuen Bug frei ist. Steuer: „Klar zur Wende?“',
    'Der Vorschoter nimmt die Leeschot von der Klampe oder dem Selbstholer, lässt ein paar Törns auf der Winsch und hat die neue Schot zur Hand. Crew: „Ist klar!“',
    'Steuer: „Ree!“ und legt Ruder (Pinne nach Lee, Rad nach Luv), zügig und nicht zu hart: Hart gelegtes Ruder bremst.',
    'Beginnt die Fock zu killen und geht der Bug durch den Wind, die alte Schot loswerfen. Bei wenig Wind die Fock einen Moment back stehen lassen; sie drückt den Bug herum.',
    'Die neue Schot zügig dichtholen, bevor das Segel Druck bekommt, zuletzt mit der Winschkurbel. Das Groß schlägt von selbst über; den Traveller nachstellen.',
    'Auf dem neuen Am-Wind-Kurs stützen. Eine Fahrtenyacht dreht dabei um rund 90°.',
  ];
  const halse = en ? [
    'From a broad reach: release the preventer, centre and lock the traveller. Helm: “Stand by to gybe?” Crew: “Ready!”',
    'Bear away onto a run. Helm: “Sheet in the main!” The mainsheet is hauled in quickly until the boom is near the centreline. The headsail collapses in the lee of the main.',
    'Helm: “Gybe-oh!” and turns the stern through the wind. The boom comes across under control. Keep heads out of its path.',
    'As the boom crosses, steady with opposite helm so that the boat does not round up on the new gybe.',
    'Helm: “Ease the main!” Ease the mainsheet promptly, bring the headsail across and sheet it in on the new side.',
    'Settle on the new course and rig the preventer again.',
  ] : [
    'Vom Raumschotskurs: Bullenstander lösen, Traveller mittig festsetzen. Steuer: „Klar zur Halse?“ Crew: „Ist klar!“',
    'Abfallen bis vor den Wind. Steuer: „Hol dicht die Großschot!“ Die Großschot wird zügig dichtgeholt, bis der Baum nahe mittschiffs steht. Die Fock fällt in die Abdeckung des Groß.',
    'Steuer: „Rund achtern!“ und dreht das Heck durch den Wind. Der Baum kommt kontrolliert über. Köpfe aus dem Schwenkbereich des Baums.',
    'Geht der Baum über, mit Gegenruder stützen, damit die Yacht auf dem neuen Bug nicht in den Wind schießt.',
    'Steuer: „Fier auf die Großschot!“ Die Großschot zügig fieren, „Über die Fock!“, die Fock auf der neuen Seite dichtholen.',
    'Neuen Kurs ansagen und den Bullenstander neu setzen.',
  ];
  const beidrehen = en ? [
    'From a close-hauled course, tack without releasing the headsail sheet. As the bow passes through the wind, the headsail is backed.',
    'Ease the mainsheet well out.',
    'Once the boat has lost way, put the tiller to leeward (wheel to windward) and lash it there. With no speed she cannot tack again.',
    'The backed headsail pushes the bow off, the rudder brings it back: the boat lies quietly and drifts slowly sideways to leeward. Her drift leaves a smoother patch of water to windward.',
    'To sail on: free the helm, bring the headsail across to leeward and sheet in the main.',
  ] : [
    'Vom Am-Wind-Kurs wenden, ohne die Fockschot zu lösen. Geht der Bug durch den Wind, steht die Fock back.',
    'Die Großschot weit fieren.',
    'Ist die Fahrt aus dem Schiff, das Ruder nach Luv legen und festsetzen (Pinne nach Lee, Rad nach Luv). Ohne Fahrt kann die Yacht nicht erneut wenden.',
    'Die back stehende Fock drückt den Bug ab, das Ruder dreht ihn wieder an: Die Yacht liegt ruhig bei und treibt langsam seitlich nach Lee. Ihre Abdrift glättet das Wasser in Luv.',
    'Weitersegeln: Ruder lösen, die Fock auf die Leeseite holen, das Groß dicht.',
  ];
  return `
<h2>${t('Segelmanöver', 'Sailing manoeuvres')}</h2>
<p class="kp-lede">${t(
    'Kurse zum Wind, Wende, Halse und Beidrehen mit Ablauf, Schotführung und Kommandos. Die Kommandos sind in der Ausbildung verbreitet, jede Crew legt ihre vor dem Ablegen fest. Wichtig ist, dass jeder an Bord sie versteht und erst auf die Antwort hin manövriert wird.',
    'Points of sail, tacking, gybing and heaving to, with the procedure, sheet handling and calls. The calls are common in sailing schools; each crew agrees on its own before leaving. What counts is that everyone on board understands them and that the helm waits for the answer.')}</p>

<h3>${t('Kurse zum Wind', 'Points of sail')}</h3>
<figure class="kp-fig kp-fig-breit">${zeichnungKursrose(t)}<figcaption class="kp-small">${t(
    'Rechts die Kurse auf Backbordbug, links dieselben auf Steuerbordbug. Gelb der Bereich, in dem kein Vortrieb entsteht.',
    'Right: the points of sail on port tack, left: the same on starboard tack. Shaded: the zone where the sails give no drive.')}</figcaption></figure>
<p>${t(
    'Die Kurse werden nach dem Winkel zwischen Kurs und Wind benannt. Hart (oder hoch) am Wind liegt eine moderne Slup bei 30° bis 45° zum scheinbaren Wind, rund 45° zum wahren. Am Wind bleibt der Einfall vorlicher als querab, beim halben Wind kommt er etwa querab, raumer Wind fällt achterlicher als querab ein, vor dem Wind genau von achtern. Den Bug benennt die Seite, von der der Wind kommt: Auf Steuerbordbug steht der Baum an Backbord. Dazwischen liegt der Sektor im Wind, in dem die Segel killen; ihn überwindet man durch Kreuzen.',
    'The points of sail are named by the angle between course and wind. Close-hauled, a modern sloop sails 30° to 45° to the apparent wind, about 45° to the true wind. On a close reach the wind is still forward of the beam, on a beam reach it comes abeam, on a broad reach from abaft the beam, and on a run from dead astern. The tack is named after the side the wind comes from: on starboard tack the boom is out to port. Between them lies the no-go zone where the sails luff; it is crossed by beating.')}</p>

<h3>${t('Wende', 'Tacking')}</h3>
<div class="kp-split">${fig(zeichnungWende(t), t('Gestrichelt der Weg der Yacht, mit den Kommandos an der Stelle, wo sie fallen.', 'Dashed: the boat’s track, with the calls where they are made.'))}
<div class="kp-prosa"><p>${t('Bei der Wende geht der Bug durch den Wind. Sie ist das Manöver zum Kreuzen und das ruhigere der beiden Bugwechsel: Der Baum schwenkt über, wenn kaum Druck im Segel ist.',
    'In a tack the bow passes through the wind. It is the manoeuvre for beating to windward and the gentler of the two ways of changing tack: the boom swings across when there is little pressure in the sail.')}</p>
${schritte(wende)}</div></div>
${kommandos(t, en ? [
    [S, 'Ready about?', 'prepare to tack, crew answers'],
    [C, 'Ready!', 'sheets prepared, everyone in place'],
    [S, 'Lee-oh!', 'helm is put down, the tack begins'],
  ] : [
    [S, 'Klar zur Wende?', 'Wende vorbereiten, Crew antwortet'],
    [C, 'Ist klar!', 'Schoten klar, alle auf ihrem Platz'],
    [S, 'Ree!', 'Ruder wird gelegt, die Wende beginnt'],
    [S, 'Fock back!', 'bei Bedarf: Fock back halten, damit der Bug herumgeht'],
    [S, 'Über die Fock!', 'Fock auf die neue Leeseite, neue Schot dicht'],
  ])}

<h3>${t('Halse', 'Gybing')}</h3>
<div class="kp-split">${fig(zeichnungHalse(t), t('Mitte: vor dem Wind, Großschot dicht, das Heck geht durch den Wind.', 'Centre: running, mainsheet in, the stern passes through the wind.'))}
<div class="kp-prosa"><p>${t('Bei der Halse geht das Heck durch den Wind. Der Baum schwenkt mit vollem Druck über; darum wird die Großschot vorher dichtgeholt und erst danach gefiert. Eine ungewollte Halse (Patenthalse) ist für Rigg und Crew gefährlich; auf Vorwindkursen sichert ein Bullenstander dagegen.',
    'In a gybe the stern passes through the wind. The boom swings across under full pressure, so the mainsheet is hauled in beforehand and eased only afterwards. An accidental gybe is dangerous for rig and crew; on downwind courses a preventer guards against it.')}</p>
${schritte(halse)}</div></div>
${kommandos(t, en ? [
    [S, 'Stand by to gybe?', 'prepare to gybe, crew answers'],
    [C, 'Ready!', 'preventer off, sheets prepared'],
    [S, 'Sheet in the main!', 'haul the boom in towards the centreline'],
    [S, 'Gybe-oh!', 'stern goes through the wind, boom comes across'],
    [S, 'Ease the main!', 'ease the mainsheet on the new side'],
  ] : [
    [S, 'Klar zur Halse?', 'Halse vorbereiten, Crew antwortet'],
    [C, 'Ist klar!', 'Bullenstander los, Schoten klar'],
    [S, 'Hol dicht die Großschot!', 'Baum nahe mittschiffs holen'],
    [S, 'Rund achtern!', 'Heck geht durch den Wind, Baum kommt über'],
    [S, 'Fier auf die Großschot!', 'Großschot auf der neuen Seite fieren'],
    [S, 'Über die Fock!', 'Fock auf die neue Seite'],
  ])}
<p>${t('Bei viel Wind und Seegang kann statt der Halse eine Q-Wende gefahren werden: anluven, wenden und auf dem neuen Bug wieder abfallen, insgesamt eine Kursänderung von rund 270°. Sie kostet Raum, der Baum schwenkt aber ohne Druck über.',
    'In strong wind and a seaway, a “chicken gybe” can replace the gybe: luff up, tack and bear away again on the new tack, a turn of about 270° in all. It takes more room, but the boom crosses without pressure.')}</p>

<h3>${t('Beidrehen', 'Heaving to')}</h3>
<div class="kp-split">${fig(zeichnungBeidrehen(t), t('Die Yacht liegt bei: Fock back, Groß gefiert, Ruder nach Luv festgesetzt.', 'The boat lies hove to: headsail backed, main eased, tiller lashed to leeward.'))}
<div class="kp-prosa"><p>${t('Beidrehen bringt die Yacht in eine ruhige Lage, in der sie fast auf der Stelle liegt (Beiliegen). Genutzt wird das zum Reffen, für Reparaturen, für eine Pause, in der letzten Phase eines Mensch-über-Bord-Manövers und mit genug Seeraum zum Abwettern.',
    'Heaving to brings the boat into a quiet state in which she stays almost in one place. It is used for reefing, repairs, a break, the final phase of a man-overboard recovery and, with enough sea room, for riding out heavy weather.')}</p>
${schritte(beidrehen)}</div></div>
${en ? quelle(sprache, 'points_sail', 'wiki_amwind', 'pbo_halse', 'nammert', 'sg_wende', 'sg_halse', 'wiki_qwende', 'sg_beiliegen', 'heaving_to')
    : quelle(sprache, 'wiki_amwind', 'points_sail', 'wiki_wende', 'sg_wende', 'wiki_halse', 'sg_halse', 'wiki_qwende', 'sg_beiliegen')}`;
}

export function ankernUnterSegel(sprache: Sprache, block: (titel: string, zeichnung: string, unterschrift: string, zweck: string,
  vorbereitung: string, schritte2: readonly string[], grenzen: string) => string): string {
  const t = tFuer(sprache);
  const en = sprache === 'en';
  const ankern = block(
    t('Ankern unter Segel', 'Anchoring under sail'),
    zeichnungAnkernSegel(t),
    t('Anlauf am Wind unter Groß, Aufschießer zum Ankerplatz, Anker fällt kurz vor dem Stillstand.', 'Approach close-hauled under main, shoot up to the spot, let go just before the boat stops.'),
    t('Ankern ohne Maschine. Es unterscheidet sich vom Ankern unter Maschine vor allem darin, dass das Großsegel stehen bleibt und das Schiff zurücktreiben muss, damit der Anker fasst.',
      'Anchoring without the engine. The main difference from anchoring under power is that the mainsail stays up and the boat has to fall back so the anchor can bite.'),
    t('Ankerplatz vorher erkunden, am besten einmal darüber kreuzen. Kettenlänge nach der Wassertiefe abmessen, Anker am Bugbeschlag klar zum Fallen, das Kettenende an Bord gesichert. Das Vorsegel bergen oder einrollen, damit das Vordeck frei ist. Einen Bullenstander an der Baumnock bereitlegen.',
      'Survey the anchorage first, ideally by sailing across it once. Measure the chain for the depth, have the anchor ready to let go at the bow roller, the bitter end secured. Stow or furl the headsail so the foredeck is clear. Have a preventer ready at the boom end.'),
    en ? [
      'Approach the spot from leeward, close-hauled under the main alone.',
      'Shoot up into the wind (round up head to wind) and let the mainsheet run: the main luffs and the boat loses way.',
      'Just before she stops, let go the anchor and pay out chain under control as the boat starts to fall back.',
      'If she makes too little sternway, push the main out against the wind with the preventer or by hand so that it drives her astern.',
      'Pay out to the full length and snub the chain to set the anchor. Once it holds, lower the main, take bearings and hoist the anchor ball.',
    ] : [
      'Den Ankerplatz aus Lee am Wind unter Groß allein anlaufen.',
      'Aufschießer in den Wind fahren und die Großschot ausrauschen lassen: Das Groß killt, die Fahrt läuft aus.',
      'Kurz vor dem Stillstand den Anker fallen lassen und Kette kontrolliert geben, während das Schiff zurückzutreiben beginnt.',
      'Treibt es zu wenig achteraus, das Groß mit dem Bullenstander oder von Hand gegen den Wind ausdrücken, bis es das Schiff zurückschiebt.',
      'Kette auf volle Länge geben und einrucken lassen. Hält der Anker, das Groß bergen, Peilungen nehmen, den Ankerball setzen.',
    ],
    t('Der Anker muss fallen, bevor das Schiff zurücktreibt, sonst dreht es quer zum Wind und das Groß füllt sich wieder. Platz zum Kreuzen einplanen, falls der Anker nicht fasst. In engen Gewässern mit Strom kann das Vorsegel allein besser zu dosieren sein.',
      'The anchor must go down before the boat gathers sternway, or she turns beam-on and the main fills again. Leave room to beat out in case the anchor does not hold. In tight waters with a current, the headsail alone can be easier to control.'),
  );
  const auf = block(
    t('Ankerauf unter Segel', 'Weighing anchor under sail'),
    zeichnungAnkerauf(t),
    t('Kette kurzstag, Groß gesetzt. Nach dem Ausbrechen den Bug mit dem Ruder wählen.', 'Chain up and down, main hoisted. After breaking out, choose the tack with the rudder.'),
    t('Ablegen vom Anker ohne Maschine. Die Ankerwinsch holt nur die Kette ein und zieht das Schiff nicht nach vorn; vorwärts kommt es durch Wind und Kettengewicht.',
      'Leaving an anchorage without the engine. The windlass only brings the chain in and does not pull the boat forward; she moves up by wind and the weight of the chain.'),
    t('Ankerbucht ansehen: Wie liegen und schwojen die anderen Schiffe, wo ist der Weg hinaus? Den Bug, auf dem abgefallen wird, vorher festlegen. Crew einteilen, eine Person an der Winsch.',
      'Look at the anchorage: how are the other boats lying and swinging, where is the way out? Decide beforehand on which tack to bear away. Brief the crew, one person at the windlass.'),
    en ? [
      'Hoist the main with the sheet slack. The boat lies head to wind, the sail luffs and has no power.',
      'Shorten the chain until it is up and down. In light air the weight of the chain pulls the boat forward; take in the slack each time. In more wind, sheet the main in briefly to gather way and ease it again.',
      'Break out the anchor. From now on the boat drifts astern and turns across the wind.',
      'Choose the tack with the rudder while drifting astern: rudder hard to starboard swings the stern to starboard and the bow to port, so she pays off on starboard tack. The other way round for port tack.',
      'Sheet in the main, gather way and leave on a reach. Secure the anchor, then set the headsail.',
    ] : [
      'Das Groß setzen, die Schot lose. Das Schiff liegt im Wind, das Segel killt und zieht nicht.',
      'Die Kette einholen, bis sie kurzstag steht. Bei wenig Wind zieht das Kettengewicht das Schiff vor, die Lose wird jeweils nachgeholt. Bei mehr Wind das Groß kurz dicht nehmen, damit es Fahrt aufnimmt, und wieder fieren.',
      'Den Anker ausbrechen. Ab jetzt treibt das Schiff achteraus und dreht quer zum Wind.',
      'Mit dem Ruder den Bug wählen, solange das Schiff achteraus treibt: Ruder hart Steuerbord schwenkt das Heck nach Steuerbord und den Bug nach Backbord, die Yacht fällt auf Steuerbordbug ab. Für den Backbordbug umgekehrt.',
      'Das Groß dichtholen, Fahrt aufnehmen und mit halbem Wind ablegen. Den Anker sichern, dann das Vorsegel setzen.',
    ],
    t('Nach dem Ausbrechen muss sofort Fahrt ins Schiff, sonst treibt es auf Lieger in Lee. Ist der Weg am eigenen Bug vorbei unsicher, liegt die Kette des Nachbarn weit vor dessen Bug; dann lieber abfallen und hinter ihm vorbei.',
      'Once the anchor breaks out the boat must get under way at once, or she drifts down onto boats to leeward. If you are unsure of clearing another boat’s bow, remember her chain runs well ahead of it; bear away and pass astern instead.'),
  );
  return `<h2>${t('Ankern und Ankerauf unter Segel', 'Anchoring and weighing anchor under sail')}</h2>${ankern}${auf}
${quelle(sprache, 'sg_ankern', 'classic_ankern', 'cg_ankerauf')}`;
}

