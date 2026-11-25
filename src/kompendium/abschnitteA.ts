import { beaufortTabelle, douglasTabelle } from './daten';
import { BEAUFORT_FOTOS } from './beaufortFotos';
import { tFuer, quelle } from './bausteine';
import { esc, k, aufKreis, pfeile } from './svg';
import { szene, horizontboegen } from './fahrzeuge';
import { lagebilderIso } from './ausweichIso';
import { signalkoerper, type Koerper } from './tonnen';
import { schall } from './kennung';
import { flaggeEingebettet } from './flaggen';
import { LICHT, NOT, type Lichtfarbe } from './farben';
import type { Sprache } from '@/core/types';

export function windSee(sprache: Sprache): string {
  const t = tFuer(sprache);

  const foto = (stufe: number, name: string) => {
    const url = BEAUFORT_FOTOS[stufe];
    if (!url) return '<td></td>';
    const text = sprache === 'en' ? `Photo of the sea at force ${stufe}, ${name}: enlarge` : `Foto der See bei ${stufe} Bft, ${name}: vergrößern`;
    return `<td class="kp-bft-fotozelle"><button type="button" class="kp-bft-foto" data-foto="${esc(url)}" `
      + `data-foto-text="${esc(sprache === 'en' ? `Force ${stufe}, ${name}` : `${stufe} Bft, ${name}`)}" aria-label="${esc(text)}">`
      + `<img class="kp-fach" src="${esc(url)}" alt="" width="96" height="66" loading="lazy" decoding="async"></button></td>`;
  };
  const bft = beaufortTabelle(sprache).map((z) => `<tr><th scope="row" class="kp-num kp-gross">${z.stufe}</th>`
    + `${foto(z.stufe, z.name)}<td class="kp-nm">${esc(z.name)}</td><td class="kp-num">${z.kn}</td><td class="kp-num">${z.welle}</td><td>${esc(z.see)}</td></tr>`).join('');
  const dg = douglasTabelle(sprache).map((z) => `<tr><th scope="row" class="kp-num kp-gross">${z.wert}</th><td class="kp-nm">${esc(z.name)}</td>`
    + `${sprache === 'en' ? '' : `<td class="kp-en">${esc(z.wmo)}</td>`}<td class="kp-num">${z.hoehe}</td></tr>`).join('');
  return `
<h2>${t('Beaufort-Skala', 'Beaufort scale')}</h2>
<p class="kp-lede">${t(
    'Windstärke nach dem Bild der See. Windgeschwindigkeit in 10 m Höhe, gerundet. Wellenhöhe ist die signifikante Höhe H<sub>1/3</sub> einer ausgereiften Windsee ohne Dünung, ein Richtwert. Die Bezeichnungen sind dieselben wie in den Briefings der Suite.',
    'Wind force judged by the state of the sea. Wind speed at 10 m above the surface. The wave height is the probable height in the open sea, remote from land, as a guide; in enclosed waters or near land it is smaller. The descriptions are the same as in the briefings of the suite.')}</p>
<div class="kp-tw"><table class="kp-data kp-bft">
<thead><tr><th>${t('Bft', 'Force')}</th><th>${t('Foto', 'Photo')}</th><th>${t('Bezeichnung', 'Description')}</th><th>kn</th><th>${t('H<sub>1/3</sub> m', 'Wave m')}</th><th>${t('Was auf See zu sehen ist', 'Appearance of the sea')}</th></tr></thead>
<tbody>${bft}</tbody></table></div>
<p class="kp-note">${t(
    'Die Fotos zeigen ausgereifte See auf tiefem Wasser: lange gleichbleibender Wind über großem Seeraum, aufgenommen von Handelsschiffen. Bei kurzem Seeraum, wie oft im Mittelmeer, sieht dieselbe Windstärke kürzer und niedriger aus; Wind gegen Strom macht die See steiler, flaches Wasser lässt sie eher brechen. Antippen vergrößert ein Foto.',
    'The photographs show a fully developed sea in deep water: wind steady for a long time over a long fetch, taken from merchant ships. With a short fetch, as often in the Mediterranean, the same force looks shorter and lower; wind against tide makes the sea steeper, shallow water makes it break sooner. Tap a photo to enlarge it.')}</p>
${sprache === 'en' ? quelle(sprache, 'noaa_bft', 'metoffice', 'nws_seastate') : quelle(sprache, 'asr', 'nws_seastate')}
<h2>${t('Seegang nach Douglas', 'Douglas sea scale')}</h2>
<p class="kp-lede">${t(
    'Die Seegangsskala (WMO-Code 3700) beschreibt die Wellenhöhe der gut entwickelten Windsee auf offener See. Die Grenzhöhe zählt zur niedrigeren Stufe: 4 m sind „grob“.',
    'The sea state code (WMO code 3700) describes the height of well-developed wind waves in the open sea. The exact bounding height belongs to the lower category: a sea of 4 m is “rough”.')}</p>
<div class="kp-tw"><table class="kp-data kp-douglas">
<thead><tr><th>${t('Wert', 'Code')}</th><th>${t('Bezeichnung', 'Description')}</th>${sprache === 'en' ? '' : '<th>WMO (engl.)</th>'}<th>${t('Wellenhöhe m', 'Wave height m')}</th></tr></thead>
<tbody>${dg}</tbody></table></div>
<p class="kp-note">${t('Ist die See so durcheinander, dass keine Stufe passt, empfiehlt die WMO den Begriff „konfus“ (confused).',
    'When the sea is so confused that none of the terms fits, the WMO recommends the term “confused”.')}</p>
${sprache === 'en' ? quelle(sprache, 'wmo3700', 'wmofaq') : quelle(sprache, 'wmo3700', 'wmofaq', 'dewiki_douglas')}`;
}

interface Pf { defs: string; grau: string; akzent: string; text: string }

function boot(x: number, y: number, kurs: number, art: 'sail' | 'power', windAus: number, weicht: boolean, label: string): string {
  const farbe = weicht ? 'var(--gelb)' : 'var(--text)';
  const rumpf = 'M0 -20 C7 -12 8 -2 8 6 L7 16 L-7 16 L-8 6 C-8 -2 -7 -12 0 -20 Z';
  const teile = [`<path d="${rumpf}" fill="var(--bg)" stroke="${farbe}" stroke-width="2"/>`];
  if (art === 'sail') {
    const rel = (((windAus - kurs) % 360) + 360) % 360;
    const seite = rel > 0 && rel < 180 ? -1 : 1;
    teile.push(`<line x1="0" y1="-6" x2="${seite * 9}" y2="15" stroke="${farbe}" stroke-width="2.4" stroke-linecap="round"/>`);
    teile.push(`<circle cx="0" cy="-6" r="2" fill="${farbe}"/>`);
  } else {
    teile.push(`<rect x="-4.5" y="-2" width="9" height="9" rx="1.5" fill="${farbe}"/>`);
  }
  const lab = label ? `<text x="${x}" y="${y + 36}" text-anchor="middle" class="kp-rr-l">${esc(label)}</text>` : '';
  return `<g transform="translate(${x},${y}) rotate(${kurs})">${teile.join('')}</g>${lab}`;
}

function lagebild(inhalt: (p: Pf) => string, label: string, h = 190): string {
  const p = pfeile();
  return `<svg class="kp-rr" viewBox="0 0 240 ${h}" role="img" aria-label="${esc(label)}">${p.defs}`
    + `<rect width="240" height="${h}" fill="var(--panel-2)"/>${inhalt(p)}</svg>`;
}

