import { windBand, beaufortUntergrenzeKn } from '@/briefing/wind';
import type { Sprache } from '@/core/types';





export interface BeaufortZeile {
  stufe: number;
  
  name: string;
  kn: string;
  
  welle: string;
  see: string;
}

const KN = ['< 1', '1–3', '4–6', '7–10', '11–16', '17–21', '22–27', '28–33', '34–40', '41–47', '48–55', '56–63', '≥ 64'];


const SEE_DE: readonly [string, string][] = [
  ['0', 'spiegelglatte See'],
  ['0,1', 'kleine schuppenförmig aussehende Kräuselwellen ohne Schaumkämme'],
  ['0,2', 'kleine Wellen, noch kurz, aber ausgeprägter; die Kämme sehen glasig aus und brechen nicht'],
  ['0,6', 'die Kämme beginnen zu brechen, der Schaum ist glasig, vereinzelt können kleine weiße Schaumköpfe auftreten'],
  ['1', 'die Wellen sind zwar noch klein, werden aber länger; weiße Schaumköpfe treten schon ziemlich verbreitet auf'],
  ['2', 'mäßige Wellen, die eine ausgeprägte lange Form annehmen; weiße Schaumkämme bilden sich in großer Zahl, vereinzelt kann schon etwas Gischt vorkommen'],
  ['3', 'Bildung großer Wellen beginnt; überall treten ausgedehnte weiße Schaumkämme auf, häufig mit Gischt'],
  ['4', 'die See türmt sich auf; der beim Brechen der Wellen entstehende weiße Schaum beginnt sich in Streifen in Windrichtung zu legen'],
  ['5,5', 'mäßig hohe Wellenberge von beträchtlicher Länge; die Kanten der Kämme beginnen zu Gischt zu verwehen; gut ausgeprägte Schaumstreifen'],
  ['7', 'hohe Wellenberge, dichte Schaumstreifen; das bekannte „Rollen“ der See beginnt; die Gischt kann die Sicht beeinträchtigen'],
  ['9', 'sehr hohe Wellenberge mit langen überbrechenden Kämmen; die entstehenden Schaumflächen werden in so dichten weißen Streifen in Richtung des Windes geweht, dass die Meeresoberfläche im Ganzen weiß aussieht; das Rollen der See wird schwer und stoßartig; die Sicht ist beeinträchtigt'],
  ['11,5', 'außergewöhnlich hohe Wellenberge; kleine und mittelgroße Schiffe zeitweise hinter Wellenbergen verdeckt; die See ist völlig von langen weißen Schaumflächen bedeckt. Überall werden die Kanten der Wellenkämme zu Gischt verweht; die Sicht ist stark herabgesetzt'],
  ['> 14', 'die Luft ist mit Schaum und Gischt angefüllt; die See ist vollständig weiß von treibender Gischt; die Sicht ist sehr stark herabgesetzt'],
];


const SEE_EN: readonly [string, string][] = [
  ['0', 'Sea like a mirror.'],
  ['0.1', 'Ripples with the appearance of scales are formed, but without foam crests.'],
  ['0.2', 'Small wavelets, still short but more pronounced; crests have a glassy appearance and do not break.'],
  ['0.6', 'Large wavelets. Crests begin to break. Foam of glassy appearance.'],
  ['1', 'Small waves, becoming longer.'],
  ['2', 'Moderate waves, taking a more pronounced long form. (Chance of some spray.)'],
  ['3', 'Large waves begin to form; the white foam crests are more extensive everywhere.'],
  ['4', 'Sea heaps up and white foam from breaking waves begins to be blown in streaks.'],
  ['5.5', 'Moderately high waves of greater length; edges of crests begin to break into spindrift.'],
  ['7', 'High waves. Dense streaks of foam along the direction of the wind. Crests of waves begin to topple.'],
  ['9', 'Very high waves with long overhanging crests. The resulting foam in great patches is blown in dense white streaks.'],
  ['11.5', 'Exceptionally high waves. The sea is completely covered with long white patches of foam.'],
  ['> 14', 'The air is filled with foam and spray. Sea completely white with driving spray.'],
];


export function beaufortKn(stufe: number): number {
  return stufe === 0 ? 0 : beaufortUntergrenzeKn(stufe);
}

export function beaufortTabelle(sprache: Sprache): BeaufortZeile[] {
  const see = sprache === 'en' ? SEE_EN : SEE_DE;
  return see.map(([welle, text], stufe) => ({
    stufe, name: windBand(beaufortKn(stufe), sprache).name, kn: KN[stufe]!, welle, see: text,
  }));
}



export interface DouglasZeile { wert: number; name: string; wmo: string; hoehe: string }

const DOUGLAS_DE: readonly [string, string, string][] = [
  ['spiegelglatte See', 'Calm (glassy)', '0'],
  ['ruhige, gekräuselte See', 'Calm (rippled)', '0–0,1'],
  ['schwach bewegte See', 'Smooth (wavelets)', '0,1–0,5'],
  ['leicht bewegte See', 'Slight', '0,5–1,25'],
  ['mäßig bewegte See', 'Moderate', '1,25–2,5'],
  ['grobe See', 'Rough', '2,5–4'],
  ['sehr grobe See', 'Very rough', '4–6'],
  ['hohe See', 'High', '6–9'],
  ['sehr hohe See', 'Very high', '9–14'],
  ['außergewöhnlich schwere See', 'Phenomenal', '> 14'],
];
const DOUGLAS_EN_HOEHE = ['0', '0–0.1', '0.1–0.5', '0.5–1.25', '1.25–2.5', '2.5–4', '4–6', '6–9', '9–14', '> 14'];

