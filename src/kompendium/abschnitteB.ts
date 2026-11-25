import { buchstaben, ZIFFERN, kombinationen } from './daten';
import { tFuer, quelle } from './bausteine';
import { esc, k, aufKreis, pfeile } from './svg';
import { flagge, flaggeEingebettet } from './flaggen';
import { tonne, type Band, type Toppzeichen } from './tonnen';
import { zeitleiste, wiederhole, morse, type Takt } from './kennung';
import { weltkarte } from './karte';
import { FLAGGE, TONNE } from './farben';
import { imSektor, SICHERE_SEKTOREN, type Kardinal } from '@/core/kompendium';
import type { Sprache } from '@/core/types';

export const LAND = 'color-mix(in srgb, var(--text) 22%, var(--panel-2))';

export function signalflaggen(sprache: Sprache): string {
  const t = tFuer(sprache);
  const stern = `<span class="kp-stern" title="${t('Als Schallsignal nur nach den KVR', 'By sound only in compliance with the COLREGs')}">*</span>`;
  const zeilen = buchstaben(sprache).map((b) => `<tr>
<td class="kp-fl">${flagge(b.code, 54, `${t('Signalflagge', 'Signal flag')} ${b.code} (${b.wort})`)}</td>
<td class="kp-bst"><b class="kp-ltr">${b.code}</b><span class="kp-nato">${b.wort}</span><span class="kp-pron">${b.aussprache}</span></td>
<td class="kp-mo">${morse(b.morse)}<span class="kp-mtxt">${b.morse}</span></td>
<td class="kp-bed">${esc(b.bedeutung)}${b.nurKvr ? ` ${stern}` : ''}</td></tr>`).join('');
  const zahlen = ZIFFERN.map((z) => `<div class="kp-numc">${flagge(z.code, 64, `${t('Zahlenwimpel', 'Numeral pennant')} ${z.code}`)}`
    + `<b>${z.code}</b><span class="kp-pron">${z.wort}</span><span class="kp-mo">${morse(z.morse)}</span></div>`).join('');
  const hilfs: [string, string][] = [['SUB1', t('1. Hilfsstander', '1st substitute')], ['SUB2', t('2. Hilfsstander', '2nd substitute')],
    ['SUB3', t('3. Hilfsstander', '3rd substitute')], ['ANS', t('Antwortwimpel', 'Answering pennant')]];
  const subs = hilfs.map(([c, l]) => `<div class="kp-numc">${flagge(c, 64, l)}<b>${l}</b></div>`).join('');
  return `
<h2>${t('Buchstabenflaggen A–Z', 'Alphabet flags A–Z')}</h2>
<p class="kp-lede">${t(
    'Einbuchstabensignale für sehr dringende oder häufige Mitteilungen. Jedes Signal hat eine vollständige Bedeutung. Mit * markierte Signale dürfen als Schallsignal nur nach den Kollisionsverhütungsregeln gegeben werden.',
    'Single-letter signals are allocated to significations which are very urgent, important or of very common use. Each signal has a complete meaning. Signals marked * may be made by sound only in compliance with the COLREGs.')}</p>
<table class="kp-data kp-flaggen">
<thead><tr><th>${t('Flagge', 'Flag')}</th><th>${t('Buchstabe · Aussprache', 'Letter · pronunciation')}</th><th>Morse</th><th>${t('Bedeutung als Einzelflagge', 'Meaning as a single flag')}</th></tr></thead>
<tbody>${zeilen}</tbody></table>
<p class="kp-note">${t(
    'Aussprache nach der Buchstabiertafel des Signalbuchs (betonte Silben dort fett), Zahlen nach der Ziffern-Buchstabiertafel. Bedeutungen übersetzt aus der englischen Ausgabe; die amtliche deutsche Fassung ist das „Internationale Signalbuch“ des BSH.',
    'Meanings and pronunciation as in the Code (emphasised syllables are set in bold there); numerals from the figure spelling table.')}</p>
<h2>${t('Zahlenwimpel 1–0', 'Numeral pennants 1–0')}</h2>
<div class="kp-numgrid">${zahlen}</div>
<h3>${t('Hilfsstander und Antwortwimpel', 'Substitutes and answering pennant')}</h3>
<div class="kp-numgrid">${subs}</div>
<p class="kp-note">${t(
    'Ein Hilfsstander wiederholt die erste, zweite oder dritte Flagge seiner Flaggenart von oben, falls nur ein Satz an Bord ist. Der Antwortwimpel bestätigt empfangene Signale und dient in Zahlen als Dezimalkomma.',
    'A substitute repeats the first, second or third flag of its class counted from the top, so that one set of flags is enough. The answering pennant acknowledges signals and serves as the decimal point in numbers.')}</p>
${quelle(sprache, 'pub102', 'wiki_flags')}`;
}

export function flaggenkombinationen(sprache: Sprache): string {
  const t = tFuer(sprache);
  const ueber = t('über', 'over');
  const kk = kombinationen(sprache).map((c) => `<div class="kp-combo">`
    + `<svg class="kp-hoist kp-fach" viewBox="-6 -4 74 96" width="74" role="img" aria-label="${t('Flagge', 'Flag')} ${c.oben} ${ueber} ${t('Flagge', 'flag')} ${c.unten}">`
    + `<line x1="-2" y1="-4" x2="-2" y2="92" stroke="var(--muted)" stroke-width="1.6"/>${flaggeEingebettet(c.oben, 0, 0)}${flaggeEingebettet(c.unten, 0, 46)}</svg>`
    + `<div><h3><span class="kp-code">${c.code}</span> ${c.oben} ${ueber} ${c.unten}</h3><p class="kp-mean">${esc(c.bedeutung)}</p>`
    + `<p class="kp-small">${esc(c.hinweis)}</p></div></div>`).join('');
  return `
<h2>${t('Zweiflaggensignale', 'Two-flag signals')}</h2>
<p class="kp-lede">${t('Die obere Flagge wird zuerst gelesen. Zweibuchstabensignale stammen aus dem allgemeinen Teil des Signalbuchs (Kapitel 2).',
    'The upper flag is read first. Two-letter signals come from the General Signal Code (chapter 2).')}</p>
<div class="kp-combos">${kk}</div>
<p class="kp-note">${t('Hinweis zu Q über L: Im Signalbuch bedeutet QL nicht „Quarantäne“, sondern eine Maschinenanweisung („go astern“). Die gelbe Einzelflagge Q ist das Gesundheitssignal.',
    'Q over L does not mean “quarantine”; in the Code it is an engine order (“go astern”). The single yellow flag Q is the pratique signal.')}</p>
${sprache === 'en' ? quelle(sprache, 'pub102', 'colregs') : quelle(sprache, 'pub102', 'kvr')}`;
}