function sektor(cx: number, cy: number, r: number, a0: number, a1: number, fill: string, deckung: number): string {
  const [x0, y0] = aufKreis(cx, cy, r, a0);
  const [x1, y1] = aufKreis(cx, cy, r, a1);
  const gross = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0;
  return `<path d="M${cx} ${cy} L${k(x0)} ${k(y0)} A${r} ${r} 0 ${gross} 1 ${k(x1)} ${k(y1)} Z" fill="${fill}" fill-opacity="${deckung}"/>`;
}

function kursgrenze(sprache: Sprache): string {
  const t = tFuer(sprache);
  const [cx, cy, r] = [120, 118, 96];
  const linie = (a: number) => { const [x, y] = aufKreis(cx, cy, r + 4, a); return `<line x1="${cx}" y1="${cy}" x2="${k(x)}" y2="${k(y)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`; };
  const text = (a: number, rr: number, inhalt: string, klasse = 'kp-rr-l', dy = 4) => { const [x, y] = aufKreis(cx, cy, rr, a); return `<text x="${k(x)}" y="${k(y + dy)}" text-anchor="middle" class="${klasse}">${inhalt}</text>`; };
  return sektor(cx, cy, r, 0, 112.5, 'var(--gelb)', 0.2)
    + sektor(cx, cy, r, 112.5, 247.5, 'var(--muted)', 0.18)
    + sektor(cx, cy, r, 247.5, 360, 'var(--teal)', 0.16)
    + linie(0) + linie(112.5) + linie(247.5)
    + boot(cx, cy, 0, 'power', 0, false, '')
    + text(56, 62, t('ich weiche', 'I give way'), 'kp-rr-l kp-rr-amber')
    + text(56, 62, t('(15)', '(15)'), 'kp-rr-s', 18)
    + text(304, 62, t('Kurshalter', 'stand-on'))
    + text(304, 62, t('(17)', '(17)'), 'kp-rr-s', 18)
    + text(180, 66, t('Überholer', 'overtaking'))
    + text(180, 66, t('weicht (13)', 'gives way (13)'), 'kp-rr-s', 18)
    + text(112.5, r + 10, t('112,5°', '112.5°'), 'kp-rr-s')
    + text(247.5, r + 10, t('247,5°', '247.5°'), 'kp-rr-s')
    + text(0, r + 12, '0°', 'kp-rr-s', 2);
}