export function douglasTabelle(sprache: Sprache): DouglasZeile[] {
  return DOUGLAS_DE.map(([de, wmo, hoehe], wert) => ({
    wert, name: sprache === 'en' ? wmo : de, wmo, hoehe: sprache === 'en' ? DOUGLAS_EN_HOEHE[wert]! : hoehe,
  }));
}



export interface Buchstabe {
  code: string;
  wort: string;
  
  aussprache: string;
  morse: string;
  
  nurKvr: boolean;
  bedeutung: string;
}


const BUCHSTABEN: readonly [string, string, string, string, boolean][] = [
  ['A', 'Alfa', 'AL FAH', '·–', false], ['B', 'Bravo', 'BRAH VOH', '–···', true],
  ['C', 'Charlie', 'CHAR LEE', '–·–·', true], ['D', 'Delta', 'DELL TAH', '–··', true],
  ['E', 'Echo', 'ECK OH', '·', true], ['F', 'Foxtrot', 'FOKS TROT', '··–·', false],
  ['G', 'Golf', 'GOLF', '––·', true], ['H', 'Hotel', 'HOH TELL', '····', true],
  ['I', 'India', 'IN DEE AH', '··', true], ['J', 'Juliett', 'JEW LEE ETT', '·–––', false],
  ['K', 'Kilo', 'KEY LOH', '–·–', false], ['L', 'Lima', 'LEE MAH', '·–··', false],
  ['M', 'Mike', 'MIKE', '––', false], ['N', 'November', 'NO VEM BER', '–·', false],
  ['O', 'Oscar', 'OSS CAH', '–––', false], ['P', 'Papa', 'PAH PAH', '·––·', false],
  ['Q', 'Quebec', 'KEH BECK', '––·–', false], ['R', 'Romeo', 'ROW ME OH', '·–·', false],
  ['S', 'Sierra', 'SEE AIR RAH', '···', true], ['T', 'Tango', 'TANG GO', '–', true],
  ['U', 'Uniform', 'YOU NEE FORM', '··–', false], ['V', 'Victor', 'VIK TAH', '···–', false],
  ['W', 'Whiskey', 'WISS KEY', '·––', false], ['X', 'X-ray', 'ECKS RAY', '–··–', false],
  ['Y', 'Yankee', 'YANG KEY', '–·––', false], ['Z', 'Zulu', 'ZOO LOO', '––··', true],
];


const BEDEUTUNG_DE: Record<string, string> = {
  A: 'Ich habe Taucher unten; halten Sie sich gut von mir frei und fahren Sie langsam.',
  B: 'Ich lade, lösche oder befördere gefährliche Güter.',
  C: 'Ja (bejahend), bzw. „Die vorhergehende Gruppe ist bejahend zu lesen.“',
  D: 'Halten Sie sich von mir frei; ich manövriere mit Schwierigkeit.',
  E: 'Ich ändere meinen Kurs nach Steuerbord.',
  F: 'Ich bin manövrierunfähig; treten Sie mit mir in Verbindung.',
  G: 'Ich benötige einen Lotsen. Von Fischereifahrzeugen dicht beieinander auf Fangplätzen: „Ich hole Netze ein.“',
  H: 'Ich habe einen Lotsen an Bord.',
  I: 'Ich ändere meinen Kurs nach Backbord.',
  J: 'Ich habe Feuer und gefährliche Ladung an Bord, halten Sie sich gut von mir frei. Oder: Bei mir läuft gefährliche Ladung aus.',
  K: 'Ich möchte mit Ihnen in Verbindung treten.',
  L: 'Bringen Sie Ihr Fahrzeug sofort zum Stehen.',
  M: 'Mein Fahrzeug ist gestoppt und macht keine Fahrt durchs Wasser.',
  N: 'Nein (verneinend), bzw. „Die vorhergehende Gruppe ist verneinend zu lesen.“ Nur optisch oder als Schallsignal; im Sprechfunk „NO“.',
  O: 'Mensch über Bord.',
  P: 'Im Hafen: Alle Personen an Bord, das Fahrzeug läuft aus. Auf See (Fischerei): „Meine Netze sind an einem Hindernis festgekommen.“ Als Schallsignal auch: „Ich benötige einen Lotsen.“',
  Q: 'Mein Fahrzeug ist gesund, ich bitte um freie Verkehrserlaubnis.',
  R: 'Kein Einbuchstabensignal im geltenden Signalbuch. Als Verfahrenssignal: „Empfangen“; mit Zahlen: Entfernung in Seemeilen.',
  S: 'Ich arbeite mit rückwärts gehender Maschine.',
  T: 'Halten Sie sich von mir frei; ich fische im Gespann (Pair Trawling).',
  U: 'Sie begeben sich in Gefahr.',
  V: 'Ich benötige Hilfe.',
  W: 'Ich benötige ärztliche Hilfe.',
  X: 'Unterbrechen Sie Ihr Vorhaben und achten Sie auf meine Signale.',
  Y: 'Mein Anker hält nicht (ich treibe vor Anker).',
  Z: 'Ich benötige einen Schlepper. Von Fischereifahrzeugen dicht beieinander auf Fangplätzen: „Ich setze Netze aus.“',
};