const zahl = (x: number, y: number, n: number, blass = false) => `<g${blass ? ' opacity=".55"' : ''}><circle cx="${x}" cy="${y}" r="13" fill="var(--gelb)"/>`
  + `<text x="${x}" y="${y + 6}" text-anchor="middle" class="kp-zahl">${n}</text></g>`;

function yachtAchtern(sprache: Sprache): string {
  const t = tFuer(sprache);
  const { rot: R, weiss: W, blau: B } = FLAGGE;
  const I = 'var(--text)';
  const o = [
    '<rect x="-36" width="456" height="310" fill="var(--panel-2)"/>',
    '<path d="M-36 286 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="var(--muted)" stroke-width="2"/>',
    `<path d="M150 252 H270 Q266 288 210 292 Q154 288 150 252 Z" fill="${I}" opacity=".85"/>`,
    `<line x1="210" y1="252" x2="210" y2="28" stroke="${I}" stroke-width="4"/>`,
    `<line x1="150" y1="120" x2="270" y2="120" stroke="${I}" stroke-width="3"/>`,
    `<line x1="210" y1="28" x2="150" y2="120" stroke="${I}" stroke-width=".8" opacity=".5"/><line x1="210" y1="28" x2="270" y2="120" stroke="${I}" stroke-width=".8" opacity=".5"/>`,
    `<line x1="150" y1="120" x2="152" y2="252" stroke="${I}" stroke-width=".8" opacity=".5"/><line x1="270" y1="120" x2="268" y2="252" stroke="${I}" stroke-width=".8" opacity=".5"/>`,

    `<polygon points="210,20 238,26 210,32" fill="${B}"/><polygon points="214,23 228,26 214,29" fill="${W}"/>`,

    `<line x1="268" y1="120" x2="268" y2="160" stroke="var(--muted)" stroke-width="1"/><rect x="268" y="124" width="36" height="24" fill="var(--muted)" fill-opacity=".45" stroke="var(--muted)" stroke-width=".8"/>`,

    `<line x1="152" y1="120" x2="152" y2="160" stroke="var(--muted)" stroke-width="1"/><polygon points="152,124 120,131 152,138" fill="${B}" opacity=".5" stroke="var(--muted)" stroke-width=".6"/>`,

    `<line x1="210" y1="256" x2="232" y2="214" stroke="${I}" stroke-width="2.2"/>`,
    `<g transform="translate(231,214) rotate(-18)"><rect width="36" height="8" fill="${R}"/><rect y="8" width="36" height="8" fill="${W}"/><rect y="16" width="36" height="8" fill="${R}"/><rect width="36" height="24" fill="none" stroke="var(--muted)" stroke-width=".6"/></g>`,
    zahl(290, 230, 1), zahl(322, 136, 2), zahl(256, 26, 3), zahl(104, 131, 3, true),
  ];
  return `<figure class="kp-fig"><svg class="kp-zeichnung kp-fach" viewBox="-36 0 456 310" role="img" aria-label="${t('Flaggenplätze an einer Segelyacht, Ansicht von achtern', 'Flag positions on a sailing yacht, seen from astern')}">${o.join('')}</svg>
<figcaption><ol class="kp-legende-num">
<li>${t('Nationale am Heckflaggenstock', 'Ensign on the stern staff')}</li>
<li>${t('Gastlandflagge unter der Steuerbordsaling', 'Courtesy flag under the starboard spreader')}</li>
<li>${t('Vereinsstander im Masttopp; blass: unter der Backbordsaling, wenn der Topp nicht möglich ist', 'Club burgee at the masthead; faded: under the port spreader if the masthead is not possible')}</li>
</ol><p class="kp-small">${t('Ansicht von achtern · Steuerbord rechts', 'Seen from astern · starboard on the right')}</p></figcaption></figure>`;
}

function flaggengala(sprache: Sprache): string {
  const t = tFuer(sprache);
  const { rot: R, weiss: W } = FLAGGE;
  const folge = ['A', 'B', '1', 'C', 'D', '2', 'E', 'F', '3', 'G', 'H', '4', 'I', 'J', '5', 'K', 'L', '6', 'M', 'N', '7', 'O', 'P', '8', 'Q', 'R'];
  const o = [
    '<rect width="460" height="300" fill="var(--panel-2)"/>',
    '<path d="M40 258 H410 Q400 282 330 286 H120 Q60 284 40 258 Z" fill="var(--text)" opacity=".85"/>',
    '<line x1="230" y1="258" x2="230" y2="40" stroke="var(--text)" stroke-width="4"/>',
    '<line x1="60" y1="252" x2="230" y2="40" stroke="var(--muted)" stroke-width=".8"/><line x1="230" y1="40" x2="390" y2="252" stroke="var(--muted)" stroke-width=".8"/>',
    `<g transform="translate(232,14)"><rect width="30" height="6" fill="${R}"/><rect y="6" width="30" height="6" fill="${W}"/><rect y="12" width="30" height="6" fill="${R}"/><rect width="30" height="18" fill="none" stroke="var(--muted)" stroke-width=".6"/></g>`,
  ];
  folge.forEach((code, i) => {
    const s = (i + 0.5) / folge.length;
    let x: number; let y: number;
    if (s < 0.5) { const u = s / 0.5; x = 60 + 170 * u; y = 252 - 212 * u; } else { const u = (s - 0.5) / 0.5; x = 230 + 160 * u; y = 40 + 212 * u; }
    o.push(flaggeEingebettet(code, x - 7, y, 0.24));
  });
  return `<figure class="kp-fig kp-fig-breit"><svg class="kp-zeichnung kp-fach" viewBox="0 0 460 300" role="img" aria-label="${t('Flaggengala über die Toppen', 'Dressing ship overall')}">${o.join('')}</svg>
<figcaption class="kp-small">${t('Über die Toppen: zwei Flaggen, ein Wimpel, Nationale an höchster Stelle', 'Dressed overall: two flags, one pennant; ensign at the highest point')}</figcaption></figure>`;
}

