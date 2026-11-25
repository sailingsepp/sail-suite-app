import { quellen } from './daten';
import { tFuer, quelle, rechner } from './bausteine';
import { esc, pfeile } from './svg';
import { LAND } from './abschnitteB';
import { ZWOELFTEL } from '@/core/kompendium';
import { gezeitenBegriffe } from './gezeitenBegriffe';
import type { Sprache } from '@/core/types';

export function kompass(sprache: Sprache): string {
  const t = tFuer(sprache);
  const p = pfeile();
  const fig = `<figure class="kp-fig"><svg class="kp-zeichnung" viewBox="0 0 320 200" role="img" aria-label="${t('Kurse: Kompassnord, Missweisend Nord, Rechtweisend Nord', 'True north, magnetic north and compass north')}">`
    + `${p.defs}<rect width="320" height="200" fill="var(--panel-2)"/><g transform="translate(150,186)">`
    + `<line x1="0" y1="0" x2="0" y2="-160" stroke="var(--text)" stroke-width="2"/><text x="-4" y="-166" text-anchor="end" class="kp-l">${t('rw N', 'True N')}</text>`
    + '<line x1="0" y1="0" x2="28" y2="-158" stroke="var(--gelb)" stroke-width="2"/>'
    + `<text x="30" y="-166" class="kp-l kp-l-a">${t('mw N', 'Mag N')}</text>`
    + '<line x1="0" y1="0" x2="44" y2="-154" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 3"/>'
    + `<text x="50" y="-146" class="kp-l">${t('Kompass N', 'Compass N')}</text>`
    + `<line x1="0" y1="0" x2="128" y2="-92" stroke="var(--text)" stroke-width="3" marker-end="url(#${p.text})"/>`
    + `<text x="150" y="-82" class="kp-l" text-anchor="end">${t('Kielrichtung', 'Heading')}</text>`
    + '<path d="M0 -60 A60 60 0 0 1 10 -59" fill="none" stroke="var(--gelb)" stroke-width="1.5"/>'
    + `<text x="-6" y="-58" class="kp-l kp-l-a" text-anchor="end">${t('Mw', 'VAR')}</text>`
    + '<path d="M10 -78 A80 80 0 0 1 22 -77" fill="none" stroke="var(--muted)" stroke-width="1.5"/>'
    + `<text x="-6" y="-80" class="kp-l" text-anchor="end">${t('Abl', 'DEV')}</text></g></svg></figure>`;
  const kuerzel: [string, string, string, string][] = [
    ['MgK', 'Magnetkompasskurs', 'CC', 'compass course'], ['Abl', 'Ablenkung', 'DEV', 'deviation'],
    ['mwK', 'missweisender Kurs', 'MC', 'magnetic course'], ['Mw', 'Missweisung', 'VAR', 'variation'],
    ['rwK', 'rechtweisender Kurs', 'TC', 'true course'], ['KdW', 'Kurs durchs Wasser', 'CTW', 'course through the water'],
    ['KüG', 'Kurs über Grund', 'COG', 'course over ground'],
  ];
  const tab = kuerzel.map(([dk, dl, ek, el]) => (sprache === 'en'
    ? `<tr><td class="kp-abbr">${ek}</td><td>${el}</td><td class="kp-abbr">${dk}</td></tr>`
    : `<tr><td class="kp-abbr">${dk}</td><td>${dl}</td><td class="kp-abbr">${ek}</td></tr>`)).join('');
  return `
<h2>${t('Kursbeschickung', 'Compass correction')}</h2>
<p class="kp-lede">${t(
    'Der Magnetkompass zeigt nicht nach geografisch Nord. Zwei Fehler liegen dazwischen: die Missweisung (Mw, Unterschied zwischen geografisch und magnetisch Nord, aus der Seekarte) und die Ablenkung (Abl, Fehler durch das eigene Schiff, aus der Ablenkungstabelle, kursabhängig).',
    'A magnetic compass does not point to true north. Two errors lie in between: variation (VAR, the angle between true and magnetic north, from the chart) and deviation (DEV, the error caused by the vessel itself, from the deviation card; it depends on the heading).')}</p>
<div class="kp-split">${fig}<div class="kp-prosa">
<div class="kp-eq">${t('MgK + Abl = mwK<br>mwK + Mw = rwK', 'CC + DEV = MC<br>MC + VAR = TC')}</div>
<p>${t('Östliche Werte sind positiv, westliche negativ. Von der Seekarte zum Steuerkompass rechnet man rückwärts mit umgekehrten Vorzeichen: rwK − Mw = mwK, mwK − Abl = MgK.',
    'Easterly values are positive, westerly negative. From the chart to the steering compass work backwards with the signs reversed: TC − VAR = MC, MC − DEV = CC.')}</p>
<p>${t('Weiter zum Kurs durchs Wasser (KdW) kommt die Beschickung durch Wind (BW) hinzu, zum Kurs über Grund (KüG) die Beschickung durch Strom (BS).',
    'Leeway is applied to obtain the course through the water (CTW); tidal stream or current to obtain the course over ground (COG).')}</p>
${rechner('ks', [
    { name: 'rw', label: t('rwK (°)', 'TC (°)'), wert: 57 },
    { name: 'mw', label: t('Mw (°, E +)', 'VAR (°, E +)'), wert: 4 },
    { name: 'abl', label: t('Abl (°, E +)', 'DEV (°, E +)'), wert: -2 },
  ], sprache)}
</div></div>
<table class="kp-mini kp-abbrtab">${tab}</table>
${sprache === 'en' ? '<p class="kp-note">Right-hand column: the German abbreviations used in German training material.</p>' : ''}
${quelle(sprache, 'kursbeschickung', 'dreyer')}`;
}

