const EINER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const ZEHNER_ZEHN = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const ZEHNER = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function zahlWort(n: number): string {
  const z = Math.max(0, Math.min(999, Math.round(n)));
  if (z < 10) return EINER[z]!;
  if (z < 20) return ZEHNER_ZEHN[z - 10]!;
  if (z < 100) return ZEHNER[Math.floor(z / 10)]! + (z % 10 ? `-${EINER[z % 10]}` : '');
  const rest = z % 100;
  return `${EINER[Math.floor(z / 100)]} hundred${rest ? ` and ${zahlWort(rest)}` : ''}`;
}

export function meilenWort(sm: number): string {
  if (sm >= 99.95) return zahlWort(sm);
  const zehntel = Math.round(Math.max(0, sm) * 10);
  const ganz = Math.floor(zehntel / 10), d = zehntel % 10;
  return d ? `${zahlWort(ganz)} point ${EINER[d]}` : zahlWort(ganz);
}

const meilen = (sm: number): string => `${meilenWort(sm)} ${meilenWort(sm) === 'one' ? 'mile' : 'miles'}`;

export function gradWort(g: number): string {
  let r = Math.round(((g % 360) + 360) % 360);
  if (r === 0) r = 360;
  return String(r).padStart(3, '0').split('').map((c) => EINER[Number(c)]!).join(' ');
}

export function wpName(name: string): string {
  const m = /^\s*WP\s*(\d+)\s*$/i.exec(name);
  return m ? `waypoint ${zahlWort(Number(m[1]))}` : name.trim();
}
const gross = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const ANSAGE = {
  logGestartet: 'Log started.',
  logWeiter: 'Log resumed.',
  logPause: 'Log paused.',
  logStopp: 'Log stopped.',
  ziel: 'Destination reached. Route completed.',
  mob: 'Man overboard. Man overboard. Position marked.',
  motor: 'Engine sound detected. Confirm, under engine?',
  segel: 'No engine sound. Confirm, under sail?',
  angelegt: 'Vessel stationary for thirty minutes. Confirm, alongside or at anchor?',

  tankstelle: 'Fuel berth detected. Litres will be asked on departure.',
} as const;

export function routeGestartet(ziel: string, sm: number, gehezu: boolean): string {
  return gehezu
    ? `Go to ${wpName(ziel)} started, ${meilen(sm)}.`
    : `Route started. Destination ${wpName(ziel)}, ${meilen(sm)}.`;
}

export const ANNAEHERUNG_ANSAGEN_S = [180, 60, 30] as const;

export const ANNAEHERUNG_MIN_S = 10;

export function faelligeAnnaeherung(restS: number | null, gesagt: ReadonlySet<number>): number | null {
  if (restS === null || restS < ANNAEHERUNG_MIN_S) return null;
  let treffer: number | null = null;
  for (const s of ANNAEHERUNG_ANSAGEN_S) if (restS <= s && !gesagt.has(s)) treffer = s;
  return treffer;
}

export function annaeherungText(name: string, schwelleS: number, istZiel: boolean): string {
  const wann = schwelleS >= 60
    ? `${zahlWort(schwelleS / 60)} ${schwelleS === 60 ? 'minute' : 'minutes'}`
    : `${zahlWort(schwelleS)} seconds`;
  return `${gross(istZiel ? `destination ${wpName(name)}` : wpName(name))} in ${wann}.`;
}

