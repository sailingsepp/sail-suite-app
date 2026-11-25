import { tFuer, quelle } from './bausteine';
import { esc } from './svg';
import {
  zeichnungAuftriebWiderstand, zeichnungKraefte, zeichnungWindgradient, zeichnungSpalt, zeichnungStabilitaet,
  zeichnungHebelarm, zeichnungLangkiel, zeichnungFlosse, zeichnungDruckpunkte, zeichnungGierig, zeichnungAnstellwinkel,
  zeichnungProfiltiefe, zeichnungTwist, zeichnungBedienung, zeichnungHolepunkt, zeichnungTelltales, zeichnungKurs,
  zeichnungVorsegel,
} from './segelZeichnungen';
import type { Sprache } from '@/core/types';

const fig = (svg: string, unterschrift: string, breit = true) =>
  `<figure class="kp-fig${breit ? ' kp-fig-breit' : ''}">${svg}<figcaption class="kp-small">${unterschrift}</figcaption></figure>`;

const liste = (punkte: string[]) => `<ul>${punkte.map((p) => `<li>${p}</li>`).join('')}</ul>`;

export function segeltheorie(sprache: Sprache): string {
  const t = tFuer(sprache);
  return `
<h2>${t('Wie ein Segel zieht', 'How a sail drives')}</h2>
<p class="kp-lede">${t(
    'Ein Segel lenkt den Wind um. Die Kraft, die dabei entsteht, zieht die Yacht nur zum Teil nach vorn; den Rest fangen Kiel und Ruder auf. Wer die Kräfte kennt, versteht, warum Trimm, Krängung und Ruderdruck zusammenhängen.',
    'A sail turns the wind. Only part of the resulting force pulls the boat forward; the keel and rudder take up the rest. Knowing the forces explains why trim, heel and weather helm belong together.')}</p>

<h3>${t('Auftrieb und Widerstand', 'Lift and drag')}</h3>
${fig(zeichnungAuftriebWiderstand(t), t(
    'Am Wind liegt die Strömung auf beiden Seiten an: Überdruck in Luv (+), Sog in Lee (−). Vor dem Wind reißt sie ab, das Segel staut den Wind.',
    'Upwind the flow stays attached on both sides: higher pressure to windward (+), suction to leeward (−). Downwind the flow separates and the sail blocks the wind.'))}
<p>${t(
    'Von etwa 40° bis 135° zum Wind arbeitet das Segel wie ein Tragflügel und erzeugt Auftrieb. Am Wind trägt der Sog auf der Leeseite den größeren Teil der Kraft. Weiter achterlich reißt die Strömung ab, und vor dem Wind treibt das Segel vor allem durch seinen Luftwiderstand. Dann zählt die Fläche quer zum Wind.',
    'From about 40° to 135° off the wind the sail works like a wing and produces lift. Close-hauled, the suction on the leeward side supplies most of the force. Further aft the flow separates, and on a run the sail drives mainly through its drag. Then the area presented to the wind is what counts.')}</p>

<h3>${t('Gesamtkraft, Vortrieb und Querkraft', 'Total force, drive and side force')}</h3>
${fig(zeichnungKraefte(t), t(
    'Am Wind auf Steuerbordbug. Die Gesamtkraft im Segeldruckpunkt (SD) zerfällt in Vortrieb und Querkraft; unter Wasser halten Lateralwiderstand und Rumpfwiderstand dagegen.',
    'Close-hauled on starboard tack. The total force at the centre of effort splits into drive and side force; under water, lateral resistance and hull drag oppose them.'))}
<p>${t(
    'Alle Kräfte am Segel lassen sich im Segeldruckpunkt zu einer Gesamtkraft zusammenfassen. Am Wind steht sie fast quer zur Fahrtrichtung. In Fahrtrichtung zerlegt ergibt sie den Vortrieb, quer dazu die Querkraft. Die Querkraft krängt das Schiff und versetzt es nach Lee (Abdrift). Kiel und Ruder halten mit dem Lateralwiderstand dagegen; so bleibt vom Segelzug der Vortrieb als Fahrt übrig. Dem Vortrieb wirken der Widerstand von Rumpf und Rigg entgegen. Bei gleichbleibender Fahrt halten sich beide die Waage.',
    'All the forces on the sail can be combined into one total force acting at the centre of effort. Close-hauled it points almost at right angles to the course. Resolved along the course it gives the drive, across it the side force. The side force heels the boat and pushes it to leeward (leeway). The keel and rudder resist it with lateral resistance, so the drive is what remains as boat speed. Hull and rig drag oppose the drive; at constant speed the two balance.')}</p>

<h3>${t('Scheinbarer Wind über die Höhe', 'Apparent wind with height')}</h3>
${fig(zeichnungWindgradient(t), t(
    'Links: Reibung an der Wasseroberfläche bremst den Wind, nach oben nimmt er zu. Rechts: Der Fahrtwind ist überall gleich, darum fällt der scheinbare Wind oben raumer und stärker ein.',
    'Left: friction at the surface slows the wind, which increases with height. Right: the wind from the boat’s motion is the same at every height, so aloft the apparent wind is stronger and comes from further aft.'))}
<p>${t(
    'Direkt über dem Wasser ist der Wind durch Reibung schwächer als in Masthöhe (Windgradient). Der Fahrtwind ist über die ganze Höhe gleich. Der scheinbare Wind kommt deshalb im Topp raumer ein als an Deck. Damit das Segel überall im passenden Winkel angeströmt wird, muss es oben weiter offen stehen: Twist. Ein offenes Achterliek oben verringert zugleich den Druckausgleich an der Segelspitze.',
    'Close to the water, friction makes the wind weaker than at masthead height (wind gradient). The wind from the boat’s motion is the same at all heights. At the masthead the apparent wind therefore comes from further aft than at deck level. For the sail to meet the wind at the right angle all the way up, it has to open towards the top: twist. An open upper leech also reduces the flow around the head of the sail.')}</p>

<h3>${t('Vorsegel und Großsegel wirken zusammen', 'Headsail and mainsail work together')}</h3>
${fig(zeichnungSpalt(t), t(
    'Das Groß lenkt die Anströmung vor dem Vorsegel nach Luv (Upwash). Im Spalt wird die Luft langsamer.',
    'The main bends the flow ahead of the headsail to windward (upwash). In the slot the air slows down.'))}
<p>${t(
    'Die oft gehörte Erklärung, der Spalt zwischen Vorsegel und Groß beschleunige die Luft wie eine Düse, ist widerlegt (Gentry). Das Großsegel lenkt die Strömung vor dem Vorsegel nach Luv: Das Vorsegel wird raumer angeströmt, sein Zug zeigt weiter nach vorn, und die Yacht kann höher am Wind laufen. Im Spalt wird die Luft langsamer und der Druck steigt; das Groß reißt dadurch später ab und lässt sich relativ zum Vorsegel dichter fahren. An seinem Achterliek strömt die Luft des Vorsegels schneller ab.',
    'The familiar explanation that the slot between headsail and main speeds the air up like a nozzle has been disproved (Gentry). The mainsail bends the flow ahead of the headsail to windward: the headsail sees a freer wind, its force points further forward, and the boat can point higher. In the slot the air slows down and its pressure rises, so the main stalls later and can be sheeted closer relative to the headsail. Air leaves the headsail leech faster.')}</p>
<p>${t(
    'Für den Trimm folgt daraus: Beide Segel bilden ein gemeinsames Profil. Ein falsch getrimmtes Vorsegel stört die Strömung am Groß; zuerst das Vorsegel einstellen, dann mit dem Groß fein trimmen.',
    'For trimming this means the two sails form one profile. A badly trimmed headsail disturbs the flow over the main; set the headsail first, then fine-tune with the main.')}</p>
${quelle(sprache, 'forces_sails', 'genua_gentry', 'windgradient', 'points_sail')}`;
}