export function einheiten(sprache: Sprache): string {
  const t = tFuer(sprache);
  const zeilen: [string, string, string][] = sprache === 'en' ? [
    ['1 nautical mile (NM)', '1852 m', 'by definition; approximately one minute of arc of latitude'],
    ['1 cable', '0.1 NM = 185.2 m', 'international; traditionally ⅛ NM in the United Kingdom'],
    ['1 fathom', '6 ft = 1.8288 m', 'depth unit on British and US charts; 1 ft = 0.3048 m'],
    ['1 knot (kn)', '1 NM/h = 1852/3600 m/s ≈ 0.514 m/s', '= 1.852 km/h'],
    ['1 m/s', '≈ 1.944 kn', '= 3.6 km/h'],
    ['1/3600 NM', '≈ 0.514 m', "distance covered in 1 s at 1 kn (Dutchman's log)"],
    ['1° of latitude', '60 NM', '1′ of latitude = 1 NM; degrees of longitude shorten towards the poles'],
  ] : [
    ['1 Seemeile (sm, NM)', '1852 m', 'Definition; entspricht etwa einer Bogenminute Breite'],
    ['1 Kabellänge', '0,1 sm = 185,2 m', 'international; Vereinigtes Königreich traditionell ⅛ sm'],
    ['1 Faden (fathom)', '6 ft = 1,8288 m', 'Tiefenmaß in britischen und US-Karten; 1 ft = 0,3048 m'],
    ['1 Knoten (kn)', '1 sm/h = 1852/3600 m/s ≈ 0,514 m/s', '= 1,852 km/h'],
    ['1 m/s', '≈ 1,944 kn', '= 3,6 km/h'],
    ['1 Meridiantertie', '1/3600 sm ≈ 0,514 m', 'Strecke in 1 s bei 1 kn (Relingslogge)'],
    ['1° Breite', '60 sm', '1′ Breite = 1 sm; Längengrade werden zu den Polen kürzer'],
  ];
  const tr = zeilen.map(([a, b, c]) => `<tr><td class="kp-nm">${esc(a)}</td><td class="kp-num">${esc(b)}</td><td>${esc(c)}</td></tr>`).join('');
  return `
<h2>${t('Nautische Einheiten', 'Nautical units')}</h2>
<table class="kp-data kp-einheiten"><thead><tr><th>${t('Einheit', 'Unit')}</th><th>${t('Wert', 'Value')}</th><th>${t('Hinweis', 'Note')}</th></tr></thead><tbody>${tr}</tbody></table>
${rechner('u', [{ name: 'kn', label: t('Knoten', 'Knots'), wert: 6 }], sprache)}
${quelle(sprache, 'nist', 'kabel', 'dewiki_relings')}`;
}