export function uhrWort(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`.split('').map((c) => EINER[Number(c)]!).join(' ');
}

export function wegpunktText(
  name: string,
  naechster: { name: string; istZiel: boolean; sm: number | null; brg: number | null; eta?: { h: number; m: number } | null },
  nachgeholt = false,
): string {
  const kopf = `${gross(wpName(name))} ${nachgeholt ? 'passed' : 'reached'}.`;
  const wer = naechster.istZiel ? `Next, destination ${wpName(naechster.name)}` : `Next ${wpName(naechster.name)}`;
  const teile = [wer];
  if (naechster.sm !== null) teile.push(`distance ${meilen(naechster.sm)}`);
  if (naechster.brg !== null) teile.push(`bearing ${gradWort(naechster.brg)} degrees true`);

  if (naechster.eta) teile.push(`E T A ${uhrWort(naechster.eta.h, naechster.eta.m)}`);
  return `${kopf} ${teile.join(', ')}.`;
}

export function offTrackText(xteSm: number): string {
  return `Off track, ${meilen(Math.abs(xteSm))} to ${xteSm >= 0 ? 'starboard' : 'port'}.`;
}

export function grenzeText(vonEn: string, nachEn: string, minuten: number, schengen: 'binnen' | 'aussen' | 'ohne' | null): string {
  const m = Math.max(1, Math.round(minuten));
  const zusatz = schengen === 'aussen' ? ' Schengen external border, clear out and in.'
    : schengen === 'ohne' ? ' Clear out and in.' : '';
  return `Sea boundary ahead in about ${zahlWort(m)} ${m === 1 ? 'minute' : 'minutes'}. Leaving ${vonEn}, entering ${nachEn}.${zusatz}`;
}

export function vtgText(sm: number, name?: string): string {
  return `${name ? `${name} traffic separation scheme` : 'Traffic separation scheme'} ahead, ${meilen(sm)}.`;
}

export function warnungText(stufe: 3 | 4 | null): string {
  if (stufe === 4) return 'Red weather warning in force at the yacht\'s position.';
  if (stufe === 3) return 'Orange weather warning in force at the yacht\'s position.';
  return 'Warning in force in the marine forecast for this sea area.';
}

export function blitzText(sm: number, richtung: string | null, vorausSm: number | null): string {
  if (vorausSm === null) return `Lightning observed, ${meilen(sm)}${richtung ? ` ${richtung} of the yacht` : ' from the yacht'}.`;
  return `Lightning observed, ${meilen(sm)} off the route, ${meilen(vorausSm)} ahead.`;
}

const mitArtikel = (n: string): string => (/^the\s/i.test(n) ? n : `the ${n}`);

export function gebietText(nachEn: string, vonEn: string, durchEn?: string): string {
  return `Entering ${mitArtikel(nachEn)}, from ${mitArtikel(vonEn)}${durchEn ? `, through ${mitArtikel(durchEn)}` : ''}.`;
}

export function engeText(art: 'einfahrt' | 'ausfahrt' | 'querung' | 'entlang', nameEn: string, sm?: number): string {
  const n = mitArtikel(nameEn);
  switch (art) {
    case 'einfahrt': return `Entering ${n}.`;
    case 'ausfahrt': return `Leaving ${n}.`;
    case 'querung': return `${gross(n)} crossed.`;
    case 'entlang': return `${gross(n)} passed${sm !== undefined ? `, ${meilen(sm)}` : ''}.`;
  }
}

export const PROBE_A = 'Ahoy sailors, this is Ellen.';
export const PROBE_B: readonly string[] = [
  'The wind is fresh, the sea is blue, and someone forgot his sailing jacket.',
  'We are sailing nicely, although the skipper still thinks he knows where we are.',
  'The wind is on the nose, as usual, just when we need it most.',
  'The course looks good, the weather looks good, and the skipper looks worried.',
  'We have plenty of wind, plenty of rum, and surprisingly little idea where the sunglasses went.',
  'The sea is calm, the boat is happy, and nobody has mentioned the anchor yet.',
  'We are making good progress, provided the wind continues to cooperate.',
  'The forecast says light winds, so naturally we are expecting a gale.',
  'The waypoint is ahead, the tide is running, and someone is already blaming the chart.',
  'Everything is under control, which is sailor language for “probably”.',
  'The sails are full, the boat is fast, and the sundowner is still a long way off.',
  'The wind has shifted again, apparently just to keep us entertained.',
  'The sea looks peaceful, but sailors know better than to trust it.',
  'We are on course, the depth is fine, and the skipper has stopped looking at the chart.',
  'The sun is shining, the wind is perfect, and something is bound to go wrong.',
];

export const probeB = (z: number): string => PROBE_B[Math.min(PROBE_B.length - 1, Math.floor(z * PROBE_B.length))]!;