export function flaggenfuehrung(sprache: Sprache): string {
  const t = tFuer(sprache);
  return `
<h2>${t('Flaggenführung an Bord', 'Flag etiquette on board')}</h2>
<p class="kp-lede">${t(
    'Die Nationale ist Rechtssache des Flaggenstaats, alles andere ist Seemannsbrauch. Wo Brauch beschrieben wird, folgt die Seite der DSV-Broschüre „Yachtgebräuche und Flaggenführung“.',
    "The ensign is a matter of the flag state's law; everything else is seamanlike custom. Where custom is described, this page follows the German Sailing Federation (DSV) brochure on yacht customs and flag etiquette; customs in other countries can differ in detail.")}</p>
<div class="kp-split">${yachtAchtern(sprache)}<div class="kp-prosa">
<h3>${t('1 · Nationalflagge', '1 · Ensign')}</h3>
<p>${t('Im Hafen, vor Anker und in Fahrt am Flaggenstock, möglichst mittig am Heck; dort weht keine andere Flagge. Unter Segel auch an der Gaffel oder an einer Flaggenleine im oberen Drittel des Großsegel-Achterlieks, auf Mehrmastern in Fahrt im Topp des hinteren Mastes. Nicht am Achterstag. Die Flagge darf das Hecklicht nicht verdecken.',
    'In harbour, at anchor and under way on the ensign staff, as close to the centre of the stern as possible; no other flag flies there. Under sail it may also fly from the gaff or from a flag halyard in the upper third of the mainsail leech; on vessels with more than one mast, under way at the head of the aftermost mast. Not on the backstay. The flag must not hide the sternlight.')}</p>
<p>${t('<b>Österreich:</b> Die Seeflagge hat drei gleich breite waagrechte Streifen rot-weiß-rot im Verhältnis 2 : 3. Sie dürfen nur österreichische Seeschiffe führen; andere Hinweise auf die österreichische Nationalität (z. B. rot-weiß-rote Wimpel oder Stander) sind unzulässig (§ 3 SeeSchFG).',
    '<b>Austria:</b> the Austrian maritime flag has three horizontal stripes of equal width, red–white–red, in the proportion 2:3. Only Austrian seagoing ships may fly it; any other indication of Austrian nationality (e.g. red–white–red pennants or burgees) is not permitted (§ 3 SeeSchFG).')}</p>
<h3>${t('2 · Gastlandflagge', '2 · Courtesy flag')}</h3>
<p>${t('Beim Einlaufen in die Küstengewässer eines Gastlandes unter der Steuerbordsaling, und zwar allein, nie die Flaggen zuvor besuchter Länder darüber oder darunter. Ausnahme Heimkehr: am Tag der Heimkehr, am folgenden Wochenende und beim Absegeln dürfen die Flaggen aller besuchten Länder untereinander wehen.',
    "When entering the coastal waters of a host country, the host country's flag flies under the starboard spreader, alone, never above or below the flags of countries visited earlier. Exception on returning home: on the day of return, the following weekend and at the end-of-season sail, the flags of all countries visited may be flown one below the other.")}</p>
<h3>${t('3 · Vereinsstander', '3 · Club burgee')}</h3>
<p>${t('Im Großtopp, Tag und Nacht, auch ohne Besatzung an Bord. Geht das nicht, an oberster Stelle unter der Backbordsaling. Dann auf See einholen, damit er nicht mit Signalflaggen verwechselt wird. Immer nur ein Stander.',
    'At the main masthead, day and night, even when nobody is on board. If that is not possible, at the top position under the port spreader, then lowered at sea so that it cannot be mistaken for a signal flag. Only one burgee at a time.')}</p>
<h3>${t('Signalflaggen', 'Signal flags')}</h3>
<p>${t('Nur nach den Regeln des Signalbuchs und sofort einholen, wenn der Signalaustausch beendet ist. Das Signalbuch verlangt, die Flaggen dort zu setzen, wo die Empfangsstation sie am besten sieht. Einzige Ausnahme vom sofortigen Einholen ist die Flaggengala.',
    'Used only according to the International Code of Signals and lowered as soon as the exchange of signals is over. The Code asks for a hoist to be made where it can be most easily seen by the receiving station. The only exception to lowering them at once is dressing ship.')}</p>
</div></div>
<div class="kp-drei">
<div><h3>${t('Flaggenparade', 'Colours')}</h3>
<p>${t('Internationaler Brauch. Flaggenzeit für alle Flaggen außer dem Stander:', 'An international custom. Flag time for all flags except the burgee:')}</p>
<table class="kp-mini"><tr><td>${t('1. Mai–30. Sept.', '1 May–30 Sept')}</td><td class="kp-num">08:00</td></tr><tr><td>${t('1. Okt.–30. April', '1 Oct–30 April')}</td><td class="kp-num">09:00</td></tr>
<tr><td>${t('Einholen', 'Lowered')}</td><td>${t('Sonnenuntergang, spätestens 2100 LT', 'sunset, at the latest 2100 LT')}</td></tr></table>
<p>${t('Den Takt geben ein Kriegsschiff im Hafen, die größte Yacht oder der Flaggenmast des Ortsvereins vor. Gesetzt wird zuerst die Nationale am Heck, eingeholt in umgekehrter Reihenfolge.',
    "The time is set by a warship in harbour, the largest yacht or the local club's flagstaff. The ensign at the stern goes up first and comes down last.")}</p></div>
<div><h3>${t('Flaggengruß', 'Dipping the ensign')}</h3>
<p>${t('Freiwillig, die Erwiderung ist Pflicht. Die grüßende Yacht holt die Nationale um ein Drittel nieder („dippen“) und heißt sie wieder vor, sobald die gegrüßte Yacht ihre niedergeholt hat. Kriegsschiffe werden immer zuerst gegrüßt; die eigene Flagge geht erst wieder hoch, wenn das Kriegsschiff seine vorgeheißt hat.',
    'Saluting is voluntary, answering a salute is obligatory. The saluting yacht lowers its ensign by one third and hoists it again once the saluted yacht has lowered hers. Warships are always saluted first; the own ensign is hoisted again only after the warship has hoisted hers.')}</p></div>
<div><h3>${t('Flaggengala', 'Dressing ship')}</h3>
<p>${t('Bei festlichen Anlässen im Hafen oder vor Anker: nur Signalflaggen, vom Bug über die Toppen zum Heck, im Wechsel zwei Buchstabenflaggen und ein Wimpel. Die Nationale an der höchsten Stelle des Schiffs.',
    'On festive occasions in harbour or at anchor: signal flags only, from the bow over the mastheads to the stern, two letter flags alternating with one pennant. The ensign at the highest point of the vessel.')}</p></div>
</div>
${flaggengala(sprache)}
${quelle(sprache, 'dsv', 'seeschfg', 'adac', 'pub102')}`;
}

type Feuer = [kurz: string, de: string, en: string, dDe: string, dEn: string, folge: Takt[], periode: number, zeige: number];

const QQ: Takt[] = [[0.5, 'W'], [0.5, null]];
const VV: Takt[] = [[0.25, 'W'], [0.25, null]];