export function gezeitenGrundlagen(sprache: Sprache): string {
  const t = tFuer(sprache);
  let summe = 0;
  const balken = ZWOELFTEL.map((f, i) => {
    summe += f;
    const x = 40 + i * 44;
    return `<rect x="${x}" y="${170 - summe * 11}" width="34" height="${f * 11}" fill="var(--gelb)" opacity=".85"/>`
      + `<rect x="${x}" y="${170 - (summe - f) * 11}" width="34" height="${(summe - f) * 11}" fill="var(--muted)" opacity=".35"/>`
      + `<text x="${x + 17}" y="190" text-anchor="middle" class="kp-l">${sprache === 'en' ? `hr ${i + 1}` : `${i + 1}. h`}</text>`
      + `<text x="${x + 17}" y="${164 - summe * 11}" text-anchor="middle" class="kp-l">${f}/12</text>`;
  }).join('');
  const fig = `<figure class="kp-fig"><svg class="kp-zeichnung" viewBox="0 0 320 200" role="img" aria-label="${t('Zwölftelregel', 'Rule of twelfths')}">`
    + `<rect width="320" height="200" fill="var(--panel-2)"/><line x1="34" y1="170" x2="310" y2="170" stroke="var(--text)"/>${balken}</svg>`
    + `<figcaption class="kp-small">${t('Anteil am Tidenhub, kumuliert (NW → HW)', 'Share of the range, cumulative (LW → HW)')}</figcaption></figure>`;
  return `
<h2>${t('Gezeiten-Grundlagen', 'Tidal basics')}</h2>
<div class="kp-split">${fig}<div class="kp-prosa">
<div class="kp-eq">${t('Wassertiefe = Kartentiefe + Höhe der Gezeit', 'Depth of water = charted depth + height of tide')}</div>
<p>${t('Die Kartentiefe bezieht sich auf das Seekartennull der jeweiligen Karte; die Höhe der Gezeit zum gewünschten Zeitpunkt kommt aus den Gezeitentafeln. Tidenhub ist der Höhenunterschied zwischen Hoch- und Niedrigwasser.',
    'The charted depth refers to the chart datum of the chart in use; the height of tide at the required time comes from the tide tables. The range is the difference in height between high and low water.')}</p>
<h3>${t('Zwölftelregel', 'Rule of twelfths')}</h3>
<p>${t('Näherung für ein Gezeitenintervall von etwa 6 Stunden: Das Wasser steigt oder fällt in den sechs Stunden um 1, 2, 3, 3, 2 und 1 Zwölftel des Tidenhubs. Sie setzt eine sinusförmige Gezeitenkurve voraus und versagt dort, wo es doppelte Hoch- oder Niedrigwasser gibt. Für die Navigation nur mit großer Vorsicht; maßgeblich sind amtliche Gezeitentafeln.',
    'An approximation for a tide of roughly six hours: in each of the six hours the water rises or falls by 1, 2, 3, 3, 2 and 1 twelfths of the range. It assumes a sinusoidal tidal curve and fails where there are double high or low waters. Use with great caution for navigation; official tide tables take precedence.')}</p>
${rechner('tz', [
    { name: 'hub', label: t('Tidenhub (m)', 'Range (m)'), wert: 3.6 },
    { name: 'std', label: t('Stunden nach NW', 'Hours after LW'), wert: 3 },
  ], sprache)}
<p><button type="button" class="btn kp-sprung" data-sprung="gezeiten">${t('Gezeiten für die eigene Position öffnen', 'Open tides for your own position')}</button></p>
</div></div>
${gezeitenBegriffe(sprache)}
${quelle(sprache, 'twelfths', 'dreyer', 'wiki_gezeiten', 'wiki_tide', 'yacht_skn', 'struna_skn', 'pmf_skn')}`;
}