export function stabilitaet(sprache: Sprache): string {
  const t = tFuer(sprache);
  const vermindern = sprache === 'en'
    ? ['reduce heel: ease the mainsheet or drop the traveller to leeward, reef', 'flatten or reef the mainsail', 'set more headsail (unroll the genoa)', 'move crew weight to windward']
    : ['Krängung verringern: Großschot fieren oder Traveller nach Lee, reffen', 'Großsegel flacher trimmen oder reffen', 'mehr Vorsegel setzen (Genua weiter ausrollen)', 'Gewicht nach Luv'];
  const erhoehen = sprache === 'en'
    ? ['reduce the headsail (roll some in)', 'set more mainsail, trim it fuller', 'traveller to windward']
    : ['Vorsegel verkleinern (teilweise einrollen)', 'mehr Großsegel setzen, bauchiger trimmen', 'Traveller nach Luv'];
  return `
<h2>${t('Stabilität und Balance', 'Stability and balance')}</h2>
<p class="kp-lede">${t(
    'Die Querkraft der Segel krängt die Yacht und versucht sie zu drehen. Wie gut sie sich wieder aufrichtet, entscheidet die Stabilität; wie sie sich am Ruder anfühlt, die Lage von Segeldruckpunkt und Lateraldruckpunkt.',
    'The side force of the sails heels the boat and tries to turn it. Stability decides how well she comes upright again; the positions of the centre of effort and the centre of lateral resistance decide how she feels on the helm.')}</p>

<h3>${t('Form- und Gewichtsstabilität', 'Form and weight stability')}</h3>
${fig(zeichnungStabilitaet(t), t(
    'Gewicht wirkt im Schwerpunkt G nach unten, Auftrieb im Auftriebsschwerpunkt B nach oben. Ihr waagerechter Abstand ist der aufrichtende Hebel GZ.',
    'Weight acts downwards at the centre of gravity G, buoyancy upwards at the centre of buoyancy B. Their horizontal distance is the righting lever GZ.'))}
<p>${t(
    'Krängt ein Schiff, wandert der Auftriebsschwerpunkt B zur eingetauchten Seite. Gewicht und Auftrieb bilden dann ein aufrichtendes Moment. Eine breite, flache Jolle richtet sich vor allem durch ihre Form auf (Formstabilität): Schon bei wenig Krängung wandert B weit nach außen, die Crew sitzt dazu nach Luv aus. Eine Kielyacht richtet sich vor allem durch den tief liegenden Ballast auf (Gewichtsstabilität): Ihr Schwerpunkt liegt tief, und der Hebel wächst mit der Krängung weiter. Jede Yacht hat beides, in unterschiedlichem Anteil.',
    'When a boat heels, the centre of buoyancy B moves towards the immersed side, and weight and buoyancy form a righting moment. A wide, flat dinghy comes upright mainly through its shape (form stability): even at small angles B moves far outboard, and the crew hikes out to windward. A keelboat comes upright mainly through ballast low down (weight stability): her centre of gravity is low, and the lever keeps growing with heel. Every yacht has both, in different proportions.')}</p>

<h3>${t('Hebelarmkurve', 'Righting lever curve')}</h3>
${fig(zeichnungHebelarm(t), t('Aufrichtender Hebel über der Krängung, schematisch.', 'Righting lever against heel angle, schematic.'))}
<p>${t(
    'Die Hebelarmkurve zeigt den aufrichtenden Hebel über dem Krängungswinkel. Formstabile Boote steigen steil an (hohe Anfangsstabilität) und fallen früh ab; bei üblichen Jollen liegt der Kenterpunkt bei rund 90°. Ballastkieler beginnen flacher, ihr größter Hebel liegt meist zwischen 40° und 80°, und sie richten sich noch weit darüber hinaus auf. Für Hochseeyachten gilt ein Stabilitätsumfang von 120° oder mehr als Faustwert. Die Kurve beschreibt ruhiges Wasser: Brechende Seen, eingedrungenes Wasser und verrutschende Lasten verkleinern die Stabilität.',
    'The righting lever curve plots the righting lever against heel angle. Boats that rely on form rise steeply (high initial stability) and fall away early; for ordinary dinghies the capsize point is around 90°. Ballasted keelboats start more gently, reach their largest lever usually between 40° and 80°, and still right themselves well beyond that. A limit of positive stability of 120° or more is a common rule of thumb for offshore yachts. The curve describes calm water: breaking seas, water below and shifting loads all reduce stability.')}</p>

<h3>${t('Lateralplan', 'Lateral plane')}</h3>
<div class="kp-split">${fig(zeichnungLangkiel(t), t('Langkieler: Kiel über einen großen Teil der Länge, Ruder am Kiel.', 'Long keel: keel along much of the length, rudder hung on the keel.'), false)}
${fig(zeichnungFlosse(t), t('Flossenkiel und freistehendes Spatenruder.', 'Fin keel and free-standing spade rudder.'), false)}</div>
<p>${t(
    'Der Lateralplan ist die Seitenansicht des Unterwasserschiffs; er hält gegen die Abdrift. Ein langgestreckter Lateralplan läuft kursstabil, ist im Manöver aber träge und dreht auf engem Raum schlecht. Ein beschnittener Lateralplan mit Flossenkiel und Spatenruder macht die Yacht wendig und schneller, verlangt aber mehr Aufmerksamkeit am Ruder. Bei starker Krängung steht der Kiel schräg im Wasser und hält weniger dagegen; die Abdrift nimmt zu.',
    'The lateral plane is the side view of the underwater body; it resists leeway. A long keel tracks well but is slow to manoeuvre and turns poorly in tight spaces. A cut-away profile with fin keel and spade rudder makes the boat nimble and faster, but she needs more attention on the helm. When heeled hard, the keel stands at an angle and resists less; leeway increases.')}</p>

<h3>${t('Segeldruckpunkt und Lateraldruckpunkt', 'Centre of effort and centre of lateral resistance')}</h3>
${fig(zeichnungDruckpunkte(t), t(
    'Geometrisch: SD als Flächenschwerpunkt der Segel, LD als Flächenschwerpunkt des Lateralplans (hier berechnet). Der SD liegt ein Stück vor dem LD.',
    'Geometrically: the centre of effort as the centroid of the sails, the centre of lateral resistance as the centroid of the lateral plane (computed here). The centre of effort lies a little ahead.'))}
<p>${t(
    'Im Segeldruckpunkt (SD) greift die Gesamtkraft der Segel an, im Lateraldruckpunkt (LD) der Widerstand des Unterwasserschiffs gegen die Abdrift. Für die Konstruktion nimmt man die Flächenschwerpunkte von Segelplan und Lateralplan. Im Betrieb liegen die Druckpunkte anders und wandern mit Anstellwinkel, Trimm und Krängung; bei größerem Anstellwinkel rückt der Druckpunkt eines Profils nach vorn. Konstrukteure legen den SD deshalb ein Stück vor den LD (Vorlauf), damit die Yacht unter Segeln leicht luvgierig wird.',
    'The total force of the sails acts at the centre of effort (CE), the resistance of the underwater body against leeway at the centre of lateral resistance (CLR). Designers use the centroids of the sail plan and the lateral plane. The real centres of pressure lie elsewhere and move with angle of attack, trim and heel; at a larger angle of attack a profile’s centre of pressure moves forward. Designers therefore place the CE a little ahead of the CLR (lead), so that the boat carries slight weather helm under sail.')}</p>

<h3>${t('Luvgierig und leegierig', 'Weather helm and lee helm')}</h3>
${fig(zeichnungGierig(t), t(
    'Links: Querkraft im SD und Lateralwiderstand im LD bilden ein Drehmoment. Rechts: Bei Krängung rückt der Vortrieb nach Lee und dreht die Yacht nach Luv.',
    'Left: side force at the CE and lateral resistance at the CLR form a turning moment. Right: when heeled, the drive moves to leeward and turns the boat to windward.'))}
<p>${t(
    'Luvgierig ist eine Yacht, die bei Ruder mittschiffs anluvt, leegierig eine, die dabei abfällt. Liegt der SD vor dem LD, drehen Querkraft und Lateralwiderstand den Bug nach Lee; liegt er dahinter, nach Luv. Krängt die Yacht, rückt der Vortrieb aus der Mittschiffslinie nach Lee. Mit dem Widerstand des Rumpfs bildet er ein Drehmoment nach Luv: Mit zunehmender Krängung wird jede Yacht luvgieriger.',
    'A boat with weather helm turns into the wind with the rudder amidships; one with lee helm bears away. If the CE lies ahead of the CLR, side force and lateral resistance turn the bow to leeward; if it lies behind, to windward. When the boat heels, the drive moves to leeward of the centreline and forms a turning moment to windward with the hull drag: every boat gets more weather helm as she heels.')}</p>
<p>${t(
    'Leicht luvgierig ist erwünscht: Die Yacht lässt sich mit Gefühl steuern und schießt in den Wind, wenn das Ruder losgelassen wird. Braucht es dauernd viel Gegenruder, bremst das Ruderblatt.',
    'Slight weather helm is wanted: the boat has feel on the helm and rounds up into the wind if the helm is let go. If she constantly needs a lot of rudder, the blade acts as a brake.')}</p>
<div class="kp-split"><div><h4>${t('Luvgierigkeit verringern', 'Reduce weather helm')}</h4>${liste(vermindern)}</div>
<div><h4>${t('Luvgierigkeit erhöhen', 'Increase weather helm')}</h4>${liste(erhoehen)}</div></div>
${quelle(sprache, 'kentern', 'gz_kurve', 'lateralplan', 'luvgierig', 'segeldruckpunkt')}`;
}