const FEUER: Feuer[] = [
  ['F', 'Festfeuer', 'Fixed', 'Gleichmäßiges, dauerndes Licht.', 'A continuous and steady light.', [[10, 'W']], 10, 10],
  ['Oc 4s', 'Unterbrochen (Oc)', 'Occulting', 'Hellphase insgesamt länger als die Dunkelphasen.', 'Total duration of light in a period longer than the total duration of darkness.', [[3, 'W'], [1, null]], 4, 12],
  ['Oc(2) 9s', 'Gruppenunterbrochen', 'Group occulting', 'Feuer Heiligenhafen: dunkel 1, hell 2, dunkel 1, hell 5.', 'Heiligenhafen light: dark 1, light 2, dark 1, light 5.', [[1, null], [2, 'W'], [1, null], [5, 'W']], 9, 18],
  ['Iso 4s', 'Gleichtakt (Iso)', 'Isophase', 'Hell und dunkel genau gleich lang.', 'All durations of light and darkness clearly equal.', [[2, 'W'], [2, null]], 4, 12],
  ['Fl 5s', 'Blitz (Fl)', 'Flashing', 'Blitze kürzer als die Dunkelphasen, weniger als 50 pro Minute.', 'Light shorter than darkness; less than 50 flashes per minute.', [[0.5, 'W'], [4.5, null]], 5, 15],
  ['LFl 10s', 'Blink (LFl)', 'Long flashing', 'Ein Lichtschein von mindestens 2 s.', 'A flash of not less than 2 s, regularly repeated.', [[2, 'W'], [8, null]], 10, 20],
  ['Fl(3) 10s', 'Gruppenblitz', 'Group flashing', 'Gruppe einer bestimmten Zahl von Blitzen.', 'A group of a specified number of flashes.', [[0.5, 'W'], [1, null], [0.5, 'W'], [1, null], [0.5, 'W'], [6.5, null]], 10, 20],
  ['Fl(2+1) 10s', 'Zusammengesetzter Gruppenblitz', 'Composite group flashing', 'Aufeinanderfolgende Gruppen mit verschiedener Blitzzahl. Bei Tonnen der Hinweis auf das Hauptfahrwasser.', 'Successive groups with different numbers of flashes. On buoys it marks the preferred channel.', [[0.5, 'W'], [0.7, null], [0.5, 'W'], [1.6, null], [0.5, 'W'], [6.2, null]], 10, 20],
  ['Q', 'Funkel (Q)', 'Quick', '50 bis unter 80 Blitze pro Minute.', '50 to less than 80 flashes per minute.', QQ, 1, 10],
  ['Q(3) 10s', 'Gruppenfunkel', 'Group quick', 'Hier: Kardinalzeichen Ost.', 'Here: east cardinal mark.', [...wiederhole(QQ, 3), [7, null]], 10, 20],
  ['IQ 10s', 'Unterbrochenes Funkeln', 'Interrupted quick', 'Funkelfolge, regelmäßig durch lange Dunkelpausen unterbrochen.', 'Quick flashes interrupted by regularly repeated long eclipses.', [...wiederhole(QQ, 6), [4, null]], 10, 20],
  ['VQ', 'Schnelles Funkeln (VQ)', 'Very quick', '80 bis unter 160 Blitze pro Minute.', '80 to less than 160 flashes per minute.', VV, 0.5, 10],
  ['VQ(6)+LFl 10s', 'Schnelles Gruppenfunkeln mit Blink', 'Group very quick with long flash', 'Hier: Kardinalzeichen Süd.', 'Here: south cardinal mark.', [...wiederhole(VV, 6), [2, 'W'], [5, null]], 10, 20],
  ['UQ', 'Ultraschnelles Funkeln (UQ)', 'Ultra quick', '160 und mehr Blitze pro Minute.', '160 or more flashes per minute.', [[0.125, 'W'], [0.125, null]], 0.25, 10],
  ['Mo(A) 8s', 'Morse', 'Morse code', 'Lichterscheinungen zweier Längen bilden Morsezeichen, hier „A“ ·–.', 'Appearances of light of two clearly different durations form Morse characters, here “A” ·–.', [[0.5, 'W'], [0.5, null], [1.5, 'W'], [5.5, null]], 8, 16],
  ['FFl 10s', 'Fest und Blitz', 'Fixed and flashing', 'Festfeuer mit Blitzen größerer Lichtstärke.', 'A fixed light combined with a flashing light of greater intensity.', [[4.5, '*W'], [1, 'W'], [4.5, '*W']], 10, 20],
  ['Al.WR 6s', 'Wechselfeuer', 'Alternating', 'Wechselnd verschiedene Farben.', 'A light showing different colours alternately.', [[1.5, 'W'], [1.5, null], [1.5, 'R'], [1.5, null]], 6, 12],
];

export function leuchtfeuer(sprache: Sprache): string {
  const t = tFuer(sprache);
  const zeilen = FEUER.map(([a, de, en, dDe, dEn, folge, per, zeige]) => `<tr><td class="kp-abbr">${esc(a)}</td>`
    + `<td><b>${esc(t(de, en))}</b><br><span class="kp-small">${esc(t(dDe, dEn))}</span></td>`
    + `<td class="kp-tlc">${zeitleiste(folge, per, `${t('Takt', 'Rhythm')} ${a}`, zeige)}</td></tr>`).join('');
  return `
<h2>${t('Kennung und Wiederkehr', 'Characteristic and period')}</h2>
<p class="kp-lede">${t(
    'Die Kennung eines Feuers besteht aus Art des Taktes, Farbe und Wiederkehr. Die Wiederkehr (Periode) ist die Zeit eines vollständigen Zyklus aus Hell- und Dunkelphasen; in der Seekarte steht sie in Sekunden, etwa „Fl(3)W.10s“. Farbe ohne Angabe ist weiß.',
    'A light is identified by its rhythm, colour and period. The period is the time of one complete cycle of light and eclipse; the chart gives it in seconds, for example “Fl(3)W.10s”. No colour given means white.')}</p>
<div class="kp-legende"><span class="kp-sw kp-sw-per"></span><span>${t('Strich unter dem Takt: eine Wiederkehr', 'Line under the rhythm: one period')}</span>
<span class="kp-sw kp-sw-tick"></span><span>${t('Skalenstrich: 1 s, langer Strich: 5 s', 'Tick: 1 s, long tick: 5 s')}</span></div>
<table class="kp-data kp-lf"><thead><tr><th>${t('Kürzel', 'Abbr.')}</th><th>${t('Art', 'Type')}</th><th>${t('Takt (maßstäblich)', 'Rhythm (to scale)')}</th></tr></thead><tbody>${zeilen}</tbody></table>
<p class="kp-note">${t('Die Definitionen stammen aus dem Leuchtfeuerverzeichnis; die Dauer einzelner Blitze ist für die Darstellung angenommen. Maßgeblich für ein bestimmtes Feuer ist immer Seekarte und Leuchtfeuerverzeichnis.',
    'Definitions from the List of Lights; the duration of individual flashes is assumed for the drawing. For any particular light the chart and the List of Lights are authoritative.')}</p>
<p class="kp-small">${t('Farbkürzel: W weiß · R rot · G grün · Y gelb · Bu blau. Sektorenfeuer wie „Oc(2)WRG.9s“ zeigen je nach Peilung eine andere Farbe; die Sektorgrenzen werden von See aus zum Feuer hin angegeben.',
    'Colours: W white · R red · G green · Y yellow · Bu blue. Sector lights such as “Oc(2)WRG.9s” show a different colour depending on the bearing; sector limits are given from seaward towards the light.')}</p>
${quelle(sprache, 'pub116', 'dewiki_kennung', 'iala')}`;
}