export function formeln(sprache: Sprache): string {
  const t = tFuer(sprache);
  return `
<h2>${t('Formeln für die Navigation', 'Navigation formulas')}</h2>
<div class="kp-formeln">
<section class="kp-fcard"><h3>${t('Weg, Zeit, Geschwindigkeit', 'Distance, time, speed')}</h3>
<div class="kp-eq">${t('s = v · t · v = s ÷ t · t = s ÷ v', 'd = v · t · v = d ÷ t · t = d ÷ v')}</div>
<p>${t('s in Seemeilen (sm), v in Knoten (kn = sm/h), t in Stunden. Minuten durch 60 teilen. 1 sm = 1852 m.',
    'd in nautical miles (NM), v in knots (kn = NM/h), t in hours. Divide minutes by 60. 1 NM = 1852 m.')}</p>
${rechner('swt', [{ name: 'v', label: 'v (kn)', wert: 6.5 }, { name: 't', label: 't (min)', wert: 45 }], sprache)}
</section>
<section class="kp-fcard"><h3>${t('Abstand aus Höhenwinkel', 'Distance by vertical sextant angle')}</h3>
<div class="kp-eq">${t('d = H ÷ tan α ≈ 1,856 · H ÷ α′', 'd = H ÷ tan α ≈ 1.856 · H ÷ α′')}</div>
<p>${t('H Höhe des Objekts über dem Wasserspiegel in m (Feuerhöhe aus Seekarte), α′ gemessener Höhenwinkel in Bogenminuten, d in sm. Herleitung: für kleine Winkel tan α ≈ α; 1′ = 1/3437,75 rad und 1 sm = 1852 m ergeben 3437,75 ÷ 1852 ≈ 1,856. In Formelsammlungen auch als d = 13 H ÷ (7 α′). Gilt, solange der Fuß des Objekts diesseits der Kimm liegt.',
    'H height of the object above the water in m (height of the light from the chart), α′ measured vertical angle in minutes of arc, d in NM. Derivation: for small angles tan α ≈ α; 1′ = 1/3437.75 rad and 1 NM = 1852 m give 3437.75 ÷ 1852 ≈ 1.856. Formula collections also write d = 13 H ÷ (7 α′). Valid as long as the foot of the object is on this side of the horizon.')}</p>
${rechner('hw', [{ name: 'h', label: 'H (m)', wert: 40 }, { name: 'a', label: 'α (′)', wert: 25 }], sprache)}
</section>
<section class="kp-fcard"><h3>${t('Relingslogge', "Dutchman's log")}</h3>
<div class="kp-eq">${t('v (kn) = s (m) ÷ (0,51444 · t (s))', 'v (kn) = d (m) ÷ (0.51444 · t (s))')}</div>
<p>${t('Ein Schwimmkörper treibt an einer abgemessenen Strecke an der Reling vorbei. 1 Meridiantertie = 1/3600 sm = 0,51444 m; daher sind Meridiantertien pro Sekunde gleich Knoten. Gerundet: v ≈ 1,94 · s ÷ t. Vor Anker misst die Relingslogge den Strom.',
    'A floating object drifts past a measured distance along the rail. 1/3600 of a nautical mile = 0.51444 m, so these units per second equal knots. Rounded: v ≈ 1.94 · d ÷ t. At anchor the method measures the current.')}</p>
${rechner('rl', [{ name: 's', label: t('Strecke (m)', 'Distance (m)'), wert: 10 }, { name: 't', label: t('Zeit (s)', 'Time (s)'), wert: 3 }], sprache)}
</section>
<section class="kp-fcard"><h3>${t('Rumpfgeschwindigkeit', 'Hull speed')}</h3>
<div class="kp-eq">${t('v (kn) ≈ 1,34 · √LWL (ft)', 'v (kn) ≈ 1.34 · √LWL (ft)')}</div>
<p>${t('LWL Länge der Wasserlinie in Fuß, v in Knoten; metrisch v ≈ 2,43 · √LWL (m). Bei dieser Fahrt ist die eigene Bugwelle so lang wie die Wasserlinie, das Heck sinkt ins Wellental. Ein Verdränger kommt nur mit stark steigender Leistung darüber hinaus. Mit der Länge über alles gerechnet fällt der Wert zu hoch aus.',
    'LWL waterline length in feet, v in knots; metric v ≈ 2.43 · √LWL (m). At this speed the bow wave is as long as the waterline and the stern settles into the trough. A displacement hull goes faster only with steeply rising power. Using length overall gives too high a value.')}</p>
${rechner('rg', [{ name: 'lwl', label: 'LWL (ft)', wert: 45 }], sprache)}
</section>
<section class="kp-fcard"><h3>${t('Kimmabstand und Feuer in der Kimm', 'Distance to the horizon and dipping range')}</h3>
<div class="kp-eq">${t('Kimmabstand: d = 2,075 · √h', 'Horizon: d = 2.075 · √h')}</div>
<div class="kp-eq">${t('Feuer in der Kimm: d = 2,075 · (√H + √h)', 'Light rising/dipping: d = 2.075 · (√H + √h)')}</div>
<p>${t('h Augeshöhe, H Feuerhöhe, beide in m über dem Wasserspiegel; d in sm. Der Faktor enthält die mittlere terrestrische Refraktion. Das Feuer taucht bei Annäherung in der Kimm auf (oder verschwindet bei Entfernung): Mit gleichzeitiger Peilung ergibt das einen Ort. Nur sinnvoll, wenn die Nenntragweite größer ist als die geografische Sichtweite.',
    'h height of eye, H height of the light, both in m above the water; d in NM. The factor includes mean terrestrial refraction. On approach the light rises above the horizon (or dips on departure): with a simultaneous bearing this gives a fix. Only useful when the nominal range is greater than the geographical range.')}</p>
${rechner('ki', [{ name: 'auge', label: t('h Auge (m)', 'h eye (m)'), wert: 2.5 }, { name: 'feuer', label: t('H Feuer (m)', 'H light (m)'), wert: 36 }], sprache)}
</section>
</div>
${quelle(sprache, 'zembra', 'dewiki_relings', 'rumpf', 'kimm')}`;
}