export function segeltrimm(sprache: Sprache): string {
  const t = tFuer(sprache);
  const en = sprache === 'en';
  const bedienung: [string, string][] = en ? [
    ['Halyard', 'luff tension, mainly in the upper part; moves the draft forward'],
    ['Cunningham', 'luff tension low down; pulls the draft forward and flattens the sail'],
    ['Outhaul', 'foot tension; depth of the lower part of the mainsail'],
    ['Mainsheet', 'angle of attack and, close-hauled, leech tension (twist)'],
    ['Traveller', 'boom position and so angle of attack; to leeward reduces heel and weather helm'],
    ['Boom vang', 'holds the boom down; controls twist when the sheet is eased'],
    ['Backstay', 'mast bend and forestay tension: flatter main, less forestay sag, flatter headsail'],
    ['Jib sheet', 'angle of attack of the headsail'],
    ['Jib lead', 'balance between foot and leech, i.e. headsail twist'],
  ] : [
    ['Fall', 'Vorliekspannung, vor allem oben; holt den Bauch nach vorn'],
    ['Cunningham', 'Vorliekspannung unten; holt den Bauch nach vorn und flacht das Segel ab'],
    ['Unterliekstrecker', 'Unterliekspannung; Profiltiefe im unteren Teil des Groß'],
    ['Großschot', 'Anstellwinkel und, am Wind, Spannung des Achterlieks (Twist)'],
    ['Traveller', 'Baumstellung und damit Anstellwinkel; nach Lee weniger Krängung und Ruderdruck'],
    ['Baumniederholer', 'hält den Baum unten; steuert den Twist, wenn die Schot gefiert ist'],
    ['Achterstag', 'Mastbiegung und Vorstagspannung: flacheres Groß, weniger Vorstagdurchhang, flacheres Vorsegel'],
    ['Vorschot', 'Anstellwinkel des Vorsegels'],
    ['Holepunkt', 'Verteilung zwischen Unterliek und Achterliek, also der Twist des Vorsegels'],
  ];
  const kurse: [number, string, string, string[]][] = [
    [45, t('Hart am Wind', 'Close-hauled'), t('um 45° zum wahren Wind', 'about 45° to the true wind'), en ? [
      'Main and headsail sheeted in; the top batten roughly parallel to the boom.',
      'In light air: traveller to windward, mainsheet eased slightly, sails fuller.',
      'As the wind builds: backstay, cunningham and outhaul harder, traveller down to leeward, more twist.',
      'Most common mistake: sails too tight. The boat gets weather helm and the rudder brakes.',
    ] : [
      'Groß und Vorsegel dicht; die oberste Latte etwa parallel zum Baum.',
      'Bei wenig Wind: Traveller nach Luv, Großschot etwas fieren, Segel bauchiger.',
      'Bei zunehmendem Wind: Achterstag, Cunningham und Unterliek dichter, Traveller nach Lee, mehr Twist.',
      'Häufigster Fehler: Segel zu dicht. Die Yacht wird luvgierig, das Ruder bremst.',
    ]],
    [90, t('Halbwind', 'Beam reach'), t('90° zum wahren Wind', '90° to the true wind'), en ? [
      'Ease the sheets until the luff is just not lifting.',
      'Set twist with the vang so that the leech telltales stream.',
      'Ease the backstay; move the jib lead forward and outboard.',
    ] : [
      'Schoten fieren, bis das Vorliek gerade nicht killt.',
      'Twist mit dem Niederholer so einstellen, dass die Achterliek-Telltales auswehen.',
      'Achterstag lösen; Holepunkt nach vorn und nach außen.',
    ]],
    [135, t('Raumschots', 'Broad reach'), t('um 135° zum wahren Wind', 'about 135° to the true wind'), en ? [
      'Ease further, deeper profile: outhaul, cunningham and backstay off.',
      'The vang keeps the boom from rising; in strong wind more twist takes power out of the top.',
      'Bearing away too far puts the headsail in the wind shadow of the main.',
    ] : [
      'Weiter fieren, tieferes Profil: Unterliek, Cunningham und Achterstag lose.',
      'Der Niederholer verhindert, dass der Baum steigt; bei Starkwind nimmt mehr Twist oben Druck heraus.',
      'Zu weit abgefallen, gerät das Vorsegel in den Windschatten des Groß.',
    ]],
    [180, t('Vor dem Wind', 'Running'), t('Schmetterling mit Bullenstander', 'goose-winged with a preventer'), en ? [
      'Sheets well eased, vang down.',
      'Headsail on the side opposite the main (goose-winged), poled out if possible.',
      'A preventer guards against an accidental gybe: from the boom end via a block on the foredeck back to the cockpit, so it can be released from there. Release it before every manoeuvre.',
      'The boom is held by three lines: the sheet aft, the topping lift up, the vang down.',
    ] : [
      'Schoten weit fieren, Niederholer durchsetzen.',
      'Vorsegel auf der anderen Seite als das Groß (Schmetterling), wenn möglich ausgebaumt.',
      'Ein Bullenstander sichert gegen die Patenthalse: von der Baumnock über einen Block auf dem Vorschiff zurück in die Plicht, damit er von dort gelöst werden kann. Vor jedem Manöver lösen.',
      'Der Baum hängt an drei Leinen: Schot nach achtern, Dirk nach oben, Niederholer nach unten.',
    ]],
  ];
  const kurskarten = kurse.map(([w, titel, unter, punkte]) => `<div class="kp-karte">${zeichnungKurs(t, w, `${titel}: ${unter}`)}`
    + `<h3>${titel} <span class="kp-regel">${unter}</span></h3>${liste(punkte)}</div>`).join('');
  return `
<h2>${t('Segeltrimm', 'Sail trim')}</h2>
<p class="kp-lede">${t(
    'Trimmen heißt, Form und Stellung der Segel so einzustellen, dass sie bei vertretbarer Krängung möglichst viel Vortrieb liefern. Am Wind geht es um das Verhältnis von Auftrieb zu Widerstand, vor dem Wind um viel Fläche quer zum Wind.',
    'Trimming means setting the shape and angle of the sails so that they give as much drive as possible at an acceptable angle of heel. Upwind the aim is a good ratio of lift to drag; downwind it is plenty of area across the wind.')}</p>

<h3>${t('Bedienelemente', 'Controls')}</h3>
${fig(zeichnungBedienung(t), t('Am Wind auf Steuerbordbug. Farbig: die Trimmleinen.', 'Close-hauled on starboard tack. In colour: the trim lines.'))}
<div class="kp-tw"><table class="kp-data"><thead><tr><th scope="col">${t('Bedienelement', 'Control')}</th><th scope="col">${t('wirkt auf', 'acts on')}</th></tr></thead>
<tbody>${bedienung.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>

<h3>${t('Anstellwinkel', 'Angle of attack')}</h3>
${fig(zeichnungAnstellwinkel(t), t(
    'Wind von links. Gestrichelt die Sehne, die Linie vom Vorliek zum Achterliek.',
    'Wind from the left. Dashed: the chord, the line from luff to leech.'))}
<p>${t(
    'Der Anstellwinkel ist der Winkel zwischen scheinbarem Wind und Profilsehne. Zu dicht gefahren reißt die Strömung in Lee ab: Die Krängung steigt, die Fahrt sinkt. Zu offen killt das Segel am Vorliek und baut keinen Druck auf. Am Groß stellen Schot und Traveller den Anstellwinkel ein, am Vorsegel die Schot.',
    'The angle of attack is the angle between the apparent wind and the chord. Over-trimmed, the flow separates on the leeward side: heel goes up, speed goes down. Under-trimmed, the sail lifts at the luff and builds no pressure. On the main the sheet and traveller set the angle of attack, on the headsail the sheet.')}</p>

<h3>${t('Twist', 'Twist')}</h3>
${fig(zeichnungTwist(t), t('Blick von oben auf das Großsegel: Schnitte in vier Höhen.', 'Looking down on the mainsail: sections at four heights.'))}
<p>${t(
    'Twist ist die Verdrehung des Achterlieks über die Höhe: Oben steht das Segel weiter offen als unten. Er passt das Segel an den scheinbaren Wind an, der oben raumer einfällt. Am Wind steuert ihn die Großschot, mit gefierter Schot der Niederholer: Je loser, desto mehr Twist. Richtig eingestellt wehen die Telltales am Achterliek aus, und das oberste klappt gelegentlich nach Lee weg. Wehen alle aus, ist zu viel Twist im Segel, klappen alle weg, zu wenig. Wenig Twist bringt Höhe; mehr Twist nimmt oben Druck heraus, senkt den Segeldruckpunkt und verringert die Krängung.',
    'Twist is the way the leech turns with height: the sail stands more open at the top than at the foot. It matches the sail to the apparent wind, which comes from further aft aloft. Close-hauled the mainsheet controls it, with the sheet eased the vang: the looser, the more twist. Set right, the leech telltales stream and the top one occasionally folds away to leeward. If all of them stream there is too much twist, if all fold away too little. Little twist helps pointing; more twist takes power out of the top, lowers the centre of effort and reduces heel.')}</p>

<h3>${t('Profiltiefe und Bauchlage', 'Depth and draft position')}</h3>
${fig(zeichnungProfiltiefe(t), t('Richtwerte für das Großsegel nach Dellenbaugh.', 'Guide values for the mainsail after Dellenbaugh.'))}
<p>${t(
    'Die Profiltiefe a ist die größte Wölbung, gemessen an der Sehne b. Richtwerte für das Groß: bei Leichtwind 13–16 %, bei Mittelwind 11–13 %, bei Starkwind 9–12 %, der Scheitel etwa 45–50 % hinter dem Vorliek. Ein bauchiges Segel liefert viel Kraft, aber weniger Höhe; ein flaches weniger Kraft, mehr Höhe und weniger Krängung. Liegt der Bauch weiter vorn, ist das Segel gutmütig und verzeiht Steuerfehler und Wellen; liegt er weiter hinten, läuft es höher, reißt aber leichter ab.',
    'Depth a is the largest camber, measured against the chord b. Guide values for the main: light air 13–16%, medium 11–13%, heavy air 9–12%, with the deepest point about 45–50% aft of the luff. A full sail gives plenty of power but less pointing; a flat one less power, better pointing and less heel. With the draft further forward the sail is forgiving of steering errors and waves; further aft it points higher but stalls more easily.')}</p>
<p>${t(
    'Flacher wird das Groß mit Achterstag (Mastbiegung), Unterliekstrecker, Cunningham und Niederholer. Den Bauch nach vorn holen Cunningham und Fall. Querfalten am Vorliek zeigen zu wenig Spannung von Fall oder Cunningham, eine Längsfalte entlang des Vorlieks zu viel.',
    'The main is flattened with the backstay (mast bend), outhaul, cunningham and vang. Cunningham and halyard pull the draft forward. Horizontal wrinkles from the luff show too little halyard or cunningham tension; a vertical crease along the luff shows too much.')}</p>

<h3>${t('Holepunkt der Vorschot', 'Jib lead position')}</h3>
${fig(zeichnungHolepunkt(t), t('Gestrichelt: der Schotzug, verlängert bis zum Vorliek.', 'Dashed: the line of the sheet, extended to the luff.'))}
<p>${t(
    'Der Holepunkt verteilt den Schotzug auf Unterliek und Achterliek. Weiter vorn schließt sich das Achterliek, das Unterliek wird bauchiger: mehr Kraft, zum Beispiel in Welle. Weiter achtern öffnet sich das Achterliek, oben twistet das Segel ab, das Unterliek wird flach: weniger Krängung bei viel Wind und glattem Wasser. Prüfen lässt sich die Stellung beim langsamen Anluven. Killt das Vorliek oben zuerst, kommt der Holepunkt nach vorn, killt es unten zuerst, nach achtern; richtig ist er, wenn es über die ganze Höhe gleichzeitig einfällt. Wird die Schot auf raumen Kursen gefiert, steigt das Schothorn und das Achterliek öffnet sich; dann gehört der Holepunkt nach vorn und nach außen.',
    'The lead divides the sheet load between foot and leech. Further forward the leech closes and the foot gets fuller: more power, for example in waves. Further aft the leech opens, the top twists off and the foot flattens: less heel in strong wind and flat water. Check the position by luffing slowly. If the luff lifts first at the top, move the lead forward; if it lifts first at the bottom, move it aft. It is right when the whole luff breaks at once. When the sheet is eased on a reach the clew rises and the leech opens; the lead then goes forward and outboard.')}</p>

<h3>${t('Telltales', 'Telltales')}</h3>
${fig(zeichnungTelltales(t), t('Fäden paarweise am Vorliek, je einer in Luv und in Lee.', 'Yarns in pairs near the luff, one on each side.'))}
<p>${t(
    'Paarweise Fäden am Vorliek zeigen die Strömung. Wehen beide waagerecht nach achtern, stimmt der Trimm. Flattert oder steigt der Luvfaden, ist das Segel zu offen oder die Yacht zu hoch am Wind: dichter holen oder abfallen. Flattert oder steigt der Leefaden, ist die Strömung in Lee abgerissen: fieren oder anluven. Bei sehr wenig Wind hängen die Fäden schlaff und zeigen nichts.',
    'Pairs of yarns near the luff show the flow. If both stream straight aft, the trim is right. If the windward yarn flutters or lifts, the sail is too open or the boat too close to the wind: trim in or bear away. If the leeward yarn flutters or lifts, the flow has separated on the leeward side: ease or luff up. In very light air the yarns hang limp and show nothing.')}</p>

<h3>${t('Trimm je Kurs', 'Trim by point of sail')}</h3>
<div class="kp-raster kp-raster-260">${kurskarten}</div>

<h3>${t('Vorsegelgrößen', 'Headsail sizes')}</h3>
${fig(zeichnungVorsegel(t), t('Die Größe eines Vorsegels wird als Überlappung LP/J angegeben.', 'Headsail size is given as the overlap LP/J.'))}
<p>${t(
    'Eine Genua überlappt das Groß (LP/J über 100 %), eine Fock nicht. Kleinere Vorsegel sind meist flacher geschnitten. Für Regatten nach den Offshore Special Regulations von World Sailing darf eine Sturmfock höchstens 5 % von I² messen, ihr Vorliek muss kürzer sein als 65 % von I. Eine teilweise eingerollte Genua steht bauchiger und weniger gut als ein kleineres Vorsegel: Für denselben Vortrieb krängt die Yacht stärker.',
    'A genoa overlaps the main (LP/J above 100%), a jib does not. Smaller headsails are usually cut flatter. For races under the World Sailing Offshore Special Regulations a storm jib may measure at most 5% of I², with a luff shorter than 65% of I. A partly furled genoa sets fuller and worse than a smaller headsail: for the same drive the boat heels more.')}</p>
${quelle(sprache, 'segeltrimm', 'forces_sails', 'traveller', 'cunningham', 'niederholer', 'uksm_genua', 'telltale', 'bullenstander', 'genua_gentry', 'uksm_sturm')}`;
}