function fahrwasser(sprache: Sprache): string {
  const t = tFuer(sprache);
  const p = pfeile();
  const { rot: R, gruen: G } = TONNE;
  const o = [p.defs, '<rect width="320" height="240" fill="var(--panel-2)"/>',
    `<path d="M0 0 H320 V30 H0 Z" fill="${LAND}"/><text x="160" y="21" text-anchor="middle" class="kp-l">${t('Hafen', 'Harbour')}</text>`,
    '<path d="M70 30 L40 240 M250 30 L280 240" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>',
    `<path d="M160 210 V60" stroke="var(--gelb)" stroke-width="2" marker-end="url(#${p.akzent})"/>`,
    `<text x="168" y="134" class="kp-l">${t('Betonnungs-', 'Direction of')}</text><text x="168" y="150" class="kp-l">${t('richtung', 'buoyage')}</text>`,
    `<text x="168" y="166" class="kp-l">${t('von See her', 'from seaward')}</text>`,
    `<text x="160" y="232" text-anchor="middle" class="kp-l">${t('See', 'Sea')}</text>`];
  for (const [y, x1, x2, n1, n2] of [[185, 52, 268, 2, 1], [115, 62, 258, 4, 3], [60, 68, 252, 6, 5]] as const) {
    o.push(`<rect x="${x1 - 7}" y="${y - 9}" width="14" height="18" fill="${R}" stroke="var(--text)" stroke-opacity=".75" stroke-width=".8"/><text x="${x1 - 14}" y="${y + 5}" text-anchor="end" class="kp-l">${n1}</text>`);
    o.push(`<polygon points="${x2},${y - 11} ${x2 + 8},${y + 9} ${x2 - 8},${y + 9}" fill="${G}" stroke="var(--text)" stroke-opacity=".75" stroke-width=".8"/><text x="${x2 + 14}" y="${y + 5}" class="kp-l">${n2}</text>`);
  }
  return `<figure class="kp-fig"><svg class="kp-zeichnung kp-fach" viewBox="0 0 320 240" role="img" aria-label="${t('Fahrwasser mit Lateralzeichen Region A', 'Channel with lateral marks, Region A')}">${o.join('')}</svg></figure>`;
}

interface Karte { svg: string; titel: string; zeilen: string[]; klein?: string; extra?: string }

const tonnenkarte = (c: Karte) => `<div class="kp-bcard">${c.svg}<h4>${esc(c.titel)}</h4>`
  + `${c.zeilen.map((z, i) => `<p${i === c.zeilen.length - 1 ? ' class="kp-lt"' : ''}>${esc(z)}</p>`).join('')}`
  + `${c.extra ?? ''}${c.klein ? `<p class="kp-small">${esc(c.klein)}</p>` : ''}</div>`;

export function lateralsystem(sprache: Sprache): string {
  const t = tFuer(sprache);
  const { rot: R, gruen: G } = TONNE;
  const karten: Karte[] = [
    { svg: tonne('can', [[1, R]], t('Stumpftonne rot', 'Red can buoy')), titel: t('Backbord', 'Port hand'),
      zeilen: [t('Rot · Stumpftonne (Zylinder), Spiere oder Leuchttonne · Toppzeichen roter Zylinder', 'Red · can, pillar or spar · topmark: single red can'), t('Licht rot, jede Kennung außer Fl(2+1)', 'Red light, any rhythm other than Fl(2+1)')],
      klein: t('gerade Nummern', 'even numbers') },
    { svg: tonne('pillar', [[1, R]], t('Backbord-Leuchttonne', 'Port-hand light buoy'), { top: 'can_r', licht: 'R' }), titel: t('Backbord, befeuert', 'Port hand, lit'),
      zeilen: [t('Leuchttonne rot, Toppzeichen roter Zylinder', 'Red pillar buoy, topmark red can'), t('z. B. Fl R 4s', 'e.g. Fl R 4s')] },
    { svg: tonne('cone', [[1, G]], t('Spitztonne grün', 'Green conical buoy')), titel: t('Steuerbord', 'Starboard hand'),
      zeilen: [t('Grün · Spitztonne (Kegel), Spiere oder Leuchttonne · Toppzeichen grüner Kegel, Spitze oben', 'Green · conical, pillar or spar · topmark: single green cone, point up'), t('Licht grün, jede Kennung außer Fl(2+1)', 'Green light, any rhythm other than Fl(2+1)')],
      klein: t('ungerade Nummern', 'odd numbers') },
    { svg: tonne('pillar', [[1, G]], t('Steuerbord-Leuchttonne', 'Starboard-hand light buoy'), { top: 'cone_g', licht: 'G' }), titel: t('Steuerbord, befeuert', 'Starboard hand, lit'),
      zeilen: [t('Leuchttonne grün, Toppzeichen grüner Kegel', 'Green pillar buoy, topmark green cone'), t('z. B. Fl G 4s', 'e.g. Fl G 4s')] },
    { svg: tonne('can', [[1, R], [1, G], [1, R]], t('Abzweigungstonne Hauptfahrwasser Steuerbord', 'Preferred channel to starboard')), titel: t('Hauptfahrwasser an Steuerbord', 'Preferred channel to starboard'),
      zeilen: [t('Rot mit einem breiten grünen Band · Zylinder', 'Red with one broad green band · can'), t('Licht rot, Fl(2+1) R', 'Red light, Fl(2+1) R')], klein: t('an Gabelungen', 'where a channel divides') },
    { svg: tonne('cone', [[1, G], [1, R], [1, G]], t('Abzweigungstonne Hauptfahrwasser Backbord', 'Preferred channel to port')), titel: t('Hauptfahrwasser an Backbord', 'Preferred channel to port'),
      zeilen: [t('Grün mit einem breiten roten Band · Kegel', 'Green with one broad red band · cone'), t('Licht grün, Fl(2+1) G', 'Green light, Fl(2+1) G')], klein: t('an Gabelungen', 'where a channel divides') },
  ];
  return `
<h2>${t('Lateralzeichen Region A', 'Lateral marks, Region A')}</h2>
<p class="kp-lede">${t(
    'Lateralzeichen bezeichnen die Seiten eines Fahrwassers, bezogen auf die Betonnungsrichtung: von See her in den Hafen, an Küsten nach Festlegung der Behörde, im Uhrzeigersinn um Landmassen. In Region A ist Backbord rot, Steuerbord grün.',
    'Lateral marks indicate the sides of a channel relative to the conventional direction of buoyage: approaching a harbour from seaward, or as set by the authority along coasts, clockwise around land masses. In Region A port is red and starboard is green.')}</p>
<div class="kp-split">${fahrwasser(sprache)}<div class="kp-prosa">
<h3>${t('Faustregeln', 'Rules of thumb')}</h3>
<p>${t('Einlaufend bleibt Rot an Backbord, Grün an Steuerbord. Nummern zählen von See her: gerade Zahlen rot, ungerade grün. An einer Gabelung zeigt die Grundfarbe einer Abzweigungstonne, auf welcher Seite das Hauptfahrwasser liegt. Die Farbe des breiten Bandes ist die Nebenseite.',
    'Inbound, keep red to port and green to starboard. Numbers count from seaward: even numbers on red, odd on green. Where a channel divides, the main colour of a preferred channel mark shows on which side the preferred channel lies; the colour of the broad band is the secondary side.')}</p>
<p>${t('In Region B sind die Farben vertauscht (Steuerbord rot), Formen und Toppzeichen bleiben gleich. Kardinal-, Einzelgefahren-, Mitte-Fahrwasser-, Sonder- und Wrackzeichen sind in beiden Regionen identisch.',
    'In Region B the colours are reversed (red to starboard); shapes and topmarks stay the same. Cardinal, isolated danger, safe water, special and emergency wreck marks are identical in both regions.')}</p>
</div></div>
<div class="kp-bgrid">${karten.map(tonnenkarte).join('')}</div>
<h2>${t('Betonnungsregionen weltweit', 'Buoyage regions of the world')}</h2>
<div class="kp-mapwrap">${weltkarte(sprache)}<div class="kp-maplegend">
<span><i class="kp-swa"></i>${t('Region A: Europa, Afrika, Asien (ohne Japan, Korea, Philippinen), Australien, Grönland', 'Region A: Europe, Africa, Asia (except Japan, Korea, Philippines), Australia, Greenland')}</span>
<span><i class="kp-swb"></i>${t('Region B: Nord-, Mittel- und Südamerika, Japan, Republik Korea, Philippinen', 'Region B: North, Central and South America, Japan, Republic of Korea, Philippines')}</span></div></div>
<p class="kp-note">${t('Übersicht nach Küstenstaaten eingefärbt. Die genauen Grenzen auf See zeigt die IALA-Karte; auch einzelne Inselgebiete können abweichen.',
    'Overview coloured by coastal state. The exact limits at sea are shown on the IALA map; individual island territories can differ.')}</p>
${quelle(sprache, 'iala', 'nga_q', 'ne')}`;
}