export function ankern(sprache: Sprache): string {
  const t = tFuer(sprache);
  const fig = `<figure class="kp-fig"><svg class="kp-zeichnung" viewBox="0 0 360 180" role="img" aria-label="${t('Ankerkette mit Kettenlinie', 'Anchor chain forming a catenary')}">`
    + '<rect width="360" height="180" fill="var(--panel-2)"/>'
    + '<path d="M0 40 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="var(--muted)" stroke-width="2"/>'
    + `<path d="M0 150 H360 V180 H0 Z" fill="${LAND}"/>`
    + '<path d="M300 38 L340 38 L336 30 L304 30 Z" fill="var(--text)"/>'
    + '<path d="M302 40 C250 140 160 150 60 150" fill="none" stroke="var(--text)" stroke-width="2.4"/>'
    + '<path d="M48 150 L66 150 M54 150 L50 140 M60 150 L64 140" stroke="var(--text)" stroke-width="2.4"/>'
    + '<line x1="320" y1="40" x2="320" y2="150" stroke="var(--gelb)" stroke-width="1" stroke-dasharray="3 3"/>'
    + `<text x="314" y="100" class="kp-l" text-anchor="end">${t('Wassertiefe', 'Depth')}</text>`
    + `<text x="70" y="171" class="kp-l">${t('Ankerkette (schematisch)', 'Anchor chain (schematic)')}</text></svg></figure>`;
  return `
<h2>${t('Ankern', 'Anchoring')}</h2>
<div class="kp-split">${fig}<div class="kp-prosa">
<h3>${t('Wie viel Kette?', 'How much chain?')}</h3>
<p>${t('Die Lehrbücher geben unterschiedliche Faustregeln. Genannt werden zum Beispiel die vierfache Wassertiefe (Schult, Segler-Lexikon), die fünffache und erst ab etwa 20 m die dreifache Wassertiefe (Bobby Schenk) oder Wassertiefe plus 25 bis 35 m, bei viel Wind mehr (Roever).',
    'Textbooks give different rules of thumb. Examples quoted in German sources: four times the depth (Schult, Segler-Lexikon), five times and only from about 20 m three times the depth (Bobby Schenk), or depth plus 25 to 35 m, more in strong wind (Roever).')}</p>
<p>${t('Kritisiert wird, dass diese Regeln Windstärke und Kettengewicht außer Acht lassen. Einig sind sich die Quellen darin, bei viel Wind mehr Kette zu stecken.',
    'Critics point out that these rules ignore wind strength and chain weight. The sources agree that more chain should be veered in strong wind.')}</p>
<h3>${t('Signale', 'Signals')}</h3>
<p>${t('Am Tag ein Ball im Vorschiff, nachts Ankerlichter; bei verminderter Sicht Glockensignal (siehe Lichter & Signalkörper und Schallsignale). Ankern in engen Fahrwassern und Verkehrstrennungsgebieten vermeiden (KVR 9 g, 10 g).',
    'By day a ball in the fore part, at night anchor lights; in restricted visibility the bell signal (see Lights & shapes and Sound signals). Avoid anchoring in narrow channels and traffic separation schemes (Rules 9 (g), 10 (g)).')}</p>
<p>${t('Wassertiefe beim Ankern in Gezeitengewässern: Niedrigwasser während der Liegezeit einrechnen.', 'In tidal waters allow for low water during the time at anchor.')}</p>
</div></div>
${sprache === 'en' ? quelle(sprache, 'blauwasser', 'colregs') : quelle(sprache, 'blauwasser', 'kvr')}`;
}