export function ausweichregeln(sprache: Sprache): string {
  const t = tFuer(sprache);
  const { d1, d2, d3, d4, d5 } = lagebilderIso(t);

  const d6 = lagebild(() => kursgrenze(sprache), t('Überholen oder kreuzen: Peilung des anderen Fahrzeugs vom eigenen Bug', 'Overtaking or crossing: bearing of the other vessel from your own bow'), 230);

  const leiter = sprache === 'en'
    ? [['not under command · restricted in her ability to manoeuvre', 'Rule 18 a–c'],
      ['constrained by her draught (signals of Rule 28): do not impede her safe passage', 'Rule 18 d'],
      ['engaged in fishing', 'Rule 18 a–c'], ['sailing vessel', 'Rule 18 a, b'], ['power-driven vessel', 'Rule 18 a']]
    : [['manövrierunfähig · manövrierbehindert', 'Regel 18 a–c'],
      ['tiefgangbehindert (Signale nach Regel 28): Durchfahrt nicht behindern', 'Regel 18 d'],
      ['fischendes Fahrzeug', 'Regel 18 a–c'], ['Segelfahrzeug', 'Regel 18 a, b'], ['Maschinenfahrzeug', 'Regel 18 a']];
  const karten: [string, string, string, string][] = [
    [d1, t('Segler untereinander', 'Sailing vessels'), t('KVR 12 a i', 'Rule 12 (a)(i)'), t(
      'Haben zwei Segelfahrzeuge den Wind von verschiedenen Seiten, weicht das mit Wind von Backbord. Die Luvseite ist die dem gesetzten Großsegel gegenüberliegende Seite.',
      'When two sailing vessels have the wind on different sides, the vessel with the wind on the port side keeps out of the way. The windward side is the side opposite to that on which the mainsail is carried.')],
    [d2, t('Wind von derselben Seite', 'Wind on the same side'), t('KVR 12 a ii, iii', 'Rule 12 (a)(ii), (iii)'), t(
      'Das luvwärtige weicht dem leewärtigen. Wer mit Wind von Backbord einen Luv-Segler nicht sicher einordnen kann, weicht.',
      'The vessel to windward keeps out of the way of the vessel to leeward. A vessel with the wind on the port side that cannot determine with certainty the tack of a vessel to windward keeps out of the way.')],
    [d3, t('Überholen', 'Overtaking'), t('KVR 13', 'Rule 13'), t(
      'Der Überholer weicht jedem Fahrzeug aus, gleich welcher Art. Überholer ist, wer aus mehr als 22,5° achterlicher als querab aufkommt (nachts: nur das Hecklicht sieht). Im Zweifel gilt man als Überholer.',
      'Any vessel overtaking any other keeps out of the way of the vessel being overtaken. A vessel is overtaking when coming up from more than 22.5° abaft the beam (at night: she would see only the sternlight). In case of doubt, assume you are overtaking.')],
    [d4, t('Entgegengesetzte Kurse', 'Head-on situation'), t('KVR 14', 'Rule 14'), t(
      'Zwei Maschinenfahrzeuge auf (fast) entgegengesetzten Kursen ändern beide nach Steuerbord und passieren Backbord an Backbord. Nachts: Topplichter in Linie und/oder beide Seitenlichter in Sicht.',
      'Two power-driven vessels on reciprocal or nearly reciprocal courses each alter course to starboard and pass port to port. At night: masthead lights in line or nearly in line and/or both sidelights visible.')],
    [d5, t('Kreuzende Kurse', 'Crossing situation'), t('KVR 15–17', 'Rules 15–17'), t(
      'Wer den anderen an Steuerbord hat, weicht, frühzeitig und durchgreifend (16). Der Kurshalter hält Kurs und Geschwindigkeit, darf aber selbst manövrieren, wenn der andere nicht handelt, und muss es, wenn ein Zusammenstoß sonst nicht vermeidbar ist (17).',
      'The vessel which has the other on her own starboard side keeps out of the way, early and substantial action (16). The stand-on vessel keeps her course and speed, but may act if the give-way vessel does not, and must act when collision cannot be avoided by the give-way vessel alone (17).')],
    [d6, t('Überholen oder kreuzen? Die Grenze', 'Overtaking or crossing? The limit'), t('KVR 13–15', 'Rules 13–15'), t(
      'Entscheidend ist die Peilung des anderen Fahrzeugs vom eigenen Bug. Kommt es aus mehr als 22,5° achterlicher als querab auf (aus dem Sektor 112,5° bis 247,5°), ist es Überholer und weicht (13); nachts sieht es dann nur das Hecklicht. Steht es vorlicher an Steuerbord (bis 112,5°), ist es eine Kreuzungslage, und ich weiche (15). Steht es vorlicher an Backbord (ab 247,5°), bin ich Kurshalter (17). Recht oder fast recht voraus auf Gegenkurs ändern beide nach Steuerbord (14). Im Zweifel gilt man als Überholer (13 c) bzw. die Lage als Gegenkurs (14 c). Kreuzen und Gegenkurs nach 14 und 15 gelten für Maschinenfahrzeuge untereinander; Segler untereinander nach Regel 12, Überholen gilt für alle.',
      'What decides is the bearing of the other vessel from your own bow. If she comes up from more than 22.5° abaft your beam (the sector 112.5° to 247.5°), she is overtaking and keeps out of the way (13); at night she sees only your sternlight. If she is further forward on your starboard side (up to 112.5°), it is a crossing situation and you give way (15). If she is further forward on your port side (from 247.5°), you are the stand-on vessel (17). Right ahead or nearly ahead on a reciprocal course, both alter to starboard (14). In case of doubt a vessel shall assume she is overtaking (13 c) or that a head-on situation exists (14 c). Crossing and head-on under Rules 14 and 15 apply between power-driven vessels; sailing vessels follow Rule 12, overtaking applies to all.')],
  ];
  const kk = karten.map(([svg, ti, r, x]) => `<div class="kp-karte">${svg}<h3>${ti} <span class="kp-regel">${r}</span></h3><p>${x}</p></div>`).join('');
  return `
<h2>${t('Ausweichregeln', 'Steering and sailing rules')}</h2>
<p class="kp-lede">${t(
    'Die Regeln 11 bis 18 gelten für Fahrzeuge, die einander sehen. Hervorgehoben (gelb) ist jeweils das ausweichpflichtige Fahrzeug, mit gestrichelter Linie die Fahrtrichtung, mit durchgezogener Linie ein mögliches Ausweichmanöver.',
    'Rules 11 to 18 apply to vessels in sight of one another. The give-way vessel is highlighted (yellow), the heading drawn as a dashed line, a possible avoiding action as a solid line.')}</p>
<div class="kp-raster kp-raster-260">${kk}
<div class="kp-karte"><h3>${t('Wer weicht wem?', 'Who keeps out of whose way?')} <span class="kp-regel">${t('KVR 18', 'Rule 18')}</span></h3>
<p>${t('Sofern die Regeln 9, 10 und 13 nichts anderes bestimmen, weicht jedes Fahrzeug allen, die in dieser Liste über ihm stehen:',
    'Except where Rules 9, 10 and 13 otherwise require, each vessel keeps out of the way of every vessel listed above it:')}</p>
<ol class="kp-leiter">${leiter.map(([a, r]) => `<li><span>${esc(a!)}</span><span class="kp-regel">${r}</span></li>`).join('')}</ol>
<p class="kp-small">${t('Fischer weichen „soweit möglich“. Ein Wasserflugzeug hält sich von allen Fahrzeugen frei. Der Überholer weicht immer (13).',
    'Fishing vessels keep out of the way “so far as possible”. A seaplane keeps well clear of all vessels. The overtaking vessel always keeps out of the way (13).')}</p></div>
</div>
<div class="kp-drei">
<div><h3>${t('Enges Fahrwasser', 'Narrow channels')} <span class="kp-regel">${t('KVR 9', 'Rule 9')}</span></h3><p>${t(
    'Möglichst weit rechts am äußeren Rand fahren. Fahrzeuge unter 20 m und Segelfahrzeuge dürfen die Durchfahrt eines Fahrzeugs nicht behindern, das nur im Fahrwasser sicher fahren kann. Nicht queren, wenn das dieses Fahrzeug behindert. Ankern im engen Fahrwasser vermeiden.',
    'Keep as near to the outer limit on the starboard side as is safe and practicable. Vessels under 20 m and sailing vessels shall not impede a vessel that can safely navigate only within the channel. Do not cross if this impedes such a vessel. Avoid anchoring in a narrow channel.')}</p></div>
<div><h3>${t('Verkehrstrennungsgebiet', 'Traffic separation schemes')} <span class="kp-regel">${t('KVR 10', 'Rule 10')}</span></h3><p>${t(
    'Im Einbahnweg in Verkehrsrichtung fahren. Queren möglichst im rechten Winkel zur Verkehrsrichtung (Kielrichtung). Unter 20 m und Segler dürfen die sichere Durchfahrt eines Maschinenfahrzeugs im Einbahnweg nicht behindern; sie dürfen die Küstenverkehrszone benutzen.',
    'Proceed in the appropriate traffic lane in the general direction of traffic flow. Cross on a heading as nearly as practicable at right angles to the general direction of traffic flow. Vessels under 20 m and sailing vessels shall not impede the safe passage of a power-driven vessel following a traffic lane; they may use the inshore traffic zone.')}</p></div>
<div><h3>${t('Verminderte Sicht', 'Restricted visibility')} <span class="kp-regel">${t('KVR 19', 'Rule 19')}</span></h3><p>${t(
    'Hier gelten keine Ausweichregeln nach Sicht. Sichere Geschwindigkeit, bei Nebelsignal vorlicher als querab Fahrt auf das Mindeste reduzieren. Mit Radar möglichst keine Kursänderung nach Backbord gegenüber einem Fahrzeug vorlicher als querab (außer beim Überholen) und keine auf ein Fahrzeug querab oder achterlicher zu.',
    'The rules for vessels in sight of one another do not apply. Proceed at a safe speed; on hearing a fog signal forward of the beam, reduce speed to the minimum. With radar, avoid an alteration to port for a vessel forward of the beam (other than one being overtaken) and an alteration towards a vessel abeam or abaft the beam.')}</p></div>
</div>
${sprache === 'en' ? quelle(sprache, 'colregs') : quelle(sprache, 'kvr', 'kvr_text')}`;
}

const lc = (c: Lichtfarbe, text: string) => `<i class="kp-dot kp-fach" style="--c:${LICHT[c]}"></i>${text}`;

function fahrzeugkarte(sprache: Sprache, schluessel: string, titel: string, regel: string, lichter: string[],
  tag: string, koerper: Koerper[], koerperLabel: string, notiz = ''): string {
  const t = tFuer(sprache);
  const tagSvg = koerper.length ? signalkoerper(koerper, koerperLabel)
    : `<div class="kp-keinkoerper">${t('kein Signalkörper', 'no shape')}</div>`;
  return `<article class="kp-fahrzeug"><header><h3>${titel}</h3><span class="kp-regel">${regel}</span></header>
<div class="kp-fgrid"><div class="kp-nacht">${szene(schluessel, `${titel}: ${t('Lichter bei Nacht', 'lights at night')}`)}</div>
<div class="kp-ftext"><h4>${t('Bei Nacht', 'At night')}</h4><ul>${lichter.map((x) => `<li>${x}</li>`).join('')}</ul>
<div class="kp-tagzeile">${tagSvg}<div><h4>${t('Am Tag', 'By day')}</h4><p>${tag}</p></div></div>${notiz}</div></div></article>`;
}