const { schwarz: SK, gelb: SY } = TONNE;
const KARDINAL_BAENDER: Record<Kardinal, Band[]> = {
  N: [[1, SK], [1, SY]], S: [[1, SY], [1, SK]], E: [[1, SK], [1, SY], [1, SK]], W: [[1, SY], [1, SK], [1, SY]],
};

function kardinalrose(sprache: Sprache): string {
  const t = tFuer(sprache);
  const pos: Record<Kardinal, [number, number]> = { N: [200, 70], E: [330, 200], S: [200, 330], W: [70, 200] };
  const o = ['<rect width="400" height="400" fill="var(--panel-2)"/>',
    '<circle cx="200" cy="200" r="150" fill="none" stroke="var(--line)" stroke-width="1"/>'];
  for (const a of [45, 135, 225, 315]) {
    const [x, y] = aufKreis(200, 200, 190, a);
    o.push(`<line x1="200" y1="200" x2="${k(x, 0)}" y2="${k(y, 0)}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1"/>`);
  }
  for (const [lab, a] of [['NW', 315], ['NE', 45], ['SE', 135], ['SW', 225]] as const) {
    const [x, y] = aufKreis(200, 200, 176, a);
    o.push(`<text x="${k(x, 0)}" y="${k(y + 6, 0)}" text-anchor="middle" class="kp-l kp-l-g">${lab}</text>`);
  }
  o.push(`<path d="M185 188 l10 -10 l12 4 l8 10 l-4 12 l-14 6 l-12 -6 Z" fill="${LAND}" stroke="var(--text)" stroke-width="1"/>`
    + `<text x="200" y="236" text-anchor="middle" class="kp-l kp-l-g">${t('Gefahrenstelle', 'Danger')}</text>`);
  for (const key of ['N', 'E', 'S', 'W'] as const) {
    const [x, y] = pos[key];
    o.push(tonne('pillar', KARDINAL_BAENDER[key], `${t('Kardinaltonne', 'Cardinal buoy')} ${key}`, { top: key, einbettung: { x: x - 28, y: y - 44, w: 56, h: 80 } }));
  }
  return `<figure class="kp-fig"><svg class="kp-zeichnung kp-fach" viewBox="0 0 400 400" role="img" aria-label="${t('Kardinalzeichen um eine Gefahrenstelle', 'Cardinal marks around a danger')}">${o.join('')}</svg></figure>`;
}

