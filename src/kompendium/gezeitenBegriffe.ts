import { tFuer } from './bausteine';
import { LAND } from './abschnitteB';
import { esc, k, pfeile } from './svg';
import type { Sprache } from '@/core/types';

const M2_H = 12.4206;
const S2_H = 12;
const A_M2 = 1.0;
const A_S2 = 0.4;

const SPRING_T0_H = 36;

function hoehe(stunde: number): number {
  const t = stunde - SPRING_T0_H;
  return A_M2 * Math.cos((2 * Math.PI * t) / M2_H) + A_S2 * Math.cos((2 * Math.PI * t) / S2_H);
}

interface Stufe { wert: number; de: string; en: string; stark?: boolean }

const STUFEN: readonly Stufe[] = [
  { wert: 1.75, de: 'HGzW', en: 'HAT' },
  { wert: 1.4, de: 'MSpHW', en: 'MHWS', stark: true },
  { wert: 1.0, de: 'MHW', en: 'MHW' },
  { wert: 0.6, de: 'MNpHW', en: 'MHWN', stark: true },
  { wert: 0, de: 'MW', en: 'MSL' },
  { wert: -0.6, de: 'MNpNW', en: 'MLWN', stark: true },
  { wert: -1.0, de: 'MNW', en: 'MLW' },
  { wert: -1.4, de: 'MSpNW', en: 'MLWS', stark: true },
  { wert: -1.75, de: 'NGzW', en: 'LAT' },
];

export function zeichnungSpringNipp(sprache: Sprache): string {
  const t = tFuer(sprache);
  const p = pfeile();
  const x0 = 46;
  const proTag = 29;
  const y0 = 160;
  const proM = 70;
  const X = (stunde: number) => x0 + (stunde / 24) * proTag;
  const Y = (m: number) => y0 - m * proM;
  const x1 = X(16 * 24);

  const linien = STUFEN.map((s) => {
    const y = Y(s.wert);
    const strich = s.wert === 0 ? '' : ' stroke-dasharray="4 3"';
    return `<line x1="${x0}" y1="${k(y)}" x2="${k(x1)}" y2="${k(y)}" stroke="var(--muted)" stroke-width="${s.stark ? 1.2 : 0.8}"${strich}/>`
      + `<text x="${k(x1 + 6)}" y="${k(y + 4.5)}" class="kp-l${s.stark ? ' kp-nm' : ''}">${sprache === 'en' ? s.en : s.de}</text>`;
  }).join('');

  const punkte: string[] = [];
  for (let h = 0; h <= 16 * 24; h += 0.5) punkte.push(`${k(X(h))},${k(Y(hoehe(h)))}`);
  const kurve = `<polyline points="${punkte.join(' ')}" fill="none" stroke="var(--teal)" stroke-width="1.3"/>`;

  const hub = (tag: number, oben: number, unten: number, text: string) => {
    const x = X(tag * 24);
    return `<line x1="${k(x)}" y1="${k(Y(unten))}" x2="${k(x)}" y2="${k(Y(oben))}" stroke="var(--akzent)" stroke-width="2" `
      + `marker-start="url(#${p.akzent})" marker-end="url(#${p.akzent})"/>`
      + `<text x="${k(x + 5)}" y="${k(Y(oben) - 6)}" class="kp-l kp-l-h">${esc(text)}</text>`;
  };

  const mond = (tag: number, art: 'neu' | 'halb' | 'voll', text: string) => {
    const x = X(tag * 24);
    const y = 326;
    const r = 7;
    const scheibe = art === 'neu'
      ? `<circle cx="${k(x)}" cy="${y}" r="${r}" fill="var(--text)"/>`
      : art === 'voll'
        ? `<circle cx="${k(x)}" cy="${y}" r="${r}" fill="none" stroke="var(--text)" stroke-width="1.4"/>`
        : `<circle cx="${k(x)}" cy="${y}" r="${r}" fill="none" stroke="var(--text)" stroke-width="1.4"/>`
          + `<path d="M${k(x)} ${y - r} A${r} ${r} 0 0 1 ${k(x)} ${y + r} Z" fill="var(--text)"/>`;
    return scheibe + `<text x="${k(x)}" y="${y + 24}" text-anchor="middle" class="kp-l">${esc(text)}</text>`;
  };
  const zeit = (tag: number, text: string) => `<text x="${k(X(tag * 24))}" y="20" text-anchor="middle" class="kp-l kp-nm">${esc(text)}</text>`
    + `<line x1="${k(X(tag * 24))}" y1="26" x2="${k(X(tag * 24))}" y2="${k(Y(1.75) - 4)}" stroke="var(--muted)" stroke-width=".8"/>`;

  const tage = [0, 2, 4, 6, 8, 10, 12, 14, 16].map((d) => `<text x="${k(X(d * 24))}" y="${k(Y(-1.75) + 18)}" text-anchor="middle" class="kp-l kp-small">${d === 16 ? t('16 Tage', '16 days') : d}</text>`).join('');

  const inhalt = `${p.defs}<rect width="640" height="362" fill="var(--panel-2)"/>${linien}${kurve}`
    + hub(1.5, 1.4, -1.4, t('Springtidenhub', 'Spring range'))
    + hub(8.9, 0.6, -0.6, t('Nipptidenhub', 'Neap range'))
    + zeit(1.5, t('Springzeit', 'Springs')) + zeit(8.9, t('Nippzeit', 'Neaps'))
    + tage
    + mond(0, 'neu', t('Neumond', 'New moon')) + mond(7.38, 'halb', t('Halbmond', 'First quarter')) + mond(14.77, 'voll', t('Vollmond', 'Full moon'));
  return `<svg class="kp-zeichnung" viewBox="0 0 640 362" role="img" aria-label="${esc(t(
    'Gezeitenkurve über einen halben Monat: großer Tidenhub zur Springzeit kurz nach Neu- und Vollmond, kleiner zur Nippzeit nach Halbmond, dazu die mittleren Wasserstände von HGzW bis NGzW',
    'Tidal curve over half a month: large range at springs shortly after new and full moon, small range at neaps after the quarter moon, with the mean levels from HAT to LAT'))}">${inhalt}</svg>`;
}