export function lichter(sprache: Sprache): string {
  const t = tFuer(sprache);
  const ank = (a: string) => `kp-li-${a}`;
  const F = (...a: Parameters<typeof fahrzeugkarte> extends [Sprache, ...infer R] ? R : never) => fahrzeugkarte(sprache, ...a);
  const teile: string[] = [];
  teile.push(`<h2 id="${ank('maschine')}">${t('Maschinenfahrzeug', 'Power-driven vessel')}</h2>`);
  teile.push(F('power', t('Maschinenfahrzeug in Fahrt', 'Power-driven vessel under way'), t('KVR Regel 23', 'COLREGs Rule 23'),
    [lc('W', t('Topplicht vorn (225°)', 'masthead light forward (225°)')),
      lc('W', t('zweites Topplicht achterlicher und höher: Pflicht ab 50 m Länge', 'second masthead light abaft of and higher than the forward one: obligatory from 50 m length')),
      `${lc('G', t('Seitenlicht Steuerbord grün', 'sidelights: green to starboard'))} · ${lc('R', t('Backbord rot (je 112,5°)', 'red to port (112.5° each)'))}`,
      lc('W', t('Hecklicht (135°)', 'sternlight (135°)'))],
    t('Kein Signalkörper.', 'No shape.'), [], ''));
  teile.push(F('small_power', t('Maschinenfahrzeug unter 12 m', 'Power-driven vessel under 12 m'), t('KVR Regel 23 d', 'COLREGs Rule 23 d'),
    [lc('W', t('weißes Rundumlicht statt Topp- und Hecklicht', 'all-round white light in lieu of masthead and sternlight')),
      `${lc('G', t('Seitenlichter', 'sidelights'))}${t(', auch als Zweifarbenlaterne', ', may be a combined lantern')}`,
      t('unter 7 m und höchstens 7 kn: weißes Rundumlicht genügt, Seitenlichter wenn möglich', 'under 7 m and not more than 7 kn: all-round white light, sidelights if practicable')],
    t('Kein Signalkörper.', 'No shape.'), [], ''));
  teile.push(`<div class="kp-split"><div class="kp-fig kp-fig-schmal">${horizontboegen(sprache)}</div><div class="kp-prosa"><h3>${t('Horizontbögen', 'Arcs of visibility')}</h3><p>${t(
    'Topplicht: weiß über 225°, von recht voraus bis 22,5° achterlicher als querab nach jeder Seite. Seitenlichter: je 112,5° von recht voraus bis 22,5° achterlicher als querab. Hecklicht: 135°, je 67,5° nach jeder Seite von recht achteraus. Schlepplicht: gelb, wie das Hecklicht. Rundumlicht: 360°.',
    'Masthead light: white over 225°, from right ahead to 22.5° abaft the beam on either side. Sidelights: 112.5° each, from right ahead to 22.5° abaft the beam on its side. Sternlight: 135°, 67.5° from right aft on each side. Towing light: yellow, same arc as the sternlight. All-round light: 360°.')}</p><p>${t(
    'Mindesttragweiten unter 12 m: Topplicht 2 sm, Seitenlicht 1 sm, Heck- und Rundumlicht 2 sm. Die Bilder zeigen die Anordnung aller Lichter; aus einer bestimmten Richtung sieht man jeweils nur die Lichter, in deren Bogen man steht.',
    'Minimum ranges for vessels under 12 m: masthead light 2 NM, sidelight 1 NM, sternlight and all-round light 2 NM. The drawings show where all the lights are placed; from any one direction you only see the lights whose arc you are in.')}</p></div></div>`);
  teile.push(`<h2 id="${ank('schlepp')}">${t('Schleppen', 'Towing')}</h2>`);
  teile.push(F('tow', t('Schleppverband', 'Vessel towing'), t('KVR Regel 24', 'COLREGs Rule 24'),
    [lc('W', t('zwei Topplichter senkrecht übereinander, drei wenn der Schleppzug vom Heck bis zum Ende des Anhangs länger als 200 m ist', 'two masthead lights in a vertical line; three when the tow, measured from the stern of the towing vessel to the after end of the tow, exceeds 200 m')),
      `${lc('G', t('Seitenlichter', 'sidelights'))} ${t('und', 'and')} ${lc('W', t('Hecklicht', 'sternlight'))}`,
      lc('Y', t('gelbes Schlepplicht senkrecht über dem Hecklicht', 'yellow towing light in a vertical line above the sternlight')),
      t('Anhang: Seitenlichter und Hecklicht', 'vessel towed: sidelights and sternlight')],
    t('Schleppzug länger als 200 m: Schlepper und Anhang je ein Rhombus, wo er am besten zu sehen ist.', 'Tow longer than 200 m: a diamond shape on the towing vessel and on the tow, where it can best be seen.'),
    ['diamond'], t('Rhombus', 'Diamond'),
    `<p class="kp-small">${t('Schiebt oder schleppt das Fahrzeug längsseits: zwei Topplichter, Seitenlichter, Hecklicht, kein Schlepplicht. Bei erheblicher Manövrierbehinderung zusätzlich rot-weiß-rot bzw. Ball-Rhombus-Ball (Regel 27 c).',
      'Pushing ahead or towing alongside: two masthead lights, sidelights, sternlight, no towing light. When severely restricted in her ability to deviate from her course, additionally red–white–red or ball–diamond–ball (Rule 27 c).')}</p>`));
  teile.push(`<h2 id="${ank('segel')}">${t('Segelfahrzeug', 'Sailing vessel')}</h2>`);
  teile.push(F('sail_std', t('Segelfahrzeug in Fahrt', 'Sailing vessel under way'), t('KVR Regel 25 a, c', 'COLREGs Rule 25 a, c'),
    [`${lc('G', t('Seitenlichter', 'sidelights'))} ${t('und', 'and')} ${lc('W', t('Hecklicht', 'sternlight'))}`,
      `${t('zusätzlich erlaubt: an oder nahe der Mastspitze', 'may in addition show at or near the top of the mast')} ${lc('R', t('rot', 'red'))} ${t('über', 'over')} ${lc('G', t('grün', 'green'))} ${t('als Rundumlichter, aber nicht zusammen mit der Dreifarbenlaterne', 'all-round lights, but not together with the combined lantern')}`],
    t('Segelt das Fahrzeug und läuft gleichzeitig die Maschine: Kegel, Spitze unten, im Vorschiff.', 'Proceeding under sail and also propelled by machinery: a cone, apex downwards, forward.'),
    ['cone_down'], t('Kegel Spitze unten', 'Cone apex down'),
    `<p class="kp-small">${t('Unter Maschine gilt ein Segelfahrzeug als Maschinenfahrzeug (Regel 3 c) und führt dessen Lichter.', 'Under engine a sailing vessel counts as a power-driven vessel (Rule 3 c) and shows its lights.')}</p>`));
  teile.push(F('sail_tri', t('Segelfahrzeug unter 20 m', 'Sailing vessel under 20 m'), t('KVR Regel 25 b, d', 'COLREGs Rule 25 b, d'),
    [`${lc('W', t('Dreifarbenlaterne', 'tricolour lantern'))} ${t('an oder nahe der Mastspitze statt Seiten- und Hecklicht', 'at or near the top of the mast in lieu of sidelights and sternlight')}`,
      t('unter 7 m: wenn möglich wie oben, sonst weiße Lampe zur Hand und rechtzeitig zeigen', 'under 7 m: if practicable as above, otherwise a white torch ready at hand, shown in time to prevent collision')],
    t('wie oben', 'as above'), ['cone_down'], t('Kegel Spitze unten', 'Cone apex down')));
  teile.push(`<h2 id="${ank('fischer')}">${t('Fischereifahrzeug', 'Fishing vessel')}</h2>`);
  teile.push(F('trawler', t('Trawler (Schleppnetz)', 'Vessel engaged in trawling'), t('KVR Regel 26 b', 'COLREGs Rule 26 b'),
    [`${lc('G', t('grün', 'green'))} ${t('über', 'over')} ${lc('W', t('weiß', 'white'))} ${t('als Rundumlichter', 'all-round lights')}`,
      lc('W', t('Topplicht achterlicher und höher als grün: Pflicht ab 50 m', 'masthead light abaft of and higher than the green light: obligatory from 50 m')),
      t('Fahrt durchs Wasser: zusätzlich Seitenlichter und Hecklicht', 'making way through the water: also sidelights and sternlight')],
    t('Zwei Kegel mit den Spitzen zueinander (Stundenglas).', 'Two cones with their apexes together (hourglass).'), ['hourglass'], t('Stundenglas', 'Hourglass')));
  teile.push(F('fisher', t('Fischendes Fahrzeug, nicht trawlend', 'Fishing vessel, not trawling'), t('KVR Regel 26 c', 'COLREGs Rule 26 c'),
    [`${lc('R', t('rot', 'red'))} ${t('über', 'over')} ${lc('W', t('weiß', 'white'))} ${t('als Rundumlichter', 'all-round lights')}`,
      `${t('Fanggerät waagrecht mehr als 150 m:', 'outlying gear extending more than 150 m horizontally:')} ${lc('W', t('weißes Rundumlicht in Richtung des Geräts', 'an all-round white light in the direction of the gear'))}`,
      t('Fahrt durchs Wasser: zusätzlich Seitenlichter und Hecklicht', 'making way through the water: also sidelights and sternlight')],
    t('Stundenglas; bei Gerät über 150 m zusätzlich ein Kegel, Spitze oben, in Richtung des Geräts.', 'Hourglass; with gear over 150 m also a cone, apex upwards, in the direction of the gear.'),
    ['hourglass', 'cone_up'], t('Stundenglas und Kegel Spitze oben', 'Hourglass and cone apex up')));
  teile.push(`<h2 id="${ank('behindert')}">${t('Manövrierunfähig und manövrierbehindert', 'Not under command and restricted in ability to manoeuvre')}</h2>`);
  teile.push(F('nuc', t('Manövrierunfähig', 'Not under command'), t('KVR Regel 27 a', 'COLREGs Rule 27 a'),
    [`${lc('R', t('zwei rote Rundumlichter', 'two all-round red lights'))} ${t('senkrecht übereinander', 'in a vertical line')}`,
      t('Fahrt durchs Wasser: zusätzlich Seitenlichter und Hecklicht, aber kein Topplicht', 'making way through the water: also sidelights and sternlight, but no masthead light')],
    t('Zwei Bälle senkrecht übereinander.', 'Two balls in a vertical line.'), ['ball', 'ball'], t('zwei Bälle', 'Two balls')));
  teile.push(F('ram', t('Manövrierbehindert', 'Restricted in ability to manoeuvre'), t('KVR Regel 27 b', 'COLREGs Rule 27 b'),
    [`${lc('R', t('rot', 'red'))}, ${lc('W', t('weiß', 'white'))}, ${lc('R', t('rot', 'red'))} ${t('als Rundumlichter senkrecht', 'all-round lights in a vertical line')}`,
      t('Fahrt durchs Wasser: zusätzlich Topplicht(er), Seitenlichter, Hecklicht', 'making way through the water: also masthead light(s), sidelights, sternlight'),
      t('vor Anker: zusätzlich die Ankerlichter', 'at anchor: also the anchor lights')],
    t('Ball, Rhombus, Ball senkrecht übereinander.', 'Ball, diamond, ball in a vertical line.'), ['ball', 'diamond', 'ball'], t('Ball Rhombus Ball', 'Ball diamond ball'),
    `<p class="kp-small">${t('Baggert oder arbeitet das Fahrzeug unter Wasser und besteht eine Behinderung: zwei rote Rundumlichter bzw. zwei Bälle an der gesperrten Seite, zwei grüne bzw. zwei Rhomben an der Passierseite (27 d). Unter 12 m Länge sind die Signale dieser Regel nicht Pflicht, außer bei Taucherarbeiten.',
      'Dredging or underwater operations with an obstruction: two all-round red lights or two balls on the side of the obstruction, two all-round green lights or two diamonds on the side where another vessel may pass (27 d). Vessels under 12 m need not show the signals of this rule, except when engaged in diving operations.')}</p>`));
  teile.push(`<h2 id="${ank('sonder')}">${t('Taucher, Lotse, Einsatz- und Sonderfahrzeuge', 'Diving, pilot, service and special vessels')}</h2>`);
  teile.push(F('diver', t('Taucherarbeiten, kleines Fahrzeug', 'Diving operations, small vessel'), t('KVR Regel 27 e', 'COLREGs Rule 27 e'),
    [`${lc('R', t('rot', 'red'))}, ${lc('W', t('weiß', 'white'))}, ${lc('R', t('rot', 'red'))} ${t('als Rundumlichter senkrecht', 'all-round lights in a vertical line')}`],
    t('Flagge A als feste Tafel, mindestens 1 m hoch, rundum sichtbar.', 'A rigid replica of Code flag A, not less than 1 m in height, visible all round.'), ['flagA'], t('Flagge A als Tafel', 'Flag A as a rigid board')));
  teile.push(F('pilot', t('Lotsenfahrzeug im Lotsdienst', 'Pilot vessel on pilotage duty'), t('KVR Regel 29', 'COLREGs Rule 29'),
    [`${lc('W', t('weiß', 'white'))} ${t('über', 'over')} ${lc('R', t('rot', 'red'))} ${t('als Rundumlichter an oder nahe dem Masttopp', 'all-round lights at or near the masthead')}`,
      t('in Fahrt zusätzlich Seitenlichter und Hecklicht', 'under way: also sidelights and sternlight'),
      t('vor Anker zusätzlich die Ankerlichter', 'at anchor: also the anchor lights')],
    t('Die KVR schreiben für Lotsenfahrzeuge keinen Signalkörper vor.', 'The COLREGs prescribe no shape for pilot vessels.'), [], ''));
  teile.push(F('mines', t('Minenräumer', 'Mine-clearance vessel'), t('KVR Regel 27 f', 'COLREGs Rule 27 f'),
    [t('Lichter eines Maschinenfahrzeugs', 'lights of a power-driven vessel'),
      `${lc('G', t('drei grüne Rundumlichter', 'three all-round green lights'))}${t(': eines nahe dem Vormasttopp, je eines an den Enden der vorderen Rah', ': one near the foremast head, one at each end of the fore yard')}`,
      t('Annäherung auf weniger als 1000 m gefährlich', 'dangerous to approach within 1000 m')],
    t('Drei Bälle, angeordnet wie die grünen Lichter.', 'Three balls, arranged like the green lights.'), ['ball', 'ball', 'ball'], t('drei Bälle', 'Three balls')));
  teile.push(F('draught', t('Tiefgangbehindert', 'Constrained by her draught'), t('KVR Regel 28', 'COLREGs Rule 28'),
    [t('Lichter eines Maschinenfahrzeugs', 'lights of a power-driven vessel'),
      `${t('zusätzlich erlaubt:', 'may in addition show')} ${lc('R', t('drei rote Rundumlichter', 'three all-round red lights'))} ${t('senkrecht übereinander', 'in a vertical line')}`],
    t('Ein Zylinder.', 'A cylinder.'), ['cyl'], t('Zylinder', 'Cylinder')));
  teile.push(F('police', t('Einsatzfahrzeug (Behörde)', 'Public service vessel (authority)'), t('SeeSchStrO Anl. II Nr. 1 (DE)', 'German SeeSchStrO Annex II no. 1'),
    [t('Positionslichter nach Länge und Antrieb', 'navigation lights according to length and propulsion'),
      `${lc('Bu', t('dauerndes blaues Funkellicht', 'a continuous blue flashing light'))} ${t('bei polizeilichen Aufgaben, wenn dadurch die Sicherheit des Verkehrs gefährdet wird; ebenso DGzRS-Rettungseinsätze', 'when carrying out police duties that affect the safety of traffic; likewise German lifeboats (DGzRS) on rescue missions')}`],
    t('Kein Signalkörper vorgeschrieben.', 'No shape prescribed.'), [], '',
    `<p class="kp-small">${t('Das blaue Funkellicht ist keine KVR-Regel, sondern nationales Recht, hier nach der deutschen Seeschifffahrtsstraßen-Ordnung. In anderen Revieren gelten die dortigen Vorschriften.',
      'The blue flashing light is not a COLREGs rule but national law, here the German Seeschifffahrtsstraßen-Ordnung. Other waters have their own regulations.')}</p>`));
  teile.push(`<h2 id="${ank('anker')}">${t('Ankerlieger und Grundsitzer', 'At anchor and aground')}</h2>`);
  teile.push(F('anchor', t('Fahrzeug vor Anker', 'Vessel at anchor'), t('KVR Regel 30 a, b', 'COLREGs Rule 30 a, b'),
    [lc('W', t('weißes Rundumlicht im Vorschiff', 'all-round white light in the fore part')),
      lc('W', t('weißes Rundumlicht am Heck, niedriger als das vordere', 'all-round white light at or near the stern, lower than the forward one')),
      t('unter 50 m: ein weißes Rundumlicht genügt', 'under 50 m: one all-round white light is enough'),
      t('ab 100 m: Decksbeleuchtung Pflicht', '100 m and more: working lights must illuminate the decks')],
    t('Ein Ball im Vorschiff.', 'One ball in the fore part.'), ['ball'], t('ein Ball', 'One ball'),
    `<p class="kp-small">${t('Unter 7 m außerhalb von Fahrwassern, Reeden und üblichen Fahrtwegen: keine Ankerlichter und kein Ball nötig.',
      'Under 7 m, when not in or near a narrow channel, fairway, anchorage or where other vessels normally navigate: no anchor light or ball required.')}</p>`));
  teile.push(F('aground', t('Fahrzeug auf Grund', 'Vessel aground'), t('KVR Regel 30 d', 'COLREGs Rule 30 d'),
    [t('Ankerlichter wie oben', 'anchor lights as above'), `${lc('R', t('zusätzlich zwei rote Rundumlichter', 'and two all-round red lights'))} ${t('senkrecht übereinander', 'in a vertical line')}`],
    t('Drei Bälle senkrecht übereinander.', 'Three balls in a vertical line.'), ['ball', 'ball', 'ball'], t('drei Bälle', 'Three balls'),
    `<p class="kp-small">${t('Unter 12 m: die zusätzlichen roten Lichter und die Bälle sind nicht Pflicht.', 'Under 12 m: the additional red lights and the balls are not required.')}</p>`));

  const sub = [['maschine', t('Maschine', 'Power')], ['schlepp', t('Schlepper', 'Towing')], ['segel', t('Segel', 'Sail')], ['fischer', t('Fischer', 'Fishing')],
    ['behindert', 'NUC / RAM'], ['sonder', t('Taucher · Lotse · Sonder', 'Diving · pilot · special')], ['anker', t('Anker · Grund', 'Anchor · aground')]];
  return `
<p class="kp-lede">${t(
    'Lichter von Sonnenuntergang bis Sonnenaufgang und bei verminderter Sicht, Signalkörper am Tag. Jedes Nachtbild ist eine eigene isometrische Zeichnung, Blickrichtung von Steuerbord voraus; gezeigt wird die Anordnung aller Lichter des Fahrzeugtyps.',
    'Lights from sunset to sunrise and in restricted visibility, shapes by day. Each night picture is an isometric drawing seen from the starboard bow; it shows where all the lights of that type of vessel are placed.')}</p>
<nav class="kp-subnav" aria-label="${t('Fahrzeugarten', 'Vessel types')}">${sub.map(([a, ti]) => `<button type="button" class="kp-chip" data-anker="${ank(a!)}">${ti}</button>`).join('')}</nav>
${teile.join('\n')}
${sprache === 'en' ? quelle(sprache, 'colregs', 'kvr_text', 'seeschstro') : quelle(sprache, 'kvr', 'kvr_text', 'seeschstro')}`;
}

