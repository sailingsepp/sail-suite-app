import { tFuer, quelle } from './bausteine';
import { Iso, rumpfGrundriss, RUMPF_SEITE, RUMPF_SEITE_DUNKEL, RUMPF_DECK, AUFBAU, AUFBAU_DECK } from './iso';
import { LAND } from './abschnitteB';
import { esc, k, pfeile } from './svg';
import { ankern } from './abschnitteC';
import { ankernUnterSegel } from './segelmanoever';
import type { Sprache } from '@/core/types';

const L = 10;
const B = 3.4;
const FB = 1.0;
const H = B / 2;

const KANTE_Y = H + 0.4;
const PIER_Z = 0.9;

type P2 = readonly [number, number];

interface Lage { dreh: P2; winkel: number }

function welt(lage: Lage, [x, y]: P2): [number, number] {
  const a = (lage.winkel * Math.PI) / 180;
  const dx = x - lage.dreh[0];
  const dy = y - lage.dreh[1];
  return [lage.dreh[0] + dx * Math.cos(a) - dy * Math.sin(a), lage.dreh[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

function see(iso: Iso): string {
  return iso.pfad([[-8.5, -6.5, 0], [14, -6.5, 0], [14, KANTE_Y, 0], [-8.5, KANTE_Y, 0]], 'var(--panel-2)', 'none', 0);
}

function pier(iso: Iso, poller: readonly number[]): string {
  const o = [iso.prisma([[-8.5, KANTE_Y], [14, KANTE_Y], [14, KANTE_Y + 2.2], [-8.5, KANTE_Y + 2.2]], 0, PIER_Z, LAND, LAND,
    'color-mix(in srgb, var(--text) 30%, var(--panel-2))')];
  for (const x of poller) {
    const y = KANTE_Y + 0.5;
    o.push(iso.prisma([[x - 0.2, y - 0.2], [x + 0.2, y - 0.2], [x + 0.2, y + 0.2], [x - 0.2, y + 0.2]], PIER_Z, PIER_Z + 0.45,
      AUFBAU, AUFBAU_DECK));
  }
  return o.join('');
}

const poller = (x: number): readonly [number, number, number] => [x, KANTE_Y + 0.5, PIER_Z + 0.4];

function geist(iso: Iso): string {
  const pts = rumpfGrundriss(L, B).map(([x, y]) => iso.p(x, y, FB));
  return `<polygon points="${pts.map(([a, b]) => `${k(a)},${k(b)}`).join(' ')}" fill="none" stroke="var(--muted)" `
    + 'stroke-width="1.1" stroke-dasharray="4 3"/>';
}

function schiff(iso: Iso, lage: Lage, ruder: number): string {
  const w = (p: P2) => welt(lage, p);
  const rumpf = iso.prisma(rumpfGrundriss(L, B).map(w), 0, FB, RUMPF_SEITE, RUMPF_DECK, RUMPF_SEITE_DUNKEL);
  const aufbau = iso.prisma(([[3.2, 1.0], [3.2, -1.0], [6.4, -1.0], [6.4, 1.0]] as P2[]).map(w), FB, FB + 0.9, AUFBAU, AUFBAU_DECK);
  const [rx, ry] = w([-0.9, ruder]);
  const [hx, hy] = w([0, 0]);

  return iso.linie([hx, hy, 0.35], [rx, ry, 0.35], 'var(--text)', 3) + rumpf + aufbau;
}

function leine(iso: Iso, pts: readonly (readonly [number, number, number])[]): string {
  const p = pts.map(([x, y, z]) => iso.p(x, y, z));
  return `<polyline points="${p.map(([a, b]) => `${k(a)},${k(b)}`).join(' ')}" fill="none" stroke="var(--akzent)" `
    + 'stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
}

function fender(iso: Iso, x: number, y: number): string {
  const [cx, cy] = iso.p(x, y, 0.5);
  return `<ellipse cx="${k(cx)}" cy="${k(cy)}" rx="5" ry="6.5" fill="var(--teal)" stroke="var(--bg)" stroke-width="1"/>`;
}

function beschriftung(iso: Iso, x: number, y: number, z: number, text: string, anker = 'middle', dy = 0): string {
  const [px, py] = iso.p(x, y, z);
  return `<text x="${k(px)}" y="${k(py + dy)}" text-anchor="${anker}" class="kp-l kp-l-h">${esc(text)}</text>`;
}

const SCHUB_Y = -(H + 1.1);

function schub(iso: Iso, lage: Lage, voraus: boolean, marke: string, text: string): string {
  const a = welt(lage, [voraus ? 1.2 : 5.2, SCHUB_Y]);
  const b = welt(lage, [voraus ? 5.2 : 1.2, SCHUB_Y]);
  const t = welt(lage, [3.2, SCHUB_Y - 1.3]);
  return iso.linie([a[0], a[1], 0.3], [b[0], b[1], 0.3], 'var(--text)', 2.2, ` marker-end="url(#${marke})"`)
    + beschriftung(iso, t[0], t[1], 0.3, text, 'middle', 5);
}

function schwenk(iso: Iso, lage: Lage, ende: P2, marke: string): string {
  const pts: string[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const w = 0.08 + (i / n) * 0.84;
    const [x, y] = welt({ dreh: lage.dreh, winkel: lage.winkel * w }, ende);
    const [px, py] = iso.p(x, y, 0);
    pts.push(`${k(px)},${k(py)}`);
  }
  return `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-dasharray="5 3" `
    + `marker-end="url(#${marke})"/>`;
}

function wind(iso: Iso, marke: string, text: string): string {
  return iso.linie([12.4, -6.2, 0], [12.4, -3.5, 0], 'var(--muted)', 2, ` marker-end="url(#${marke})"`)
    + beschriftung(iso, 12.4, -6.3, 0, text, 'middle', 15);
}

function svg(label: string, inhalt: (iso: Iso, p: ReturnType<typeof pfeile>) => string): string {
  const iso = new Iso(13, 192, 108);
  const p = pfeile();
  return `<svg class="kp-iso" viewBox="0 0 420 262" role="img" aria-label="${esc(label)}">${p.defs}`
    + `<rect width="420" height="262" fill="var(--bg)"/>${inhalt(iso, p)}</svg>`;
}

interface Wortlaut { pier: string; wind: string; fender: string; voraus: string; zurueck: string }

function wortlaut(sprache: Sprache): Wortlaut {
  return sprache === 'en'
    ? { pier: 'Quay', wind: 'Onshore wind', fender: 'Fender', voraus: 'Ahead', zurueck: 'Astern' }
    : { pier: 'Pier', wind: 'Wind auflandig', fender: 'Fender', voraus: 'Voraus', zurueck: 'Zurück' };
}

export function zeichnungVorspring(sprache: Sprache): string {
  const t = tFuer(sprache);
  const w = wortlaut(sprache);
  const lage: Lage = { dreh: [8.3, 0.93], winkel: 45 };
  return svg(t('Eindampfen in die Vorspring: Der Bug liegt an der Pier, das Heck schwenkt aus',
    'Springing off the bow spring: the bow stays at the quay, the stern swings out'), (iso, p) => {
    const klampe = welt(lage, [8.6, 0.6]);
    return see(iso) + pier(iso, [4.2]) + schwenk(iso, lage, [0, 0], p.text)
      + schiff(iso, lage, 0.55) + geist(iso) + fender(iso, 8.4, 1.75)
      + leine(iso, [[klampe[0], klampe[1], FB], poller(4.2)])
      + schub(iso, lage, true, p.text, w.voraus) + wind(iso, p.grau, w.wind)
      + beschriftung(iso, 12.6, KANTE_Y + 1.3, PIER_Z, w.pier, 'middle', -4)
      + beschriftung(iso, 5.6, KANTE_Y + 0.4, PIER_Z + 0.4, t('Vorspring', 'Bow spring'), 'middle', -12)
      + beschriftung(iso, 9.2, 1.6, 0.5, w.fender, 'start', 18);
  });
}

export function zeichnungAchterspring(sprache: Sprache): string {
  const t = tFuer(sprache);
  const w = wortlaut(sprache);
  const lage: Lage = { dreh: [0.4, 1.45], winkel: -32 };
  return svg(t('Eindampfen in die Achterspring: Das Heck liegt an der Pier, der Bug schwenkt aus',
    'Springing off the stern spring: the stern stays at the quay, the bow swings out'), (iso, p) => {
    const klampe = welt(lage, [1.0, 1.2]);
    return see(iso) + pier(iso, [6.2]) + schwenk(iso, lage, [L, 0], p.text)
      + schiff(iso, lage, 0) + geist(iso) + fender(iso, 0.3, 1.95)
      + leine(iso, [[klampe[0], klampe[1], FB], poller(6.2)])
      + schub(iso, lage, false, p.text, w.zurueck) + wind(iso, p.grau, w.wind)
      + beschriftung(iso, 12.6, KANTE_Y + 1.3, PIER_Z, w.pier, 'middle', -4)
      + beschriftung(iso, 4.2, KANTE_Y + 0.4, PIER_Z + 0.4, t('Achterspring', 'Stern spring'), 'middle', -12)
      + beschriftung(iso, 0.3, 1.95, 0.5, w.fender, 'end', -10);
  });
}

export function zeichnungAchterleine(sprache: Sprache): string {
  const t = tFuer(sprache);
  const w = wortlaut(sprache);
  const lage: Lage = { dreh: [0.4, 1.45], winkel: -38 };
  return svg(t('Eindampfen in die seewärtige Achterleine: Die Leine führt von der seewärtigen Heckklampe schräg zu einem Poller weit achteraus an der Pier, der Bug schwenkt aus',
    'Motoring ahead against the outboard stern line: the line leads from the outboard quarter cleat diagonally to a bollard well astern on the quay, the bow swings out'), (iso, p) => {
    const klampe = welt(lage, [0.5, -1.3]);
    return see(iso) + pier(iso, [-7.6]) + schwenk(iso, lage, [L, 0], p.text)
      + schiff(iso, lage, 0.3) + geist(iso) + fender(iso, 0.3, 1.95)
      + leine(iso, [[klampe[0], klampe[1], FB], poller(-7.6)])
      + schub(iso, lage, true, p.text, w.voraus) + wind(iso, p.grau, w.wind)
      + beschriftung(iso, 12.6, KANTE_Y + 1.3, PIER_Z, w.pier, 'middle', -4)
      + beschriftung(iso, -7.6, KANTE_Y + 0.4, PIER_Z + 0.4, t('Seewärtige Achterleine', 'Outboard stern line'), 'start', -14)
      + beschriftung(iso, 0.3, 1.95, 0.5, w.fender, 'start', 18);
  });
}

function manoeverBlock(titel: string, zeichnung: string, unterschrift: string, zweck: string,
  vorbereitung: string, schritte: readonly string[], grenzen: string, ueberschriften: readonly [string, string, string]): string {
  return `<h3>${titel}</h3>
<div class="kp-split"><figure class="kp-fig">${zeichnung}<figcaption class="kp-small">${unterschrift}</figcaption></figure>
<div class="kp-prosa"><p>${zweck}</p>
<p><b>${ueberschriften[0]}</b> ${vorbereitung}</p>
<p><b>${ueberschriften[1]}</b></p><ol class="kp-steps">${schritte.map((s) => `<li>${s}</li>`).join('')}</ol>
<p><b>${ueberschriften[2]}</b> ${grenzen}</p></div></div>`;
}

export function manoever(sprache: Sprache): string {
  const t = tFuer(sprache);
  const kopf: [string, string, string] = sprache === 'en'
    ? ['Preparation:', 'Procedure', 'Limits:'] : ['Vorbereitung:', 'Ablauf', 'Grenzen:'];
  const legende = t('Gestrichelt die Ausgangslage, farbig die Leine, in die eingedampft wird.',
    'Dashed: the starting position. Coloured: the line the boat motors against.');
  const vorspring = sprache === 'en' ? manoeverBlock(
    'Springing off the bow spring',
    zeichnungVorspring(sprache),
    `${legende} The bow spring holds the bow, the stern swings out.`,
    'Leaving an alongside berth when an onshore wind presses the boat against the quay, or when the boats ahead and astern leave little room. Going astern, prop walk would draw the stern to the quay; here the stern swings out first and the boat leaves stern first.',
    'Bow spring from the quay-side bow cleat led aft to the quay, rigged as a slip line (round the bollard and back on board) so it can be let go and recovered from on board. Fender the bow on the quay side well, ideally with a ball fender: it is pressed against the quay with considerable force. Keep the anchor and bow fittings clear of the quay. Check there is room astern for the stern to swing.',
    [
      'Take the load off all lines except the bow spring. Engage ahead at tick-over.',
      'Let go all lines except the bow spring. Put the rudder towards the quay, as if to drive the bow into it (wheel towards the quay, tiller away from it).',
      'Wait until the stern has swung well out, about 45° or more to the quay. In a strong onshore wind give more throttle.',
      'Neutral, slip and recover the bow spring, rudder amidships.',
      'Check that the stern is clear, engage astern and back out straight for two or three boat lengths; correct prop walk and crosswind with small rudder movements. Stop, take in the fenders and go ahead onto the new course.',
    ],
    'If the spring jams while being recovered, the manoeuvre fails. It is easiest when the stern turns into the wind; the boat can then be held in place with little throttle while the spring is let go. On boats whose rudder has little effect in the prop wash, hardly more than 45° can be reached.',
    kopf,
  ) : manoeverBlock(
    'Eindampfen in die Vorspring',
    zeichnungVorspring(sprache),
    `${legende} Die Vorspring hält den Bug, das Heck schwenkt aus.`,
    'Ablegen aus der Längsseitslage, wenn auflandiger Wind das Schiff an die Pier drückt oder Vorder- und Hintermann wenig Platz lassen. Rückwärts würde der Radeffekt das Heck an die Pier ziehen; hier schwenkt das Heck zuerst aus, abgelegt wird rückwärts.',
    'Vorspring von der pierseitigen Bugklampe nach achtern zur Pier, auf Slip (um den Poller und zurück an Bord), damit sie von Bord aus losgeworfen und eingeholt werden kann. Den Bug an der Pierseite gut abfendern, am besten mit einem Kugelfender: Er wird mit großer Kraft an die Pier gedrückt. Anker und Bugbeschläge frei von der Pier halten. Prüfen, ob achtern Raum zum Ausschwenken ist.',
    [
      'Alle Leinen außer der Vorspring entlasten. Vorwärtsgang einlegen, Standgas.',
      'Alle Leinen außer der Vorspring loswerfen. Ruder zur Pier legen, als wolle man mit dem Bug in die Pier fahren (Rad zur Pier, Pinne von der Pier weg).',
      'Warten, bis das Heck weit genug ausgeschwenkt ist, rund 45° oder mehr zur Pier. Bei starkem auflandigem Wind mehr Gas.',
      'Auskuppeln, Vorspring loswerfen und einholen, Ruder mittschiffs.',
      'Achtern frei prüfen, Rückwärtsgang einlegen und zwei bis drei Schiffslängen gerade zurück; Radeffekt und Seitenwind mit kleinen Ruderkorrekturen ausgleichen. Aufstoppen, Fender einholen, voraus auf den neuen Kurs.',
    ],
    'Klemmt die Spring beim Einholen, misslingt das Manöver. Am leichtesten geht es, wenn das Heck in den Wind dreht; dann hält wenig Gas das Schiff beim Loswerfen auf der Stelle. Bei Booten, deren Ruder im Schraubenstrom wenig wirkt, sind kaum mehr als 45° zu erreichen.',
    kopf,
  );

  const achterspring = sprache === 'en' ? manoeverBlock(
    'Springing off the stern spring',
    zeichnungAchterspring(sprache),
    `${legende} The stern spring holds the stern, the bow swings out.`,
    'Leaving an alongside berth bow first in an onshore wind. The engine runs astern against the spring, the stern stays at the quay and the bow swings out.',
    'Stern spring from the quay-side quarter cleat led forward to the quay, as a slip line. Fender the stern well, a ball fender at the quarter; while motoring astern check that the fenders stay in place.',
    [
      'Let go all lines except the stern spring, the bow line last.',
      'Engage astern, rudder amidships, and wait until the bow has swung far enough off the quay. Give more throttle in more wind.',
      'Rudder amidships or slightly towards the quay so that the stern stays clear when the boat moves ahead.',
      'Engage ahead; as soon as the spring slackens, slip and recover it, and leave ahead clear of the quay.',
    ],
    'Going astern the rudder has little effect; the stern is held by the spring. With a right-handed propeller, prop walk moves the stern to port when going astern: port side to, it helps the bow swing out, starboard side to, it works against it. According to SkipperGuide only in light winds up to about Force 4–5. Wind from abaft the beam makes it harder, because the area exposed to the wind grows as the bow swings out. In those conditions the bow spring is the better choice.',
    kopf,
  ) : manoeverBlock(
    'Eindampfen in die Achterspring',
    zeichnungAchterspring(sprache),
    `${legende} Die Achterspring hält das Heck, der Bug schwenkt aus.`,
    'Ablegen voraus aus der Längsseitslage bei auflandigem Wind. Die Maschine läuft rückwärts gegen die Spring, das Heck bleibt an der Pier, der Bug schwenkt aus.',
    'Achterspring von der pierseitigen Heckklampe nach vorn zur Pier, auf Slip. Das Heck gut abfendern, ein Kugelfender an die Heckecke; beim Rückwärtsdampfen darauf achten, dass die Fender an ihrem Platz bleiben.',
    [
      'Alle Leinen außer der Achterspring loswerfen, die Vorleine zuletzt.',
      'Rückwärtsgang einlegen, Ruder mittschiffs, und warten, bis der Bug weit genug von der Pier weggeschwenkt ist. Bei mehr Wind mehr Gas.',
      'Ruder mittschiffs oder leicht zur Pier legen, damit das Heck beim Anfahren frei bleibt.',
      'Vorwärtsgang einlegen; sobald die Spring lose kommt, loswerfen und einholen, frei von der Pier voraus ablegen.',
    ],
    'Rückwärts wirkt das Ruder kaum; das Heck hält die Spring. Bei rechtsdrehender Schraube versetzt der Radeffekt das Heck rückwärts nach Backbord: Mit Backbord an der Pier hilft er beim Ausschwenken, mit Steuerbord an der Pier arbeitet er dagegen. Nach SkipperGuide nur bei leichtem Wind bis etwa 4–5 Bft. Wind achterlicher als querab erschwert das Manöver, weil die Windangriffsfläche mit dem Ausschwenken wächst. Dann ist die Vorspring die bessere Wahl.',
    kopf,
  );

  const achterleine = sprache === 'en' ? manoeverBlock(
    'Motoring ahead against the outboard stern line',
    zeichnungAchterleine(sprache),
    `${legende} The line pulls on the outboard quarter and turns the bow off the quay.`,
    'Leaving bow first from a tight gap alongside, on a lee shore, when prop walk would draw the stern to the quay going astern. Works with a crew of two, according to SkipperGuide also in strong wind. The propeller turns ahead throughout, so prop walk and gear changes play no part.',
    'Make a stern line fast on the outboard (seaward) quarter cleat, lead it diagonally past the stern to a bollard well astern on the quay and rig it as a slip line; in a tight gap it may have to be led via the boat astern. Fender the stern. Amidships two fenders are enough, because the boat comes off the quay roughly parallel at the end.',
    [
      'Rudder slightly towards the quay: the prop wash on the rudder keeps the stern off the quay. With the rudder amidships the turn would press the stern against the quay.',
      'Engage ahead with enough throttle from the start; too little thrust makes the manoeuvre fail.',
      'Only when the boat is motoring firmly against the stern line, let go the other lines one after the other.',
      'Balance the boat with throttle and rudder until the bow has swung clear. In a tight gap ease the stern line once the boat has turned far enough, so that it comes clear of its neighbours.',
      'With the bow clear, slip the stern line, recover it quickly and keep it out of the propeller, then leave ahead.',
    ],
    'The line pulls at the outboard quarter: the broader the stern, the longer the lever. A current can help considerably or make the manoeuvre harder.',
    kopf,
  ) : manoeverBlock(
    'Eindampfen in die seewärtige Achterleine',
    zeichnungAchterleine(sprache),
    `${legende} Die Leine zieht an der seewärtigen Heckecke und dreht den Bug von der Pier weg.`,
    'Ablegen voraus aus einer engen Lücke in der Längsseitslage, an einem Legerwall, wenn der Radeffekt das Heck rückwärts an die Pier ziehen würde. Mit zwei Personen fahrbar, nach SkipperGuide auch bei viel Wind. Die Schraube dreht das ganze Manöver über voraus, Radeffekt und Schaltpausen spielen keine Rolle.',
    'Eine Achterleine an der seewärtigen (landfernen) Heckklampe belegen, hinter dem Heck vorbei schräg zu einem Poller weit achteraus an der Pier führen und auf Slip legen; in enger Lücke unter Umständen über den Hintermann. Das Heck abfendern. Mittschiffs reichen zwei Fender, weil sich das Schiff zum Schluss annähernd parallel von der Pier löst.',
    [
      'Ruder leicht zur Pier legen: Der Schraubenstrom auf dem Ruder hält das Heck von der Pier frei. Mit Ruder mittschiffs drückt die Drehung das Heck an die Pier.',
      'Vorwärtsgang einlegen und gleich zu Beginn genug Gas geben; zu wenig Schub lässt das Manöver misslingen.',
      'Erst wenn das Schiff kräftig in die Achterleine eindampft, die übrigen Leinen nacheinander loswerfen.',
      'Mit Gas und Ruderlage ausbalancieren, bis der Bug frei geschwenkt ist. In enger Lücke die Achterleine nach ausreichender Drehung fieren, damit das Schiff von den Nachbarn freikommt.',
      'Ist der Bug frei, die Achterleine slippen, zügig einholen und aus der Schraube halten, voraus ablegen.',
    ],
    'Die Leine zieht an der seewärtigen Heckecke: Je breiter das Heck, desto länger der Hebel. Strom kann das Manöver deutlich unterstützen oder erschweren.',
    kopf,
  );

  return `
<h2>${t('Ablegen mit Eindampfen', 'Leaving a berth by motoring against a line')}</h2>
<p class="kp-lede">${t(
    'Drei Ablegemanöver aus der Längsseitslage unter Maschine, vor allem für auflandigen Wind. Eine Leine hält ein Ende des Schiffs, Schub und Ruder drehen das andere von der Pier weg. Die Zeichnungen zeigen eine Yacht mit Backbord an der Pier; mit Steuerbord an der Pier gilt alles spiegelbildlich.',
    'Three ways of leaving an alongside berth under power, mainly in an onshore wind. A line holds one end of the boat while thrust and rudder turn the other end off the quay. The drawings show a yacht lying port side to; starboard side to, everything is mirrored.')}</p>
${vorspring}
${achterspring}
${achterleine}
${quelle(sprache, 'sg_vorspring', 'sg_achterspring', 'sg_achterleine', 'fu_manoever', 'yacht_radeffekt')}
${ankern(sprache)}
${ankernUnterSegel(sprache, (a, b, c, d, e, f, g) => manoeverBlock(a, b, c, d, e, f, g, kopf))}`;
}