export function zeichnungKartennull(sprache: Sprache): string {
  const t = tFuer(sprache);
  const p = pfeile();
  const skn = 92;
  const wasser = 52;
  const grund = 168;
  const pfeil = (x: number, y1: number, y2: number, farbe: string, marke: string, text: string, rechts = true) =>
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${farbe}" stroke-width="2" marker-start="url(#${marke})" marker-end="url(#${marke})"/>`
    + `<text x="${rechts ? x + 7 : x - 7}" y="${(y1 + y2) / 2 + 5}" text-anchor="${rechts ? 'start' : 'end'}" class="kp-l kp-l-h">${esc(text)}</text>`;
  const welle = `<path d="M0 ${wasser} q12 -5 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" `
    + 'fill="none" stroke="var(--teal)" stroke-width="2"/>';
  const inhalt = `${p.defs}<rect width="360" height="200" fill="var(--panel-2)"/>${welle}`
    + `<line x1="0" y1="${skn}" x2="360" y2="${skn}" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="5 3"/>`
    + `<text x="8" y="${skn + 17}" class="kp-l kp-nm">${t('Seekartennull (SKN)', 'Chart datum (CD)')}</text>`
    + `<path d="M0 ${grund} L360 ${grund - 12} L360 200 L0 200 Z" fill="${LAND}"/>`
    + `<text x="8" y="${wasser - 10}" class="kp-l">${t('Wasserstand jetzt', 'Present water level')}</text>`
    + pfeil(262, wasser + 2, grund - 10, 'var(--text)', p.text, t('Wassertiefe', 'Depth of water'))
    + pfeil(150, wasser + 2, skn - 2, 'var(--akzent)', p.akzent, t('Höhe der Gezeit', 'Height of tide'))
    + pfeil(150, skn + 2, grund - 6, 'var(--muted)', p.grau, t('Kartentiefe', 'Charted depth'));
  return `<svg class="kp-zeichnung" viewBox="0 0 360 200" role="img" aria-label="${esc(t(
    'Wassertiefe ist Kartentiefe unter Seekartennull plus Höhe der Gezeit darüber',
    'Depth of water is the charted depth below chart datum plus the height of tide above it'))}">${inhalt}</svg>`;
}

export function gezeitenBegriffe(sprache: Sprache): string {
  const t = tFuer(sprache);
  const zeilen: [string, string][] = sprache === 'en' ? [
    ['HW, LW', 'High water and low water: the highest and lowest level of one tide, with time and height in the tide table.'],
    ['Range', 'Height difference between successive high and low water. Rise: from LW to the following HW; fall: from HW to the following LW.'],
    ['Flood, ebb', 'Rising and falling tide; the tidal stream runs accordingly as flood stream and ebb stream.'],
    ['Springs', 'Around new and full moon, when the effects of sun and moon add up: large range, high HW, low LW. They lag the moon by the age of the tide, two days in the North Sea; SailPilot gives it for the gauge.'],
    ['Neaps', 'Around the quarter moons, when sun and moon act at right angles: small range.'],
    ['MHWS, MLWS', 'Mean high water springs and mean low water springs: the average of the high and low waters on spring days.'],
    ['MHWN, MLWN', 'Mean high water neaps and mean low water neaps: the same on neap days.'],
    ['MHW, MLW, MSL', 'Mean high water, mean low water and mean sea level over all tides.'],
    ['HAT, LAT', 'Highest and lowest astronomical tide: the highest and lowest level that can be predicted from sun and moon alone. Wind and air pressure can go beyond them.'],
    ['Chart datum', 'The level the charted depths refer to. Off the German North Sea coast it is LAT; in non-tidal waters usually mean sea level. The chart states which datum it uses.'],
    ['Chart datum Croatia', 'Croatian charts (HHI): the mean level of the lower low waters at springs (MLLWS), from the 18.6-year record for epoch 1971.5 (HRSDM71).'],
    ['Chart datum Greece', 'Greek charts: mean low water springs (MLWS).'],
  ] : [
    ['HW, NW', 'Hochwasser und Niedrigwasser: höchster und niedrigster Wasserstand einer Tide, mit Zeit und Höhe in der Gezeitentafel.'],
    ['Tidenhub', 'Höhenunterschied zwischen aufeinanderfolgendem Hoch- und Niedrigwasser. Tidenstieg: von NW zum folgenden HW; Tidenfall: von HW zum folgenden NW.'],
    ['Flut, Ebbe', 'Steigendes und fallendes Wasser; der Gezeitenstrom läuft entsprechend als Flut- und Ebbstrom.'],
    ['Springzeit', 'Um Neu- und Vollmond, wenn sich Sonne und Mond addieren: großer Tidenhub, hohes HW, tiefes NW. Sie folgt dem Mond um die Springverspätung, in der Nordsee rund zwei Tage; TörnNavLog nennt sie für den Pegel.'],
    ['Nippzeit', 'Um Halbmond, wenn Sonne und Mond rechtwinklig zueinander wirken: kleiner Tidenhub.'],
    ['MSpHW, MSpNW', 'Mittleres Springhochwasser und mittleres Springniedrigwasser: Mittel der Hoch- bzw. Niedrigwasser an Springtagen.'],
    ['MNpHW, MNpNW', 'Mittleres Nipphochwasser und mittleres Nippniedrigwasser: dasselbe an Nipptagen.'],
    ['MHW, MNW, MW', 'Mittleres Hochwasser, mittleres Niedrigwasser und Mittelwasser über alle Tiden.'],
    ['HGzW, NGzW', 'Höchster und niedrigster Gezeitenwasserstand (HAT, LAT): der höchste und niedrigste Stand, der sich aus Sonne und Mond allein vorausberechnen lässt. Wind und Luftdruck können darüber hinausgehen.'],
    ['Seekartennull (SKN)', 'Bezugsfläche der Kartentiefen. Vor der deutschen Nordseeküste ist es NGzW, in gezeitenfreien Gewässern meist das Mittelwasser. Welches gilt, steht in der Seekarte.'],
    ['SKN Kroatien', 'Kroatische Seekarten (HHI): mittlere Höhe der niedrigeren Niedrigwasser zur Springzeit (MLLWS, kroatisch „srednja razina nižih niskih voda živih morskih mijena“), aus der 18,6-jährigen Reihe für die Epoche 1971,5 (HRSDM71).'],
    ['SKN Griechenland', 'Griechische Seekarten: mittleres Springniedrigwasser (MSpNW).'],
  ];
  const tabelle = zeilen.map(([a, b]) => `<tr><th scope="row" class="kp-nm">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('');
  return `
<h3>${t('Gezeitenbegriffe', 'Tidal terms')}</h3>
<figure class="kp-fig kp-fig-breit">${zeichnungSpringNipp(sprache)}<figcaption class="kp-small">${t(
    'Schematisch: Die Kurve schwingt zweimal täglich; ihr Hub wächst zur Springzeit und schrumpft zur Nippzeit. MSpHW und MSpNW umfassen den Springtidenhub, MNpHW und MNpNW den Nipptidenhub.',
    'Schematic: the curve rises and falls twice a day; its range grows at springs and shrinks at neaps. MHWS and MLWS span the spring range, MHWN and MLWN the neap range.')}</figcaption></figure>
<div class="kp-tw"><table class="kp-data kp-gzbegriffe"><thead><tr><th>${t('Begriff', 'Term')}</th><th>${t('Bedeutung', 'Meaning')}</th></tr></thead><tbody>${tabelle}</tbody></table></div>
<div class="kp-split"><figure class="kp-fig">${zeichnungKartennull(sprache)}</figure><div class="kp-prosa">
<p>${t('Die Seekarte gibt die Kartentiefe unter Seekartennull an, die Gezeitentafel die Höhe der Gezeit darüber. Zusammen ergeben sie die Wassertiefe zum gewünschten Zeitpunkt. Liegt das Seekartennull auf NGzW, ist die Kartentiefe die geringste Tiefe, die Sonne und Mond allein erzeugen.',
    'The chart gives the charted depth below chart datum, the tide table the height of tide above it. Together they give the depth of water at the required time. Where chart datum is LAT, the charted depth is the least depth that sun and moon alone produce.')}</p>
</div></div>`;
}