export function schallsignale(sprache: Sprache): string {
  const t = tFuer(sprache);
  const nebel: [string, string, string, string][] = sprache === 'en' ? [
    ['-', 'Power-driven vessel making way through the water', 'one prolonged blast at intervals of not more than 2 min', '35 a'],
    ['-|-', 'Power-driven vessel under way but stopped and making no way', 'two prolonged blasts about 2 s apart, at intervals of not more than 2 min', '35 b'],
    ['-..', 'Vessel not under command, restricted in ability to manoeuvre, constrained by draught, sailing, fishing, towing or pushing', 'one prolonged followed by two short blasts, at intervals of not more than 2 min', '35 c'],
    ['-..', 'Fishing vessel at anchor; vessel restricted in ability to manoeuvre carrying out her work at anchor', 'the signal of 35 c instead of the bell', '35 d'],
    ['-...', 'Vessel towed (or the last of the tow), if manned', "one prolonged and three short blasts, immediately after the towing vessel's signal", '35 e'],
    ['b', 'At anchor', 'bell rung rapidly for about 5 s at intervals of not more than 1 min; 100 m and more: bell forward, then gong aft', '35 g'],
    ['.-.', 'At anchor, may in addition', 'one short, one prolonged, one short blast to warn an approaching vessel', '35 g'],
    ['s|b|s', 'Aground', 'three separate and distinct strokes on the bell before and after the rapid ringing', '35 h'],
    ['....', 'Pilot vessel on pilotage duty, may in addition', 'an identity signal of four short blasts', '35 k'],
  ] : [
    ['-', 'Maschinenfahrzeug mit Fahrt durchs Wasser', 'alle 2 min ein langer Ton', '35 a'],
    ['-|-', 'Maschinenfahrzeug in Fahrt, gestoppt, ohne Fahrt durchs Wasser', 'alle 2 min zwei lange Töne, ~2 s Abstand', '35 b'],
    ['-..', 'Segelfahrzeug, Fischer, manövrierunfähig, manövrierbehindert, tiefgangbehindert, Schlepper/Schieber', 'alle 2 min lang, kurz, kurz', '35 c'],
    ['-...', 'Geschlepptes Fahrzeug (letztes im Verband), wenn bemannt', 'alle 2 min lang, kurz, kurz, kurz, direkt nach dem Schlepper', '35 e'],
    ['-..', 'Fischendes Fahrzeug vor Anker; manövrierbehindertes Fahrzeug, das bei seiner Arbeit vor Anker liegt', 'statt der Glocke alle 2 min lang, kurz, kurz', '35 d'],
    ['b', 'Vor Anker', 'jede Minute ~5 s rasch die Glocke; ab 100 m vorn Glocke, achtern Gong', '35 g'],
    ['.-.', 'Vor Anker, zusätzlich erlaubt', 'kurz, lang, kurz als Warnung an Annähernde', '35 g'],
    ['s|b|s', 'Auf Grund', '3 Glockenschläge, rasches Läuten, 3 Glockenschläge', '35 h'],
    ['....', 'Lotsenfahrzeug im Dienst, zusätzlich erlaubt', 'vier kurze Töne als Erkennungssignal', '35 k'],
  ];
  const manoever: [string, string, string][] = sprache === 'en' ? [
    ['.', 'I am altering my course to starboard', '34 a'], ['..', 'I am altering my course to port', '34 a'],
    ['...', 'I am operating astern propulsion', '34 a'],
    ['--.', 'I intend to overtake you on your starboard side (narrow channel)', '34 c'],
    ['--..', 'I intend to overtake you on your port side (narrow channel)', '34 c'],
    ['-.-.', 'Agreement of the vessel about to be overtaken', '34 c'],
    ['.....', 'Doubt or warning: intentions or actions not understood, or action insufficient, at least five short and rapid blasts', '34 d'],
    ['-', 'Nearing a bend or an area where vessels may be obscured; answered with one prolonged blast', '34 e'],
  ] : [
    ['.', 'Ich ändere meinen Kurs nach Steuerbord', '34 a'], ['..', 'Ich ändere meinen Kurs nach Backbord', '34 a'],
    ['...', 'Ich arbeite rückwärts', '34 a'],
    ['--.', 'Ich beabsichtige, Sie an Ihrer Steuerbordseite zu überholen (enges Fahrwasser)', '34 c'],
    ['--..', 'Ich beabsichtige, Sie an Ihrer Backbordseite zu überholen (enges Fahrwasser)', '34 c'],
    ['-.-.', 'Zustimmung des zu Überholenden', '34 c'],
    ['.....', 'Zweifel- oder Warnsignal: Absicht nicht verstanden oder Manöver nicht ausreichend, mindestens fünf kurze, rasche Töne', '34 d'],
    ['-', 'Annäherung an Krümmung oder Sichthindernis; Antwort ebenfalls ein langer Ton', '34 e'],
  ];
  const R = t('R', 'R');
  const nz = nebel.map(([p, w, m, r]) => `<tr><td class="kp-sig">${schall(p, sprache)}</td><td><b>${esc(w)}</b><br><span class="kp-small">${esc(m)}</span></td><td class="kp-num">${R} ${r}</td></tr>`).join('');
  const mz = manoever.map(([p, x, r]) => `<tr><td class="kp-sig">${schall(p, sprache)}</td><td>${esc(x)}</td><td class="kp-num">${R} ${r}</td></tr>`).join('');
  return `
<h2>${t('Schallsignale bei verminderter Sicht', 'Sound signals in restricted visibility')}</h2>
<p class="kp-lede">${t(
    'Am Tag und bei Nacht, in oder nahe einem Gebiet mit verminderter Sicht. Kurzer Ton: etwa 1 Sekunde. Langer Ton: 4 bis 6 Sekunden. Fahrzeuge unter 12 m müssen diese Signale nicht geben, dann aber mindestens alle 2 Minuten ein anderes kräftiges Schallsignal.',
    'By day or night, in or near an area of restricted visibility. Short blast: about one second. Prolonged blast: four to six seconds. Vessels under 12 m need not give these signals but must then make some other efficient sound signal at intervals of not more than 2 minutes.')}</p>
<div class="kp-legende">${schall('-', sprache)}<span>${t('langer Ton', 'prolonged blast')}</span>${schall('.', sprache)}<span>${t('kurzer Ton', 'short blast')}</span></div>
<div class="kp-tw"><table class="kp-data kp-schalltab"><thead><tr><th>${t('Signal', 'Signal')}</th><th>${t('Fahrzeug', 'Vessel')}</th><th>${t('Regel', 'Rule')}</th></tr></thead><tbody>${nz}</tbody></table></div>
<h2>${t('Manöver- und Warnsignale', 'Manoeuvring and warning signals')}</h2>
<p class="kp-lede">${t(
    'Nur für Fahrzeuge, die einander in Sicht haben. Die Manöversignale a gibt ein Maschinenfahrzeug in Fahrt; sie dürfen durch Lichtblitze gleicher Zahl ergänzt werden (Blitz etwa 1 s, Pause etwa 1 s, mindestens 10 s zwischen den Signalen).',
    'Only for vessels in sight of one another. The manoeuvring signals in (a) are given by a power-driven vessel under way; they may be supplemented by the same number of light flashes (flash about 1 s, interval about 1 s, at least 10 s between signals).')}</p>
<div class="kp-tw"><table class="kp-data kp-schalltab"><thead><tr><th>${t('Signal', 'Signal')}</th><th>${t('Bedeutung', 'Meaning')}</th><th>${t('Regel', 'Rule')}</th></tr></thead><tbody>${mz}</tbody></table></div>
${sprache === 'en' ? quelle(sprache, 'colregs', 'kvr_text') : quelle(sprache, 'kvr', 'kvr_text')}`;
}