function sichererFaecher(key: Kardinal, label: string): string {
  const { von, bis } = SICHERE_SEKTOREN[key];
  const [cx, cy, r] = [40, 40, 30];
  const [p0, p1] = [aufKreis(cx, cy, r, von), aufKreis(cx, cy, r, bis)];
  const o = [`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="1"/>`,
    `<path d="M${cx} ${cy} L${k(p0[0])} ${k(p0[1])} A${r} ${r} 0 0 1 ${k(p1[0])} ${k(p1[1])} Z" fill="var(--green)" fill-opacity=".35" stroke="var(--green)" stroke-width="1.2"/>`,
    `<path d="M${cx - 5} ${cy - 5} l5 -2 l5 3 l-1 6 l-6 2 l-4 -4 Z" fill="${LAND}" stroke="var(--text)" stroke-width=".8"/>`];
  for (const [lab, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) {
    const [x, y] = aufKreis(cx, cy, r + 9, a);
    o.push(`<text x="${k(x)}" y="${k(y + 4.5)}" text-anchor="middle" class="kp-fan-l${imSektor(a, SICHERE_SEKTOREN[key]) ? ' kp-fan-an' : ''}">${lab}</text>`);
  }
  return `<svg class="kp-fan" viewBox="-6 -6 92 92" width="104" role="img" aria-label="${esc(label)}">${o.join('')}</svg>`;
}

export function kardinalsystem(sprache: Sprache): string {
  const t = tFuer(sprache);
  const karten: [Kardinal, string, string, string, string, string, Takt[], number][] = [
    ['N', t('Nord', 'North'), t('Schwarz über Gelb', 'Black above yellow'), t('2 Kegel, Spitzen oben', '2 cones, points upward'), t('VQ oder Q: ununterbrochen', 'VQ or Q: uninterrupted'), t('Nördlich', 'north'), VV, 0.5],
    ['E', t('Ost', 'East'), t('Schwarz mit einem breiten gelben Band', 'Black with a single broad yellow band'), t('2 Kegel, Grundflächen zueinander', '2 cones, base to base'), t('VQ(3) 5s oder Q(3) 10s', 'VQ(3) 5s or Q(3) 10s'), t('Östlich', 'east'), [...wiederhole(VV, 3), [3.5, null]], 5],
    ['S', t('Süd', 'South'), t('Gelb über Schwarz', 'Yellow above black'), t('2 Kegel, Spitzen unten', '2 cones, points downward'), t('VQ(6)+LFl 10s oder Q(6)+LFl 15s', 'VQ(6)+LFl 10s or Q(6)+LFl 15s'), t('Südlich', 'south'), [...wiederhole(VV, 6), [2, 'W'], [5, null]], 10],
    ['W', t('West', 'West'), t('Gelb mit einem breiten schwarzen Band', 'Yellow with a single broad black band'), t('2 Kegel, Spitzen zueinander', '2 cones, point to point'), t('VQ(9) 10s oder Q(9) 15s', 'VQ(9) 10s or Q(9) 15s'), t('Westlich', 'west'), [...wiederhole(VV, 9), [5.5, null]], 10],
  ];
  const SICHER: Record<Kardinal, [string, string]> = sprache === 'en' ? {
    N: ['315° through 000° to 045°', 'Course 090° (eastbound): mark to starboard<br>Course 270° (westbound): mark to port'],
    E: ['045° through 090° to 135°', 'Course 000° (northbound): mark to port<br>Course 180° (southbound): mark to starboard'],
    S: ['135° through 180° to 225°', 'Course 090° (eastbound): mark to port<br>Course 270° (westbound): mark to starboard'],
    W: ['225° through 270° to 315°', 'Course 000° (northbound): mark to starboard<br>Course 180° (southbound): mark to port'],
  } : {
    N: ['315° über 000° bis 045°', 'Kurs 090° (ostwärts): Tonne an Steuerbord<br>Kurs 270° (westwärts): Tonne an Backbord'],
    E: ['045° über 090° bis 135°', 'Kurs 000° (nordwärts): Tonne an Backbord<br>Kurs 180° (südwärts): Tonne an Steuerbord'],
    S: ['135° über 180° bis 225°', 'Kurs 090° (ostwärts): Tonne an Backbord<br>Kurs 270° (westwärts): Tonne an Steuerbord'],
    W: ['225° über 270° bis 315°', 'Kurs 000° (nordwärts): Tonne an Steuerbord<br>Kurs 180° (südwärts): Tonne an Backbord'],
  };
  const kk = karten.map(([key, n, farbe, top, licht, seite, folge, per]) => {
    const sicher = `<div class="kp-safe"><div class="kp-safe-h">${sichererFaecher(key, `${t('Sicherer Sektor', 'Safe sector')} ${n}`)}`
      + `<div><h5>${t('Sicher passieren', 'Passing safely')}</h5><p>${sprache === 'en' ? `Stay ${seite} of the mark.` : `${seite} der Tonne bleiben.`} `
      + `${t('Sichere Kurse von der Tonne weg:', 'Safe courses away from the mark:')} <b class="kp-deg">${SICHER[key][0]}</b> ${t('rechtweisend', 'true')}</p></div></div>`
      + `<p class="kp-small">${SICHER[key][1]}</p></div>`;
    return tonnenkarte({
      svg: tonne('pillar', KARDINAL_BAENDER[key], `${t('Kardinalzeichen', 'Cardinal mark')} ${n}`, { top: key as Toppzeichen, licht: 'W' }),
      titel: n, zeilen: [farbe, `${t('Toppzeichen', 'Topmark')}: ${top}`, licht],
      extra: zeitleiste(folge, per, `${t('Takt', 'Rhythm')} ${n}`, 15) + sicher,
    });
  }).join('');
  return `
<h2>${t('Kardinalzeichen', 'Cardinal marks')}</h2>
<p class="kp-lede">${t(
    'Ein Kardinalzeichen liegt im benannten Quadranten der Gefahr und wird auf seiner benannten Seite passiert: an der Nordtonne nördlich vorbei. Die Quadranten grenzen an den rechtweisenden Peilungen NW–NE, NE–SE, SE–SW und SW–NW vom Gefahrenpunkt.',
    'A cardinal mark is placed in the named quadrant of the danger and is passed on its named side: pass north of a north mark. The quadrants are bounded by the true bearings NW–NE, NE–SE, SE–SW and SW–NW, taken from the point of interest.')}</p>
<div class="kp-split">${kardinalrose(sprache)}<div class="kp-prosa">
<h3>${t('Merkhilfen', 'Memory aids')}</h3>
<p>${t('Die Kegelspitzen zeigen auf die schwarzen Bänder. Nord: beide nach oben, schwarz oben. Süd: nach unten, schwarz unten. Ost: voneinander weg, schwarz oben und unten. West: zueinander, schwarz in der Mitte.',
    'The cone points show where the black bands are: north: both up, black on top; south: both down, black at the bottom; east: pointing away from each other, black top and bottom; west: pointing towards each other, black in the middle.')}</p>
<p>${t('Das weiße Licht folgt dem Zifferblatt: Ost 3, Süd 6, West 9 Blitze, Nord ununterbrochen. Der lange Blitz von mindestens 2 s hinter Süd verhindert, dass 3 oder 9 Blitze für 6 gehalten werden.',
    'The white light follows a clock face: east 3, south 6, west 9 flashes, north uninterrupted. The long flash of at least 2 s after south ensures that 3 or 9 flashes cannot be mistaken for 6.')}</p>
<p>${t('VQ: 120 oder 100 Blitze pro Minute, Q: 60 oder 50.', 'VQ: 120 or 100 flashes per minute, Q: 60 or 50.')}</p>
<h3>${t('Sichere Kurse', 'Safe courses')}</h3>
<p>${t('Ein Kardinalzeichen wird an seiner benannten Seite passiert. Garantiert frei ist laut IALA nur der benannte Quadrant; er wird durch die rechtweisenden Peilungen NW–NE, NE–SE, SE–SW und SW–NW vom Gefahrenpunkt begrenzt. Daraus ergeben sich je Zeichen die Kurse, die von der Tonne weg im sicheren Quadranten bleiben (grüner Fächer in den Karten unten).',
    'A cardinal mark is passed on its named side. According to IALA only the named quadrant is guaranteed clear; it is bounded by the true bearings NW–NE, NE–SE, SE–SW and SW–NW from the point of interest. This gives, for each mark, the courses that lead away from the mark while staying in the safe quadrant (green fan in the cards below).')}</p>
<p>${t('Auch östlich und westlich einer Nordtonne kann befahrbares Wasser liegen, ob dort Kurse sicher sind, zeigt nur die Seekarte. Die Gradzahlen sind rechtweisend; für den Steuerkompass Missweisung und Ablenkung berücksichtigen.',
    'There may be navigable water east and west of a north mark as well. Only the chart shows whether courses there are safe. The bearings are true; allow for variation and deviation on the steering compass.')}</p>
</div></div>
<div class="kp-bgrid kp-vier">${kk}</div>
<p class="kp-note">${t('Zeitleisten zeigen die VQ-Variante über 15 s. Die Kursangaben sind aus der IALA-Definition der Quadranten abgeleitet; die Seekarte geht immer vor.',
    'The rhythm bars show the VQ variant over 15 s. The course figures are derived from the IALA definition of the quadrants; the chart always takes precedence.')}</p>
${quelle(sprache, 'iala', 'nga_q')}`;
}

export function einzelgefahr(sprache: Sprache): string {
  const t = tFuer(sprache);
  const { rot: R, schwarz: K, gelb: Y, weiss: W, blau: B } = TONNE;
  const takt = t('Takt', 'Rhythm');
  const karten: Karte[] = [
    { svg: tonne('pillar', [[1, K], [1, R], [1, K]], t('Einzelgefahrzeichen', 'Isolated danger mark'), { top: '2balls', licht: 'W' }),
      titel: t('Einzelgefahrenstelle', 'Isolated danger'),
      zeilen: [t('Schwarz mit einem oder mehreren breiten roten Bändern · Säule oder Spiere bevorzugt', 'Black with one or more broad red bands · pillar or spar preferred'), t('Toppzeichen: 2 schwarze Bälle übereinander', 'Topmark: 2 black spheres'), t('Licht weiß, Fl(2)', 'White light, Fl(2)')],
      extra: zeitleiste([[0.5, 'W'], [1, null], [0.5, 'W'], [3, null]], 5, takt, 10),
      klein: t('Liegt auf oder über einer Gefahr kleiner Ausdehnung, rundum befahrbares Wasser.', 'Erected on, or moored on or above, a danger of limited size with navigable water all around it.') },
    { svg: tonne('pillar', [[1, R], [1, W], [1, R], [1, W]], t('Mitte-Fahrwasser-Zeichen', 'Safe water mark'), { top: 'ball_r', senkrecht: true, licht: 'W' }),
      titel: t('Sicheres Wasser (Mitte Fahrwasser, Ansteuerung)', 'Safe water (mid-channel, landfall)'),
      zeilen: [t('Rot-weiße senkrechte Streifen · Kugel, oder Säule/Spiere mit Kugel', 'Red and white vertical stripes · spherical, or pillar/spar with a spherical topmark'), t('Toppzeichen: rote Kugel', 'Topmark: single red sphere'), t('Licht weiß: Iso, Oc, LFl 10s oder Mo(A)', 'White light: Iso, Oc, LFl 10s or Mo(A)')],
      extra: zeitleiste([[2, 'W'], [8, null]], 10, takt, 10),
      klein: t('Rundum befahrbares Wasser, keine Gefahr; z. B. Fahrwassermitte oder Ansteuerung.', 'Navigable water all round; no danger. Used e.g. as mid-channel or landfall mark.') },
    { svg: tonne('pillar', [[1, Y]], t('Sonderzeichen', 'Special mark'), { top: 'X', licht: 'Y' }),
      titel: t('Sonderzeichen', 'Special mark'),
      zeilen: [t('Gelb · Form beliebig, darf Lateralzeichen nicht widersprechen', 'Yellow · shape optional, but not conflicting with lateral marks'), t('Toppzeichen: gelbes liegendes Kreuz (X)', 'Topmark: single yellow X'), t('Licht gelb, jede Kennung außer denen der weißen Feuer', 'Yellow light, any rhythm other than those reserved for white lights')],
      extra: zeitleiste([[0.5, 'Y'], [4.5, null]], 5, takt, 10),
      klein: t('Kennzeichnet z. B. Kabel, Rohrleitungen, Sperr- und Übungsgebiete, Ankergebiete, Aquakultur oder Badezonen.', 'Marks e.g. cables and pipelines, military exercise zones, anchorage limits, aquaculture or recreation zones.') },
    { svg: tonne('pillar', [[1, B], [1, Y], [1, B], [1, Y], [1, B], [1, Y]], t('Wrackmarkierungstonne', 'Emergency wreck marking buoy'), { top: 'cross', senkrecht: true, licht: 'Bu' }),
      titel: t('Neue Gefahr: Notfall-Wracktonne', 'New danger: emergency wreck marking buoy'),
      zeilen: [t('Blau-gelbe senkrechte Streifen in gleicher Zahl (4 bis 8) · Säule oder Spiere', 'Blue and yellow vertical stripes in equal number (4 to 8) · pillar or spar'), t('Toppzeichen: stehendes gelbes Kreuz', 'Topmark: upright yellow cross'), t('Al.Bu.Y 3s: 1 s blau, 0,5 s dunkel, 1 s gelb, 0,5 s dunkel', 'Al.Bu.Y 3s: 1 s blue, 0.5 s dark, 1 s yellow, 0.5 s dark')],
      extra: zeitleiste([[1, 'Bu'], [0.5, null], [1, 'Y'], [0.5, null]], 3, takt, 10),
      klein: t('Markiert vorläufig ein neues, noch nicht veröffentlichtes Wrack. Kann zusätzlich Racon „D“ und AIS tragen.', 'Temporarily marks a new wreck not yet shown in nautical documents. May also carry a racon coded “D” and AIS.') },
  ];
  return `
<h2>${t('Einzelgefahr, sicheres Wasser, Sonderzeichen', 'Isolated danger, safe water, special marks')}</h2>
<p class="kp-lede">${t('Diese Zeichen gelten in Region A und B gleich. Weißes Licht tragen nur Kardinal-, Einzelgefahr- und Mitte-Fahrwasser-Zeichen; ihre Kennungen sind so gewählt, dass sie nicht verwechselt werden können.',
    'These marks are the same in Region A and B. Only cardinal, isolated danger and safe water marks carry white lights; their rhythms are chosen so that they cannot be confused.')}</p>
<div class="kp-bgrid kp-vier">${karten.map(tonnenkarte).join('')}</div>
${quelle(sprache, 'iala', 'o133', 'nga_q')}`;
}