const BEDEUTUNG_EN: Record<string, string> = {
  A: 'I have a diver down; keep well clear at slow speed.',
  B: 'I am taking in, or discharging, or carrying dangerous goods.',
  C: 'Yes (affirmative or “The significance of the previous group should be read in the affirmative”).',
  D: 'Keep clear of me; I am maneuvering with difficulty.',
  E: 'I am altering my course to starboard.',
  F: 'I am disabled; communicate with me.',
  G: 'I require a pilot. When made by fishing vessels operating in close proximity on the fishing grounds it means: “I am hauling nets”.',
  H: 'I have a pilot on board.',
  I: 'I am altering my course to port.',
  J: 'I am on fire and have dangerous cargo on board: keep well clear of me, or I am leaking dangerous cargo.',
  K: 'I wish to communicate with you.',
  L: 'You should stop your vessel instantly.',
  M: 'My vessel is stopped and making no way through the water.',
  N: 'No (negative or “The significance of the previous group should be read in the negative”). This signal may be given only visually or by sound. For voice or radio transmission the signal should be “NO”.',
  O: 'Man overboard.',
  P: 'In harbor: all persons should report on board as the vessel is about to proceed to sea. At sea: may be used by fishing vessels to mean “My nets have come fast upon an obstruction”; as a sound signal also “I require a pilot”.',
  Q: 'My vessel is “healthy” and I request free pratique.',
  R: 'No single-letter meaning in the current Code. Procedure signal: “Received”; with numerals: distance in nautical miles.',
  S: 'I am operating astern propulsion.',
  T: 'Keep clear of me; I am engaged in pair trawling.',
  U: 'You are running into danger.',
  V: 'I require assistance.',
  W: 'I require medical assistance.',
  X: 'Stop carrying out your intentions and watch for my signals.',
  Y: 'I am dragging my anchor.',
  Z: 'I require a tug. When made by fishing vessels operating in close proximity on the fishing grounds it means: “I am shooting nets”.',
};

export function buchstaben(sprache: Sprache): Buchstabe[] {
  const bed = sprache === 'en' ? BEDEUTUNG_EN : BEDEUTUNG_DE;
  return BUCHSTABEN.map(([code, wort, aussprache, morse, nurKvr]) => ({ code, wort, aussprache, morse, nurKvr, bedeutung: bed[code]! }));
}


export const ZIFFERN: readonly { code: string; morse: string; wort: string }[] = [
  { code: '1', morse: '·––––', wort: 'UNAONE' }, { code: '2', morse: '··–––', wort: 'BISSOTWO' },
  { code: '3', morse: '···––', wort: 'TERRATHREE' }, { code: '4', morse: '····–', wort: 'KARTEFOUR' },
  { code: '5', morse: '·····', wort: 'PANTAFIVE' }, { code: '6', morse: '–····', wort: 'SOXISIX' },
  { code: '7', morse: '––···', wort: 'SETTESEVEN' }, { code: '8', morse: '–––··', wort: 'OKTOEIGHT' },
  { code: '9', morse: '––––·', wort: 'NOVENINE' }, { code: '0', morse: '–––––', wort: 'NADAZERO' },
];



export interface Kombination { oben: string; unten: string; code: string; bedeutung: string; hinweis: string }

export function kombinationen(sprache: Sprache): Kombination[] {
  if (sprache === 'en') {
    return [
      { oben: 'N', unten: 'C', code: 'NC', bedeutung: 'I am in distress and require immediate assistance.', hinweis: 'Pub. 102 chapter 2 “Distress”; also a distress signal under COLREGs Annex IV 1 (f).' },
      { oben: 'C', unten: 'Y', code: 'CY', bedeutung: 'Boat(s) is (are) coming to you.', hinweis: 'Pub. 102 chapter 2 “Boats: Rafts”. CY 1 “Boat/raft is making for the shore”, CY 2 “Boat/raft has reached the shore”.' },
      { oben: 'Q', unten: 'L', code: 'QL', bedeutung: 'You should go astern.', hinweis: 'Pub. 102 chapter 2 “Engine maneuvers” (QL 1 slow astern, QL 2 full speed astern).' },
      { oben: 'G', unten: 'W', code: 'GW', bedeutung: 'Man overboard. Please take action to pick him up (position to be indicated if necessary).', hinweis: 'Pub. 102 chapter 2 “Rescue”. Single letter: “O” = man overboard.' },
    ];
  }
  return [
    { oben: 'N', unten: 'C', code: 'NC', bedeutung: 'Ich bin in Not und benötige sofortige Hilfe.', hinweis: 'Pub. 102 Kap. 2 „Distress“; zugleich Notzeichen nach KVR Anlage IV Nr. 1 f.' },
    { oben: 'C', unten: 'Y', code: 'CY', bedeutung: 'Boot(e) kommt/kommen zu Ihnen.', hinweis: 'Pub. 102 Kap. 2 „Boats: Rafts“. Mit Ergänzung: CY 1 „Boot/Rettungsfloß hält auf die Küste zu“, CY 2 „… hat die Küste erreicht“.' },
    { oben: 'Q', unten: 'L', code: 'QL', bedeutung: 'Sie sollten rückwärts gehen (Maschine zurück).', hinweis: 'Pub. 102 Kap. 2 „Engine Maneuvers“ (QL 1 langsam zurück, QL 2 voll zurück).' },
    { oben: 'G', unten: 'W', code: 'GW', bedeutung: 'Mensch über Bord. Bitte ergreifen Sie Maßnahmen, ihn aufzunehmen (Position wenn nötig angeben).', hinweis: 'Pub. 102 Kap. 2 „Rescue“. Einbuchstabig: „O“ = Mensch über Bord.' },
  ];
}



export type Quelle = readonly [titel: string, url: string];