export function mob(sprache: Sprache): string {
  const t = tFuer(sprache);
  const sofort = sprache === 'en' ? [
    'Shout “Man overboard to port” (or starboard).',
    'One crew member points at the person with an outstretched arm and never loses sight of them.',
    'Throw lifesaving equipment; at night a light buoy, by day a smoke float if available.',
    'Under engine: put the gear in neutral at once and swing the stern away from the person with hard rudder.',
    'If in any doubt about recovering the person yourselves, alert the rescue coordination centre immediately (Mayday).',
  ] : [
    'Laut „Mensch über Bord an Backbord“ (oder Steuerbord) rufen.',
    'Ein Crewmitglied zeigt mit ausgestrecktem Arm ständig auf die Person und lässt sie nicht aus den Augen.',
    'Rettungsmittel werfen; nachts eine Blitzboje, tags eine Rauchboje, falls vorhanden.',
    'Unter Motor: sofort auskuppeln und das Heck mit hartem Ruder von der Person wegdrehen.',
    'Bei Zweifel an der Eigenrettung sofort das Seenotrettungszentrum alarmieren (Mayday).',
  ];
  return `
<h2>${t('Mensch über Bord', 'Man overboard')}</h2>
<div class="kp-drei">
<div><h3>${t('Sofort', 'Immediately')}</h3><ol class="kp-steps">${sofort.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
<div><h3>${t('Manöver unter Segel', 'Manoeuvres under sail')}</h3>
<p>${t('<b>Quickstopp:</b> ohne Segeländerung sofort wenden, mit dichten Segeln im Kreis fahren und beidrehen; die Person wird an der Leeseite aufgenommen. Auch mit kleiner Crew fahrbar.',
    '<b>Quick stop:</b> tack immediately without touching the sheets, sail round in a circle with the sails sheeted in and heave to; the person is picked up on the leeward side. Can be sailed with a small crew.')}</p>
<p>${t('<b>Münchner Manöver:</b> rund drei Schiffslängen am Wind, dann beidrehen und zur Person zurücktreiben lassen. Einhand möglich.',
    '<b>“Münchner Manöver”</b> (German term): about three boat lengths close-hauled, then heave to and drift back to the person. Possible single-handed.')}</p>
<p>${t('<b>Hamburger Manöver:</b> Fock bleibt in der Wende back stehen, Beiliegen mit minimaler Fahrt.',
    '<b>“Hamburger Manöver”</b> (German term): the jib is left backed during the tack; lie hove-to with minimal speed.')}</p>
<p>${t('<b>Unter Maschine</b> (Berufsschifffahrt): Single Turn, Williamson- oder Scharnow-Turn. Alle führen in das eigene Kielwasser zurück.',
    "<b>Under power</b> (merchant ships): single turn, Williamson turn or Scharnow turn, all lead back into the vessel's own wake.")}</p></div>
<div><h3>${t('Bergen', 'Recovery')}</h3>
<p>${t('Von Hand an Bord heben ist praktisch unmöglich; Talje oder Flaschenzug an Fall, Wanten oder Baum verwenden.',
    'Lifting a person aboard by hand is practically impossible; use a tackle on a halyard, the shrouds or the boom.')}</p>
<p>${t('<b>Unterkühlte Personen möglichst waagrecht bergen.</b> Senkrechtes Herausheben kann einen Herzstillstand auslösen.',
    '<b>Recover hypothermic persons in a horizontal position where possible.</b> Lifting vertically can trigger cardiac arrest.')}</p>
<p>${t('Weiter siehe Erste Hilfe.', 'See also First aid.')}</p></div>
</div>
${sprache === 'en' ? '<p class="kp-note">Translated from the German compilation; the manoeuvre descriptions follow the German Wikipedia article.</p>' : ''}
${quelle(sprache, 'wiki_mob', 'imo_cold')}`;
}