function ico(inhalt: string, label: string): string {
  return `<svg class="kp-ico" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${esc(label)}">${inhalt}</svg>`;
}

export function notsignale(sprache: Sprache): string {
  const t = tFuer(sprache);
  const stern = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${NOT.rot}"/>`;
  const I = 'var(--text)';
  const ikonen: Record<string, string> = {
    knall: ico(`<path d="M24 6 L28 18 L40 14 L32 24 L42 32 L29 31 L24 43 L19 31 L6 32 L16 24 L8 14 L20 18 Z" fill="none" stroke="${I}" stroke-width="2"/>`, t('Knallsignal', 'Explosive signal')),
    horn: ico(`<path d="M8 20 H16 L32 10 V38 L16 28 H8 Z" fill="${I}"/><path d="M36 16 Q42 24 36 32 M40 12 Q48 24 40 36" fill="none" stroke="${I}" stroke-width="2"/>`, t('Nebelsignal', 'Fog-signalling apparatus')),
    rakete: ico(stern(24, 12, 5) + stern(14, 18, 3.5) + stern(34, 18, 3.5) + '<line x1="24" y1="46" x2="24" y2="22" stroke="var(--muted)" stroke-width="2" stroke-dasharray="2 3"/>', t('Rakete mit roten Sternen', 'Rocket throwing red stars')),
    sos: ico(`<text x="24" y="20" text-anchor="middle" class="kp-ico-t">SOS</text><g fill="${I}"><rect x="2" y="28" width="4" height="4" rx="2"/><rect x="8" y="28" width="4" height="4" rx="2"/><rect x="14" y="28" width="4" height="4" rx="2"/><rect x="20" y="28" width="10" height="4" rx="2"/><rect x="31" y="28" width="10" height="4" rx="2"/><rect x="42" y="28" width="4" height="4" rx="2"/></g>`, 'SOS'),
    mayday: ico('<text x="24" y="28" text-anchor="middle" class="kp-ico-t kp-ico-sm">MAYDAY</text>', 'Mayday'),
    nc: `<svg class="kp-ico kp-fach" viewBox="-2 -2 64 86" width="40" height="54" role="img" aria-label="${t('N über C', 'N over C')}">${flaggeEingebettet('N', 0, 0)}${flaggeEingebettet('C', 0, 42)}</svg>`,
    ballflag: ico(`<line x1="8" y1="4" x2="8" y2="46" stroke="${I}" stroke-width="2"/><rect x="9" y="6" width="22" height="22" fill="${I}"/><circle cx="20" cy="38" r="7" fill="${I}"/>`, t('Viereckige Flagge mit Ball', 'Square flag with a ball')),
    flamme: ico(`<path d="M24 6 C30 16 36 20 34 30 C33 38 28 42 24 42 C18 42 13 37 14 29 C15 22 20 20 20 12 C23 16 24 18 24 6 Z" fill="${NOT.orange}"/><rect x="12" y="40" width="24" height="6" fill="${I}"/>`, t('Flammensignal', 'Flames on the vessel')),
    fackel: ico(`<path d="M24 4 C29 10 30 14 28 20 L20 20 C18 14 19 10 24 4 Z" fill="${NOT.rot}"/><rect x="21" y="20" width="6" height="24" rx="2" fill="${I}"/>`, t('Rote Handfackel oder Fallschirm-Leuchtrakete', 'Red hand flare or parachute rocket')),
    rauch: ico(`<circle cx="18" cy="22" r="9" fill="${NOT.orange}" opacity=".85"/><circle cx="29" cy="16" r="8" fill="${NOT.orange}" opacity=".7"/><circle cx="32" cy="28" r="7" fill="${NOT.orange}" opacity=".6"/><rect x="14" y="34" width="8" height="10" rx="1" fill="${I}"/>`, t('Orangefarbener Rauch', 'Orange smoke')),
    arme: ico(`<circle cx="24" cy="12" r="5" fill="${I}"/><line x1="24" y1="17" x2="24" y2="34" stroke="${I}" stroke-width="3"/><path d="M6 14 L24 22 L42 14" fill="none" stroke="${I}" stroke-width="3"/><path d="M6 28 L24 22 L42 28" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="2 2"/><line x1="24" y1="34" x2="18" y2="46" stroke="${I}" stroke-width="3"/><line x1="24" y1="34" x2="30" y2="46" stroke="${I}" stroke-width="3"/>`, t('Arme heben und senken', 'Raising and lowering arms')),
    funk: ico(`<path d="M24 22 V44" stroke="${I}" stroke-width="3"/><path d="M14 14 Q24 4 34 14 M9 9 Q24 -6 39 9" fill="none" stroke="${I}" stroke-width="2"/><circle cx="24" cy="20" r="3" fill="${I}"/>`, t('Funksignal', 'Radio signals')),
  };
  const punkte: [string, string, string, string][] = [
    ['knall', 'a', 'Kanonenschüsse oder andere Knallsignale in Abständen von etwa einer Minute', 'A gun or other explosive signal fired at intervals of about a minute'],
    ['horn', 'b', 'Anhaltendes Ertönen eines Nebelsignalgeräts', 'A continuous sounding with any fog-signalling apparatus'],
    ['rakete', 'c', 'Raketen oder Leuchtkugeln mit roten Sternen, einzeln oder in kurzen Abständen', 'Rockets or shells, throwing red stars fired one at a time at short intervals'],
    ['sos', 'd', 'Morsesignal ··· – – – ··· (SOS), durch eine beliebige Signalart gegeben', 'A signal made by any signalling method consisting of the group ··· – – – ··· (SOS) in the Morse Code'],
    ['mayday', 'e', 'Sprechfunksignal „Mayday“', 'A signal sent by radiotelephony consisting of the spoken word “Mayday”'],
    ['nc', 'f', 'Notzeichen NC des Internationalen Signalbuchs', 'The International Code Signal of distress indicated by N.C.'],
    ['ballflag', 'g', 'Viereckige Flagge, darüber oder darunter ein Ball oder etwas Ballähnliches', 'A signal consisting of a square flag having above or below it a ball or anything resembling a ball'],
    ['flamme', 'h', 'Flammensignale auf dem Fahrzeug, z. B. brennende Teer- oder Öltonne', 'Flames on the vessel (as from a burning tar barrel, oil barrel, etc.)'],
    ['fackel', 'i', 'Rote Fallschirm-Leuchtrakete oder rote Handfackel', 'A rocket parachute flare or a hand flare showing a red light'],
    ['rauch', 'j', 'Rauchsignal mit orangefarbenem Rauch', 'A smoke signal giving off orange-coloured smoke'],
    ['arme', 'k', 'Langsames, wiederholtes Heben und Senken der seitlich ausgestreckten Arme', 'Slowly and repeatedly raising and lowering arms outstretched to each side'],
    ['funk', 'l–o', 'Notalarm über DSC (UKW-Kanal 70 oder Grenz- und Kurzwelle), Notalarm Schiff-Land über Inmarsat oder einen anderen Satellitendienst, Funksignale einer Seenotfunkboje (EPIRB) und zugelassene Signale über Funksysteme einschließlich Radartransponder (SART)',
      'Distress alert by digital selective calling (DSC), Inmarsat or other mobile satellite service, signals transmitted by emergency position-indicating radio beacons (EPIRB) and approved signals including survival craft radar transponders (SART)'],
  ];
  const zellen = punkte.map(([k2, l, de, en]) => `<div class="kp-not"><div class="kp-not-ico${['rakete', 'flamme', 'fackel', 'rauch'].includes(k2) ? ' kp-fach' : ''}">${ikonen[k2]}</div><div><span class="kp-code">${l}</span> ${esc(t(de, en))}</div></div>`).join('');
  return `
<h2>${t('Notzeichen', 'Distress signals')}</h2>
<p class="kp-lede">${t(
    'Diese Signale, einzeln oder zusammen, bedeuten Not und die Notwendigkeit von Hilfe (KVR Anlage IV). Sie dürfen nur in diesem Fall gezeigt werden; Signale, die damit verwechselt werden können, sind verboten.',
    'These signals, used or exhibited either together or separately, indicate distress and need of assistance (COLREGs Annex IV). Their use for any other purpose, and the use of signals which may be confused with them, is prohibited.')}</p>
<div class="kp-raster kp-raster-260 kp-notraster">${zellen}</div>
<h3>${t('Zur Kenntlichmachung', 'Attracting attention from the air')}</h3>
<p>${t('Anlage IV verweist zusätzlich auf ein Stück orangefarbenes Segeltuch mit schwarzem Quadrat oder Kreis zur Erkennung aus der Luft und auf Seewasserfärber.',
    'Annex IV also draws attention to a piece of orange-coloured canvas with a black square and circle or other appropriate symbol, and to a dye marker.')}</p>
<p class="kp-note">${t('Die Buchstaben entsprechen der Aufzählung in Anlage IV Nr. 1.', 'The letters follow the list in Annex IV, paragraph 1. Wording abridged in places.')}</p>
<p><button type="button" class="btn kp-sprung" data-sprung="funkspruch">${t('Notruf per Funk: Funkspruch-Vorlage öffnen', 'Distress call by radio: open the radio message template')}</button></p>
${sprache === 'en' ? quelle(sprache, 'colregs', 'pub102') : quelle(sprache, 'kvr', 'kvr_text', 'pub102')}`;
}