const QUELLEN_DE: Record<string, Quelle> = {
  asr: ['ASR A5.1 Anhang 1, Tab. 6 „Beaufort-Skala See“ (Technische Regel für Arbeitsstätten)', 'https://vorschriften.bgn-branchenwissen.de/daten/tr/asr_a5_1/anh1.htm'],
  nws_seastate: ['Fotos: NOAA National Weather Service, Guide to Sea State, Wind and Clouds, Teil 1 (gemeinfrei, Werk der US-Bundesregierung)', 'https://www.weather.gov/media/marine/SeaState.pdf'],
  wmo3700: ['WMO Code Table 3700 „State of sea“ (NOAA/NODC-Wiedergabe)', 'https://www.nodc.noaa.gov/gtspp/document/codetbls/wmocodes/table3700.html'],
  wmofaq: ['WMO, Marine FAQ: Douglas-Skala und Seegangsbegriffe', 'https://wmo.int/marine-frequently-asked-questions'],
  dewiki_douglas: ['Wikipedia (de): Douglas-Skala, deutsche Bezeichnungen, belegt mit DHMZ Split', 'https://de.wikipedia.org/wiki/Douglas-Skala'],
  pub102: ['NGA Pub. 102 International Code of Signals, US-Ausgabe 1969 (rev. 2020), Kap. 1 u. 2', 'https://msi.nga.mil/Publications/ICOS'],
  wiki_flags: ['Wikipedia (en): International maritime signal flags, Blasonierung der Flaggen und Wimpel', 'https://en.wikipedia.org/wiki/International_maritime_signal_flags'],
  kvr: ['KVR: Kollisionsverhütungsregeln (Anlage zu § 1 der Verordnung zu den Internationalen Regeln von 1972), Regeln 20–37', 'https://www.gesetze-im-internet.de/seestro_1972/'],
  kvr_text: ['Volltext KVR (Lesekopie, Regeln 1–38 und Anlage IV)', 'http://www.holdicht.de/KVR.pdf'],
  seeschstro: ['SeeSchStrO Anlage II Nr. 1: blaues Funkellicht (deutsches Recht)', 'https://www.gesetze-im-internet.de/seeschstro_1971/'],
  dsv: ['DSV Kreuzer-Abteilung, Broschüre 5501 „Yachtgebräuche und Flaggenführung“ (Stand 04.09.2018)', 'https://www.vsaw.de/fileadmin/user_upload/dokumente/verschiedenes/yachtgebraeuche_und_flaggenfuehrung.pdf'],
  seeschfg: ['Österreich: § 3 Seeschifffahrtsgesetz (SeeSchFG) (Seeflagge)', 'https://www.jusline.at/gesetz/seeschfg/paragraf/3'],
  adac: ['ADAC Skipper: Flaggenführung (Flaggengala, Reihenfolge Setzen/Einholen)', 'https://skipper.adac.de/ratgeber/flaggenfuehrung'],
  iala: ['IALA: Maritime Buoyage System and Other Aids to Navigation (Ausgabe 2010)', 'https://www.irishlights.ie/media/11141/IALA-MBS.pdf'],
  nga_q: ['NGA/NOAA Chart No. 1 (US), Abschnitt Q: IALA Maritime Buoyage System, Q130', 'https://msi.nga.mil/api/publications/download?key=16694005%2FSFH00000%2FSec_Q.pdf'],
  o133: ['IALA Recommendation O-133 Emergency Wreck Marking Buoy (Ed. 1, 2005)', 'https://www.heliant.it/images/CH/O-133-EmergWreckbuoy-2005.pdf'],
  pub116: ['NGA Pub. 116 List of Lights, „Characteristics of Lights“, „Nomenclature of Lights“', 'https://msi.nga.mil/Publications/NGALOL'],
  dewiki_kennung: ['Wikipedia (de): Kennung (Leuchtfeuer), Beispiel Heiligenhafen Oc.(2)WRG.9s', 'https://de.wikipedia.org/wiki/Kennung_(Leuchtfeuer)'],
  kimm: ['Springer: Hilfstafeln zur Terrestrischen Ortsbestimmung (SW = 2,075 (√H + √h))', 'https://link.springer.com/chapter/10.1007/978-3-662-28614-2_6'],
  dewiki_relings: ['Wikipedia (de): Relingslogge (Meridiantertie 0,51444 m)', 'https://de.wikipedia.org/wiki/Relingslogge'],
  rumpf: ['Wikipedia (de): Rumpfgeschwindigkeit (v ≈ 2,43 · √LWL in m, 1,34 · √LWL in ft)', 'https://de.wikipedia.org/wiki/Rumpfgeschwindigkeit'],
  zembra: ['Formelsammlung Navigation: Abstand aus Höhenwinkel D = 13 H / (7 h)', 'http://www.zembra.de/formeln-astro.pdf'],
  forces_sails: ['Wikipedia (en): Forces on sails (Auftrieb 40°–135°, Profiltiefen nach Dellenbaugh, Windgradient)', 'https://en.wikipedia.org/wiki/Forces_on_sails'],
  genua_gentry: ['Wikipedia (en): Genoa (sail), Überlappung und Spaltwirkung nach Gentry', 'https://en.wikipedia.org/wiki/Genoa_(sail)'],
  windgradient: ['Wikipedia (de): Windgradient', 'https://de.wikipedia.org/wiki/Windgradient'],
  points_sail: ['Wikipedia (en): Points of sail (am Wind um 45°)', 'https://en.wikipedia.org/wiki/Points_of_sail'],
  kentern: ['Wikipedia (de): Kentern (Form- und Gewichtsstabilität, Kenterpunkt)', 'https://de.wikipedia.org/wiki/Kentern'],
  gz_kurve: ['Practical Sailor: Sailboat Stability Uncensored (Hebelarmkurve, Stabilitätsumfang)', 'https://www.practical-sailor.com/blog/sailboat-stability-uncensored'],
  lateralplan: ['Wikipedia (de): Lateralplan', 'https://de.wikipedia.org/wiki/Lateralplan'],
  luvgierig: ['Wikipedia (de): Luvgierigkeit', 'https://de.wikipedia.org/wiki/Luvgierigkeit'],
  segeldruckpunkt: ['Wikipedia (de): Segeldruckpunkt', 'https://de.wikipedia.org/wiki/Segeldruckpunkt'],
  segeltrimm: ['Wikipedia (de): Segeltrimm', 'https://de.wikipedia.org/wiki/Segeltrimm'],
  traveller: ['Wikipedia (de): Traveller (Segeln)', 'https://de.wikipedia.org/wiki/Traveller_(Segeln)'],
  cunningham: ['Wikipedia (de): Cunninghamstrecker', 'https://de.wikipedia.org/wiki/Cunninghamstrecker'],
  niederholer: ['Wikipedia (de): Niederholer', 'https://de.wikipedia.org/wiki/Niederholer'],
  uksm_genua: ['UK Sailmakers: Genoa Trim (Holepunkt)', 'https://www.uksailmakers.com/encyclopedia-5-2-genoa-trim/'],
  telltale: ['Wikipedia (de): Telltale', 'https://de.wikipedia.org/wiki/Telltale'],
  bullenstander: ['Wikipedia (de): Bullenstander', 'https://de.wikipedia.org/wiki/Bullenstander'],
  uksm_sturm: ['UK Sailmakers: Storm Jib (World Sailing OSR: höchstens 5 % von I², Vorliek unter 65 % von I)', 'https://www.uksailmakers.com/storm-sails/storm-jib/'],
  wiki_amwind: ['Wikipedia (de): Am-Wind-Kurs (Kurse nach dem Winkel zum scheinbaren Wind)', 'https://de.wikipedia.org/wiki/Am-Wind-Kurs'],
  wiki_wende: ['Wikipedia (de): Wende (Segeln), Kommandos', 'https://de.wikipedia.org/wiki/Wende_(Segeln)'],
  wiki_halse: ['Wikipedia (de): Halse, Kommandos und Patenthalse', 'https://de.wikipedia.org/wiki/Halse'],
  wiki_qwende: ['Wikipedia (de): Q-Wende', 'https://de.wikipedia.org/wiki/Q-Wende'],
  sg_wende: ['SkipperGuide.de: Wende (GFDL)', 'https://www.skipperguide.de/wiki/Wende'],
  sg_halse: ['SkipperGuide.de: Halse (GFDL)', 'https://www.skipperguide.de/wiki/Halse'],
  sg_beiliegen: ['SkipperGuide.de: Beiliegen, Beidrehen in drei Phasen (GFDL)', 'https://www.skipperguide.de/wiki/Beiliegen'],
  pbo_halse: ['Practical Boat Owner: How to gybe safely (englische Kommandos)', 'https://www.pbo.co.uk/seamanship/how-to-gybe-safely-105669'],
  nammert: ['Nammert: Seamanship commands (englische Kommandos)', 'https://www.nammert.com/en/seamanship-commands.php'],
  heaving_to: ['Wikipedia (en): Heaving to', 'https://en.wikipedia.org/wiki/Heaving_to'],
  sg_ankern: ['SkipperGuide.de: Ankern, Abschnitt Ankern unter Segel (GFDL)', 'https://www.skipperguide.de/wiki/Ankern'],
  classic_ankern: ['Classic Sailor: Anchoring under sail (2021)', 'https://classicsailor.com/2021/06/anchoring-under-sail/'],
  cg_ankerauf: ['Catamaran Guru: Weighing anchor under sail', 'https://catamaranguru.com/weighing-anchor-under-sail/'],
  ne: ['Natural Earth 1:110m Admin-0 (gemeinfrei) über npm-Paket world-atlas 2 (ISC)', 'https://github.com/topojson/world-atlas'],
  kursbeschickung: ['Wikipedia (de): Kursbeschickung (Begriffe, Vorzeichen, Beispiel)', 'https://de.wikipedia.org/wiki/Kursbeschickung'],
  dreyer: ['Nautische Formelsammlung Navigation (Rolf Dreyer): MgK + Abl = mwK + Mw = rwK; WT = KT + H', 'https://www.rolfdreyer.de/downloads/Formelsammlung.pdf'],
  nist: ['NIST SP 811, Table 9: 1 nautical mile = 1852 m; 1 knot = (1852/3600) m/s', 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication811e2008.pdf'],
  kabel: ['Wikipedia (de): Kabellänge, 0,1 sm = 185,2 m; nationale Varianten', 'https://de.wikipedia.org/wiki/Kabell%C3%A4nge'],
  twelfths: ['Wikipedia (en): Rule of twelfths (Annahmen und Grenzen)', 'https://en.wikipedia.org/wiki/Rule_of_twelfths'],
  wiki_gezeiten: ['Wikipedia (de): Gezeiten (Hoch- und Niedrigwasser, Tidenstieg und -fall, Spring- und Nipptide, Seekartennull)', 'https://de.wikipedia.org/wiki/Gezeiten'],
  wiki_tide: ['Wikipedia (en): Tide (MHWS/MLWS/MHWN/MLWN, HAT/LAT, Springverspätung in der Nordsee)', 'https://en.wikipedia.org/wiki/Tide'],
  yacht_skn: ['YACHT: Verlässlichere Tiefenangaben für Nord- und Ostsee (Seekartennull = LAT seit 2005)', 'https://www.yacht.de/reisen-chartern/deutschland/navigation-verlaesslichere-tiefenangaben-fuer-nord-und-ostsee/'],
  struna_skn: ['Struna (Institut für kroatische Sprache): hidrografska nula, Seekartennull kroatischer Seekarten', 'http://struna.ihjj.hr/naziv/hidrografska-nula/2043/'],
  pmf_skn: ['Universität Zagreb (PMF), Razina mora: HRSDM71, Mittel der niedrigeren Niedrigwasser über 18,6 Jahre', 'https://www.pmf.unizg.hr/_download/repository/2_Razina_mora.pdf'],
  wiki_mob: ['Wikipedia (de): Mann-über-Bord-Manöver', 'https://de.wikipedia.org/wiki/Mann-%C3%BCber-Bord-Man%C3%B6ver'],
  imo_cold: ['IMO MSC.1/Circ.1185/Rev.1 Guide for Cold Water Survival (2012), Abschnitte 6, 7, 9', 'https://eng.navigation.gl/media/9707/imo-guide-for-cold-water-survival-msc-1-circ-1185-rev-1.pdf'],
  dflagge: ['Deutsche Flagge (BSH): Rettung bei Unterkühlung', 'https://www.deutsche-flagge.de/en/maritime-medicine/health-matters/hypothermia/hypothermia'],
  blauwasser: ['blauwasser.de: Ankerkettenlänge, Faustregeln nach Schult, Schenk, Roever und Kritik', 'https://www.blauwasser.de/ankern_kettenlaenge'],
  sg_vorspring: ['SkipperGuide.de: Eindampfen in die Vorspring beim Ablegen (GFDL)', 'https://www.skipperguide.de/wiki/Eindampfen_in_die_Vorspring_beim_Ablegen'],
  sg_achterspring: ['SkipperGuide.de: Eindampfen in die Achterspring (GFDL)', 'https://www.skipperguide.de/wiki/Eindampfen_in_die_Achterspring'],
  sg_achterleine: ['SkipperGuide.de: Eindampfen in die seewärtige Achterleine (GFDL)', 'https://www.skipperguide.de/wiki/Eindampfen_in_die_seew%C3%A4rtige_Achterleine'],
  fu_manoever: ['FU Berlin Hochschulsport: Manöverblatt Motorbootausbildung (2024), Eindampfen in die Vorspring', 'https://www.hochschulsport.fu-berlin.de/ressourcen/dokumente/mobo_mano_verblatt-2024.pdf'],
  yacht_radeffekt: ['YACHT: Mit der Yacht vertraut machen, die Grundtechniken (Radeffekt)', 'https://www.yacht.de/segelwissen/manoever/seemannschaft-mit-der-yacht-vertraut-machen-die-grundtechniken/'],
};

const QUELLEN_EN: Record<string, Quelle> = {
  noaa_bft: ['NOAA JetStream: Wind and sea scales, Beaufort force, WMO description, sea appearance, probable wave height', 'https://www.noaa.gov/jetstream/ocean/waves/jetstream-max-wind-and-sea-scales'],
  nws_seastate: ['Photographs: NOAA National Weather Service, Guide to Sea State, Wind and Clouds, part 1 (public domain, US government work)', 'https://www.weather.gov/media/marine/SeaState.pdf'],
  metoffice: ['Met Office: Beaufort wind force scale (sea criteria, probable wave height)', 'https://weather.metoffice.gov.uk/guides/coast-and-sea/beaufort-scale'],
  wmo3700: ['WMO Code Table 3700 “State of sea” (NOAA/NODC reproduction)', 'https://www.nodc.noaa.gov/gtspp/document/codetbls/wmocodes/table3700.html'],
  wmofaq: ['WMO Marine FAQ: Douglas scale and sea state terminology', 'https://wmo.int/marine-frequently-asked-questions'],
  pub102: ['NGA Pub. 102 International Code of Signals, US edition 1969 (rev. 2020), chapters 1 and 2', 'https://msi.nga.mil/Publications/ICOS'],
  wiki_flags: ['Wikipedia: International maritime signal flags, blazons of flags and pennants', 'https://en.wikipedia.org/wiki/International_maritime_signal_flags'],
  colregs: ['COLREGs: International Regulations for Preventing Collisions at Sea 1972 (USCG Navigation Center, amalgamated text)', 'https://www.navcen.uscg.gov/navigation-rules-amalgamated'],
  kvr_text: ['German official translation (KVR), full text used for cross-checking Rules 1–38 and Annex IV', 'http://www.holdicht.de/KVR.pdf'],
  seeschstro: ['German SeeSchStrO Annex II no. 1: blue flashing light (German national law)', 'https://www.gesetze-im-internet.de/seeschstro_1971/'],
  dsv: ['German Sailing Federation (DSV) Cruising Division, brochure 5501 “Yachtgebräuche und Flaggenführung” (04.09.2018), German', 'https://www.vsaw.de/fileadmin/user_upload/dokumente/verschiedenes/yachtgebraeuche_und_flaggenfuehrung.pdf'],
  seeschfg: ['Austria: § 3 Seeschifffahrtsgesetz (SeeSchFG) (maritime flag, German)', 'https://www.jusline.at/gesetz/seeschfg/paragraf/3'],
  adac: ['ADAC Skipper: Flaggenführung (dressing ship, order of hoisting), German', 'https://skipper.adac.de/ratgeber/flaggenfuehrung'],
  iala: ['IALA: Maritime Buoyage System and Other Aids to Navigation (2010 edition)', 'https://www.irishlights.ie/media/11141/IALA-MBS.pdf'],
  nga_q: ['NGA/NOAA Chart No. 1 (US), section Q: IALA Maritime Buoyage System, Q130', 'https://msi.nga.mil/api/publications/download?key=16694005%2FSFH00000%2FSec_Q.pdf'],
  o133: ['IALA Recommendation O-133 Emergency Wreck Marking Buoy (ed. 1, 2005)', 'https://www.heliant.it/images/CH/O-133-EmergWreckbuoy-2005.pdf'],
  pub116: ['NGA Pub. 116 List of Lights, “Characteristics of Lights”, “Nomenclature of Lights”', 'https://msi.nga.mil/Publications/NGALOL'],
  dewiki_kennung: ['Wikipedia (German): Kennung (Leuchtfeuer), example Heiligenhafen Oc.(2)WRG.9s', 'https://de.wikipedia.org/wiki/Kennung_(Leuchtfeuer)'],
  kimm: ['Springer: Hilfstafeln zur Terrestrischen Ortsbestimmung, SW = 2.075 (√H + √h), German', 'https://link.springer.com/chapter/10.1007/978-3-662-28614-2_6'],
  dewiki_relings: ['Wikipedia (German): Relingslogge, 1/3600 nautical mile = 0.51444 m', 'https://de.wikipedia.org/wiki/Relingslogge'],
  rumpf: ['Wikipedia: Hull speed (1.34 · √LWL in ft)', 'https://en.wikipedia.org/wiki/Hull_speed'],
  zembra: ['Navigation formula collection: distance from vertical angle D = 13 H / (7 h), German', 'http://www.zembra.de/formeln-astro.pdf'],
  forces_sails: ['Wikipedia: Forces on sails (lift from 40° to 135°, draft after Dellenbaugh, wind gradient)', 'https://en.wikipedia.org/wiki/Forces_on_sails'],
  genua_gentry: ['Wikipedia: Genoa (sail), overlap and Gentry on the slot effect', 'https://en.wikipedia.org/wiki/Genoa_(sail)'],
  windgradient: ['Wikipedia: Wind gradient', 'https://en.wikipedia.org/wiki/Wind_gradient'],
  points_sail: ['Wikipedia: Points of sail (close-hauled about 45°)', 'https://en.wikipedia.org/wiki/Points_of_sail'],
  kentern: ['Wikipedia: Ship stability', 'https://en.wikipedia.org/wiki/Ship_stability'],
  gz_kurve: ['Practical Sailor: Sailboat Stability Uncensored (righting lever curve, limit of positive stability)', 'https://www.practical-sailor.com/blog/sailboat-stability-uncensored'],
  lateralplan: ['Wikipedia: Center of lateral resistance', 'https://en.wikipedia.org/wiki/Center_of_lateral_resistance'],
  luvgierig: ['Wikipedia: Weather helm', 'https://en.wikipedia.org/wiki/Weather_helm'],
  segeldruckpunkt: ['Wikipedia (German): Segeldruckpunkt, centre of effort', 'https://de.wikipedia.org/wiki/Segeldruckpunkt'],
  segeltrimm: ['Wikipedia (German): Segeltrimm, sail trim', 'https://de.wikipedia.org/wiki/Segeltrimm'],
  traveller: ['Wikipedia: Traveler (sailing)', 'https://en.wikipedia.org/wiki/Traveler_(sailing)'],
  cunningham: ['Wikipedia: Cunningham (sailing)', 'https://en.wikipedia.org/wiki/Cunningham_(sailing)'],
  niederholer: ['Wikipedia: Boom vang', 'https://en.wikipedia.org/wiki/Boom_vang'],
  uksm_genua: ['UK Sailmakers: Genoa Trim (jib lead)', 'https://www.uksailmakers.com/encyclopedia-5-2-genoa-trim/'],
  telltale: ['Wikipedia: Telltale', 'https://en.wikipedia.org/wiki/Telltale'],
  bullenstander: ['Wikipedia (German): Bullenstander, preventer', 'https://de.wikipedia.org/wiki/Bullenstander'],
  uksm_sturm: ['UK Sailmakers: Storm Jib (World Sailing OSR: at most 5% of I², luff under 65% of I)', 'https://www.uksailmakers.com/storm-sails/storm-jib/'],
  wiki_amwind: ['Wikipedia (German): Am-Wind-Kurs, points of sail by apparent wind angle', 'https://de.wikipedia.org/wiki/Am-Wind-Kurs'],
  wiki_wende: ['Wikipedia (German): Wende (Segeln), tacking and its calls', 'https://de.wikipedia.org/wiki/Wende_(Segeln)'],
  wiki_halse: ['Wikipedia (German): Halse, gybing and its calls', 'https://de.wikipedia.org/wiki/Halse'],
  wiki_qwende: ['Wikipedia (German): Q-Wende, chicken gybe', 'https://de.wikipedia.org/wiki/Q-Wende'],
  sg_wende: ['SkipperGuide.de: Wende, tacking (GFDL), German', 'https://www.skipperguide.de/wiki/Wende'],
  sg_halse: ['SkipperGuide.de: Halse, gybing (GFDL), German', 'https://www.skipperguide.de/wiki/Halse'],
  sg_beiliegen: ['SkipperGuide.de: Beiliegen, heaving to in three phases (GFDL), German', 'https://www.skipperguide.de/wiki/Beiliegen'],
  pbo_halse: ['Practical Boat Owner: How to gybe safely', 'https://www.pbo.co.uk/seamanship/how-to-gybe-safely-105669'],
  nammert: ['Nammert: Seamanship commands', 'https://www.nammert.com/en/seamanship-commands.php'],
  heaving_to: ['Wikipedia: Heaving to', 'https://en.wikipedia.org/wiki/Heaving_to'],
  sg_ankern: ['SkipperGuide.de: Ankern, section on anchoring under sail (GFDL), German', 'https://www.skipperguide.de/wiki/Ankern'],
  classic_ankern: ['Classic Sailor: Anchoring under sail (2021)', 'https://classicsailor.com/2021/06/anchoring-under-sail/'],
  cg_ankerauf: ['Catamaran Guru: Weighing anchor under sail', 'https://catamaranguru.com/weighing-anchor-under-sail/'],
  ne: ['Natural Earth 1:110m Admin-0 (public domain) via npm package world-atlas 2 (ISC)', 'https://github.com/topojson/world-atlas'],
  kursbeschickung: ['Wikipedia (German): Kursbeschickung, terms with English equivalents, signs, example', 'https://de.wikipedia.org/wiki/Kursbeschickung'],
  dreyer: ['Rolf Dreyer, nautical formula collection: CC + DEV = MC + VAR = TC; depth = charted depth + height of tide, German', 'https://www.rolfdreyer.de/downloads/Formelsammlung.pdf'],
  nist: ['NIST SP 811, Table 9: 1 nautical mile = 1852 m; 1 knot = (1852/3600) m/s', 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication811e2008.pdf'],
  kabel: ['Wikipedia (German): Kabellänge, 0.1 nautical mile = 185.2 m; national variants', 'https://de.wikipedia.org/wiki/Kabell%C3%A4nge'],
  twelfths: ['Wikipedia: Rule of twelfths (assumptions and limitations)', 'https://en.wikipedia.org/wiki/Rule_of_twelfths'],
  wiki_gezeiten: ['Wikipedia (German): Gezeiten (high and low water, rise and fall, springs and neaps, chart datum)', 'https://de.wikipedia.org/wiki/Gezeiten'],
  wiki_tide: ['Wikipedia: Tide (MHWS/MLWS/MHWN/MLWN, HAT/LAT, age of the tide in the North Sea)', 'https://en.wikipedia.org/wiki/Tide'],
  yacht_skn: ['YACHT magazine: more reliable depths for the North Sea and Baltic (chart datum = LAT since 2005), German', 'https://www.yacht.de/reisen-chartern/deutschland/navigation-verlaesslichere-tiefenangaben-fuer-nord-und-ostsee/'],
  struna_skn: ['Struna (Institute of Croatian Language): hidrografska nula, chart datum of Croatian charts, Croatian', 'http://struna.ihjj.hr/naziv/hidrografska-nula/2043/'],
  pmf_skn: ['University of Zagreb (PMF), Razina mora: HRSDM71, mean of the lower low waters over 18.6 years, Croatian', 'https://www.pmf.unizg.hr/_download/repository/2_Razina_mora.pdf'],
  wiki_mob: ['Wikipedia (German): Mann-über-Bord-Manöver', 'https://de.wikipedia.org/wiki/Mann-%C3%BCber-Bord-Man%C3%B6ver'],
  imo_cold: ['IMO MSC.1/Circ.1185/Rev.1 Guide for Cold Water Survival (2012), sections 6, 7, 9', 'https://eng.navigation.gl/media/9707/imo-guide-for-cold-water-survival-msc-1-circ-1185-rev-1.pdf'],
  dflagge: ['Deutsche Flagge (BSH): Rescue in case of hypothermia', 'https://www.deutsche-flagge.de/en/maritime-medicine/health-matters/hypothermia/hypothermia'],
  blauwasser: ['blauwasser.de: anchor chain length, rules of thumb by Schult, Schenk, Roever and criticism, German', 'https://www.blauwasser.de/ankern_kettenlaenge'],
  sg_vorspring: ['SkipperGuide.de: Eindampfen in die Vorspring beim Ablegen (springing off the bow spring, GFDL), German', 'https://www.skipperguide.de/wiki/Eindampfen_in_die_Vorspring_beim_Ablegen'],
  sg_achterspring: ['SkipperGuide.de: Eindampfen in die Achterspring (springing off the stern spring, GFDL), German', 'https://www.skipperguide.de/wiki/Eindampfen_in_die_Achterspring'],
  sg_achterleine: ['SkipperGuide.de: Eindampfen in die seewärtige Achterleine (outboard stern line, GFDL), German', 'https://www.skipperguide.de/wiki/Eindampfen_in_die_seew%C3%A4rtige_Achterleine'],
  fu_manoever: ['FU Berlin university sports: motorboat manoeuvre sheet (2024), springing off the bow spring, German', 'https://www.hochschulsport.fu-berlin.de/ressourcen/dokumente/mobo_mano_verblatt-2024.pdf'],
  yacht_radeffekt: ['YACHT magazine: basic techniques for getting to know a yacht (prop walk), German', 'https://www.yacht.de/segelwissen/manoever/seemannschaft-mit-der-yacht-vertraut-machen-die-grundtechniken/'],
};

export function quellen(sprache: Sprache): Record<string, Quelle> {
  return sprache === 'en' ? QUELLEN_EN : QUELLEN_DE;
}