export function ersteHilfe(sprache: Sprache): string {
  const t = tFuer(sprache);
  return `
<h2>${t('Erste Hilfe: Person aus kaltem Wasser', 'First aid: person recovered from cold water')}</h2>
<p class="kp-lede">${t('Dieser Abschnitt ersetzt keinen Erste-Hilfe-Kurs. Er gibt die Empfehlungen des IMO-Leitfadens zum Überleben in kaltem Wasser wieder.',
    'This section is no substitute for a first-aid course. It summarises the recommendations of the IMO Guide for Cold Water Survival.')}</p>
<div class="kp-drei">
<div><h3>${t('Bergen', 'Recovery')}</h3><p>${t('Möglichst waagrecht oder annähernd waagrecht bergen. Senkrechtes Herausheben einer unterkühlten Person kann einen Herzstillstand auslösen.',
    'Recover in a horizontal or near-horizontal position where possible. Lifting a hypothermic person vertically out of the water can cause cardiac arrest.')}</p></div>
<div><h3>${t('Ansprechbar', 'Conscious')}</h3><p>${t('Nach kurzer Zeit im Wasser und bei Kältezittern: unter Aufsicht warm duschen oder baden (39–41 °C). Nach längerer Zeit im Wasser: isolieren, damit kein weiterer Wärmeverlust entsteht, statt aktiv aufzuwärmen. Warme, süße Getränke geben, keinen Alkohol.',
    'After a short time in the water and when shivering: a warm shower or bath (39–41 °C) under supervision. After a longer time in the water: insulate to prevent further heat loss rather than actively rewarming. Give warm sweet drinks, no alcohol.')}</p></div>
<div><h3>${t('Nicht ansprechbar', 'Unconscious')}</h3><p>${t('Waagrecht bergen und wie schwer krank behandeln; behutsam in die Seitenlage an einem warmen, geschützten Platz. Atmet die Person nicht: Herz-Lungen-Wiederbelebung beginnen. Immer so bald wie möglich ärztlichen Rat einholen.',
    'Recover horizontally and treat as seriously ill; place gently in the recovery position in a warm, sheltered place. If the person is not breathing, start cardiopulmonary resuscitation. Always seek medical advice as soon as possible.')}</p></div>
</div>
${quelle(sprache, 'imo_cold', 'dflagge')}`;
}

export function quellenAbschnitt(sprache: Sprache): string {
  const t = tFuer(sprache);
  const liste = Object.values(quellen(sprache))
    .map(([titel, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(titel)}</a></li>`).join('');
  return `
<h2>${t('Quellen und Lizenzen', 'Sources and licences')}</h2>
<div class="kp-prosa">
${sprache === 'en' ? '<p>Where an English primary source exists, this edition uses its wording: COLREGs, International Code of Signals (Pub. 102), NOAA/WMO, IALA and the List of Lights. Flag etiquette, the Austrian flag law and some formula sources are German; those passages are translations.</p>' : ''}
<p>${t('Alle Zeichnungen sind eigene Arbeit. Die Weltkarte beruht auf Natural Earth (gemeinfrei, über das Paket world-atlas, ISC-Lizenz). Gesetzestexte (KVR, SeeSchFG) sind amtliche Werke; Pub. 102, Pub. 116 und Chart No. 1 sind Werke der US-Regierung ohne Urheberrechtsanspruch. Die ASR- und IALA-Tabellen sind wörtlich bzw. sinngemäß mit Quellenangabe übernommen.',
    'All drawings are original work. The world map is based on Natural Earth (public domain, via the world-atlas package, ISC licence). Pub. 102, Pub. 116 and Chart No. 1 are US government works with no copyright claimed.')}</p>
<p>${t('Das Kompendium ist eine Nachschlagehilfe. Es ersetzt weder den Text der KVR noch Seekarte, Leuchtfeuerverzeichnis oder Gezeitentafel. Stand der Recherche: 1. Oktober 2026.',
    'The compendium is a reference aid. It does not replace the text of the COLREGs, the chart, the List of Lights or the tide tables. Research as of 1 October 2026.')}</p>
</div>
<ul class="kp-srclist">${liste}</ul>`;
}
