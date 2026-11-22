import { nf as nfRoh } from '@/core/time';
import {
  toernBilanz, durchschnittKn, fahrtagNummern, ablegenAnlegen, toernAbgeschlossen, etappenJeFahrt,
  type FahrtMitSpur,
} from '@/core/toernbilanz';
import type { Anteil } from '@/core/navigatorbericht';
import { wechselAusEintraegen } from '@/core/antriebsbilanz';
import { dieselJeStunde } from '@/core/dieselverbrauch';
import { aktuelleSprache } from '@/shell/sprache';
import { icon } from '@/shell/icons';
import {
  fahrtenZuToern, ordneEtappenToernZu, orteAusMarken, speicherVerfuegbar,
  holeToern as holeLokalenToern, type Fahrt, type Toern as LokalerToern, type CrewMitglied,
} from '@/data/logdb';
import { baueFahrtPayload, type FahrtPayload } from '@/data/logSync';
import {
  holeSpurListe, holeSpur, holeBildBlob, sichereFahrten, waehleFahrten, gleicheMotordatenAb,
  motordatenAus, motordatenLeer, type Kandidat, type GeholteSpur, type Motordaten,
} from '@/data/spurablage';
import { liesEigeneNutzerId } from '@/shell/session';
import { holeCrew, sendeToernbericht, schiffFotoUrl, type ToernZeile, type CrewEintrag } from '@/data/toernApi';
import {
  tagesblatt, toernblatt, toernbericht, bilderFuerBlatt, KARTE_PX, type TagesblattEingabe,
} from './pdf';
import { kartenbild } from '@/data/kartenbild';
import { fetchSeegebiet } from '@/data/seegebiete';
import { gewaesserStaaten } from '@/briefing/seegebiet';
import { stichprobe } from '@/core/stichprobe';
import { STRINGS } from './strings';
import { biete, pdfZiel, verwirfZiel } from '@/ui/pdfAnzeige';
import { pdfDateiname } from './dateiname';
import { lateinisch } from '@/core/umschrift';
import { holeCrewFotos, holeCrewFotoBlob } from '@/data/crewFotos';
import { fotoOrtText } from '@/core/standortName';



const $ = (id: string) => document.getElementById(id);
function wort(schluessel: string, werte?: Record<string, string>): string {
  let text = STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
  for (const [k, v] of Object.entries(werte ?? {})) text = text.replace(`{${k}}`, v);
  return text;
}

const sm = () => (aktuelleSprache() === 'en' ? 'NM' : 'sm');

const nf = (x: number, d: number): string => nfRoh(x, d, aktuelleSprache());


function antriebZeile(e: { nm: number; segel: Anteil; motor: Anteil; offen: Anteil }): string | null {
  if (e.nm <= 0.05) return null;
  const teile = [
    `${nf(e.segel.nm, 1)} ${sm()} ${wort('statistik.segel')}`,
    `${nf(e.motor.nm, 1)} ${sm()} ${wort('statistik.motor')}`,
  ];
  if (e.offen.nm > 0.05) teile.push(`${nf(e.offen.nm, 1)} ${sm()} ${wort('statistik.offen')}`);
  return teile.join(' · ');
}

function dauer(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')} h` : `${m}:${String(s % 60).padStart(2, '0')} min`;
}


function crewFuerPdf(crew: CrewEintrag[]): CrewMitglied[] {
  return crew
    .map((m) => {
      const p = m.profil;
      const vorname = p?.vorname ?? '';
      const nachname = p && 'nachname' in p ? (p.nachname ?? '') : '';
      return { vorname, nachname, funktion: m.funktion, funktionForm: m.funktionForm ?? null };
    })
    .filter((m) => m.vorname && m.nachname);
}


function startUndEnde(
  toern: ToernZeile, etappen: { vonOrt?: string; nachOrt?: string }[],
): { startpunkt?: string; endpunkt?: string } {
  const start = lateinisch(etappen[0]?.vonOrt ?? toern.start_hafen?.name);
  const ende = lateinisch(etappen[etappen.length - 1]?.nachOrt ?? toern.rueckgabe_hafen?.name);
  return { ...(start ? { startpunkt: start } : {}), ...(ende ? { endpunkt: ende } : {}) };
}


function crewFuerBericht(crew: CrewEintrag[]): CrewMitglied[] {
  return crew
    .map((m) => {
      const p = m.profil;
      const vorname = p?.vorname ?? '';
      const nachname = p && 'nachname' in p ? (p.nachname ?? '') : '';
      return { vorname, nachname, funktion: m.funktion, funktionForm: m.funktionForm ?? null };
    })
    .filter((m) => m.vorname || m.nachname);
}


function toernFuerPdf(
  toern: ToernZeile, crew: CrewEintrag[], lokal: LokalerToern | null, motor: Motordaten | null,
): LokalerToern {
  const raus: LokalerToern = {
    id: toern.id,
    name: toern.name,
    schiff: toern.schiff,
    crew: crewFuerPdf(crew),
    angelegt: Date.parse(toern.angelegt),
  };
  if (toern.revier) raus.revier = toern.revier;
  if (toern.von) raus.von = toern.von;
  if (toern.bis) raus.bis = toern.bis;
  if (lokal?.unterschriften) raus.unterschriften = lokal.unterschriften;
  
  
  const stunden = motor?.motorstunden.length ? motor.motorstunden : lokal?.motorstunden;
  if (stunden?.length) raus.motorstunden = stunden;
  const liter = motor?.dieselGetanktL ?? lokal?.dieselGetanktL;
  if (liter !== undefined && liter !== null) raus.dieselGetanktL = liter;
  return raus;
}


function mitSpurAufbauen(quellen: FahrtPayload[]): FahrtMitSpur[] {
  const raus: FahrtMitSpur[] = [];
  for (const { fahrt: f, fixe, eintraege, orte: marken } of quellen) {
    if (!fixe.length) continue;
    const orte = orteAusMarken(marken);
    raus.push({
      id: f.id, fixe,
      ...(orte.start ? { vonOrt: lateinisch(orte.start) } : {}),
      ...(orte.ziel ? { nachOrt: lateinisch(orte.ziel) } : {}),
      ...(f.manuellePausen ? { manuellePausen: f.manuellePausen } : {}),
      wechsel: wechselAusEintraegen(eintraege),
      liegeOrte: marken.flatMap((m) => (m.name ? [{ t: m.t, name: m.name }] : [])),
    });
  }
  return raus;
}


let lauf = 0;


type VomServer = Map<string, GeholteSpur>;

function kandidatAus(q: FahrtPayload): Kandidat {
  let beginn: number | null = null;
  let ende: number | null = null;
  for (const f of q.fixe) {
    if (beginn === null || f.t < beginn) beginn = f.t;
    if (ende === null || f.t > ende) ende = f.t;
  }
  return { fahrtId: q.fahrt.id, lokal: true, anzahl: q.fixe.length, beginn, ende };
}


async function fremdeBilder(token: string, g: GeholteSpur): Promise<{ id: string; blob: Blob }[]> {
  const raus: { id: string; blob: Blob }[] = [];
  for (const b of g.bilder) {
    const blob = await holeBildBlob(token, g.payload.fahrt.id, g.vonUserId, b.id);
    if (blob) raus.push({ id: b.id, blob });
  }
  return raus;
}


export async function ladeStatistik(token: string, toern: ToernZeile): Promise<void> {
  const ziel = $('vb-statistik');
  if (!ziel) return;
  const meinLauf = ++lauf;
  ziel.innerHTML = '';
  delete ziel.dataset['kurz'];
  
  
  
  ziel.className = 'vb-hinweis';

  let fahrten: Fahrt[] = [];
  let quellen: FahrtPayload[] = [];
  let lokalerToern: LokalerToern | null = null;
  if (speicherVerfuegbar()) {
    try {
      
      
      await ordneEtappenToernZu().catch(() => 0);
      fahrten = await fahrtenZuToern(toern.id);
      quellen = await Promise.all(fahrten.map((f) => baueFahrtPayload(f)));
      lokalerToern = await holeLokalenToern(toern.id).catch(() => null);
    } catch {
      ziel.textContent = wort('detail.statistikFehler');
      return;
    }
  }
  if (meinLauf !== lauf) return;
  const lokalMotor = motordatenLeer(motordatenAus(lokalerToern)) ? null : motordatenAus(lokalerToern);
  const lokalGezeichnet = zeichne(ziel, token, toern, quellen, new Map(), lokalerToern, lokalMotor);
  if (!lokalGezeichnet) ziel.textContent = wort('detail.statistikLaedt');

  const nutzerId = liesEigeneNutzerId();
  if (nutzerId && fahrten.length) void sichereFahrten(token, nutzerId, fahrten);
  void ergaenzeVomServer(ziel, token, toern, quellen, lokalerToern, lokalMotor, meinLauf, lokalGezeichnet);
}

async function ergaenzeVomServer(
  ziel: HTMLElement, token: string, toern: ToernZeile, lokal: FahrtPayload[],
  lokalerToern: LokalerToern | null, lokalMotor: Motordaten | null, meinLauf: number, lokalGezeichnet: boolean,
): Promise<void> {
  const keineDaten = () => {
    if (meinLauf === lauf && !lokalGezeichnet) ziel.textContent = wort('detail.statistikKeineDaten');
  };
  const nutzerId = liesEigeneNutzerId();
  const [liste, motor] = await Promise.all([
    holeSpurListe(token, toern.id),
    nutzerId ? gleicheMotordatenAb(token, nutzerId, toern.id, lokalerToern) : Promise.resolve(lokalMotor),
  ]);
  if (meinLauf !== lauf) return;
  const lokalNachId = new Map(lokal.map((q) => [q.fahrt.id, q]));
  const kandidaten: Kandidat[] = [
    ...lokal.map(kandidatAus),
    ...(liste ?? []).map((m): Kandidat => ({
      fahrtId: m.fahrtId, lokal: false, anzahl: m.anzahlFixe, beginn: m.beginn, ende: m.ende, meta: m,
    })),
  ];
  const gewaehlt = waehleFahrten(kandidaten);
  const vomServer: VomServer = new Map();
  const quellen: FahrtPayload[] = [];
  for (const k of gewaehlt) {
    if (k.lokal) {
      const q = lokalNachId.get(k.fahrtId);
      if (q) quellen.push(q);
      continue;
    }
    const g = k.meta ? await holeSpur(token, k.meta) : null;
    if (meinLauf !== lauf) return;
    if (!g) continue;
    quellen.push(g.payload);
    vomServer.set(g.payload.fahrt.id, g);
  }
  quellen.sort((a, b) => a.fahrt.begonnen - b.fahrt.begonnen);
  
  
  const gleich = !vomServer.size && quellen.length === lokal.length
    && (motor?.dieselGetanktL ?? null) === (lokalMotor?.dieselGetanktL ?? null);
  if (gleich && lokalGezeichnet) return;
  if (!zeichne(ziel, token, toern, quellen, vomServer, lokalerToern, motor)) keineDaten();
}



let letzteQuellen: FahrtPayload[] = [];


export function spurPositionUm(t: number): { lat: number; lon: number } | null {
  const RAND = 10 * 60_000;
  for (const q of letzteQuellen) {
    const f = q.fixe;
    if (!f.length || t < f[0]!.t - RAND || t > f[f.length - 1]!.t + RAND) continue;
    let lo = 0, hi = f.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f[m]!.t <= t) lo = m; else hi = m; }
    const a = f[lo]!, b = f[hi]!;
    if (t <= a.t) return { lat: a.lat, lon: a.lon };
    if (t >= b.t) return { lat: b.lat, lon: b.lon };
    const k = (t - a.t) / (b.t - a.t);
    return { lat: a.lat + (b.lat - a.lat) * k, lon: a.lon + (b.lon - a.lon) * k };
  }
  return null;
}


export function revierZone(): string {
  return letzteQuellen.find((q) => q.fahrt.zeitzone)?.fahrt.zeitzone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}


export function tagIn(t: number, zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

function zeichne(
  ziel: HTMLElement, token: string, toern: ToernZeile, quellen: FahrtPayload[],
  vomServer: VomServer, lokalerToern: LokalerToern | null, motor: Motordaten | null,
): boolean {
  letzteQuellen = quellen;
  const mitSpur = mitSpurAufbauen(quellen);
  if (mitSpur.length === 0) return false;
  const b = toernBilanz(mitSpur);
  if (!b.etappen.length) return false;
  const fahrten = quellen.map((q) => q.fahrt);
  ziel.innerHTML = '';
  ziel.className = '';
  
  const teile = [`${nf(b.nm, 1)} ${sm()}`,
    wort(b.fahrtage === 1 ? 'statistik.kurzTag' : 'statistik.kurzTage', { n: String(b.fahrtage) })];
  if (b.nm > 0.05) teile.push(wort('statistik.kurzSegel', { p: nf(b.segel.prozent, 0) }));
  ziel.dataset['kurz'] = `${teile.join(' · ')}: ${wort('statistik.kurzDetails')}`;
  const fahrtenNachId = new Map(fahrten.map((f) => [f.id, f]));
  const quellenNachId = new Map(quellen.map((q) => [q.fahrt.id, q]));
  
  
  const fahrtag = fahrtagNummern(b.etappen, (b.tageOhneAufzeichnung ?? []).map((t) => t.tag));

  
  const tagesEingabe = async (
    fahrt: Fahrt, indizes: number[], lokal: LokalerToern | null,
  ): Promise<TagesblattEingabe> => {
    const quelle = quellenNachId.get(fahrt.id);
    if (!quelle) throw new Error('Fahrt fehlt');
    const { fixe, eintraege, orte } = quelle;
    
    
    
    const fern = vomServer.get(fahrt.id);
    const bilder = fern
      ? await bilderFuerBlatt(fahrt.id, await fremdeBilder(token, fern))
      : await bilderFuerBlatt(fahrt.id);
    
    
    const karte = await kartenbild(fixe, KARTE_PX.breite, KARTE_PX.hoehe).catch(() => null);
    const erste = b.etappen[indizes[0]!]!;
    
    const zone = fahrt.zeitzone ?? revierZone();
    const tag = tagIn(erste.von, zone);
    const liste = (await holeCrewFotos(token, toern.id)) ?? [];
    const heute = liste.filter((f) => tagIn(f.t, zone) === tag);
    const blobs = (await Promise.all(heute.map(async (f) => {
      const blob = await holeCrewFotoBlob(token, toern.id, f.id);
      return blob ? { id: f.id, blob } : null;
    }))).filter((x): x is { id: string; blob: Blob } => !!x);
    const gedruckt = new Map((await bilderFuerBlatt(`crew-${tag}`, blobs)).map((x) => [x.id, x]));
    const sprache = aktuelleSprache();
    const crewFotos = heute.flatMap((f) => {
      const g = gedruckt.get(f.id);
      if (!g) return [];
      
      const ortText = fotoOrtText(f, sprache);
      const ort = ortText ? lateinisch(ortText) : null;
      const von = f.von ? `${f.von.vorname} ${f.von.nachname}`.trim() : null;
      return [{ ...g, t: f.t, ort, von, text: f.text }];
    });
    const letzte = b.etappen[indizes[indizes.length - 1]!]!;
    return {
      fahrt, fixe, eintraege, orte, toern: lokal, bilder, crewFotos, sprache: aktuelleSprache(),
      toernName: toern.name, karte,
      tag: {
        nr: fahrtag[indizes[0]!] ?? indizes[0]! + 1,
        ...(erste.vonOrt ? { vonOrt: erste.vonOrt } : {}),
        ...(letzte.nachOrt ? { nachOrt: letzte.nachOrt } : {}),
        ...ablegenAnlegen(eintraege, erste.von, letzte.bis),
      },
    };
  };

  const status = document.createElement('p');
  status.className = 'vb-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  
  const kacheln = document.createElement('div');
  kacheln.className = 'vb-bilanz';
  
  
  const werte: [string, string][] = [
    [wort('statistik.strecke'), `${nf(b.nm, 1)} ${sm()}`],
    [wort('statistik.fahrtage'), String(b.fahrtage)],
    [wort('statistik.nachtfahrten'), String(b.nachtfahrten)],
    [wort('statistik.nachtansteuerungen'), String(b.nachtansteuerungen)],
    [wort('statistik.fahrzeit'), dauer(b.fahrzeitS)],
    [wort('statistik.schnitt'), nf(durchschnittKn(b), 1) + ' kn'],
  ];
  
  
  
  
  if (b.nm > 0.05) {
    werte.push(
      [wort('statistik.segel'), `${nf(b.segel.nm, 1)} ${sm()} (${nf(b.segel.prozent, 0)} %)`],
      [wort('statistik.motor'), `${nf(b.motor.nm, 1)} ${sm()} (${nf(b.motor.prozent, 0)} %)`],
    );
    if (b.offen.nm > 0.05) {
      werte.push([wort('statistik.offen'), `${nf(b.offen.nm, 1)} ${sm()} (${nf(b.offen.prozent, 0)} %)`]);
    }
  }
  
  
  const liter = motor?.dieselGetanktL ?? undefined;
  const jeStunde = dieselJeStunde(liter, b.motor.stunden);
  if (liter !== undefined && jeStunde !== null) {
    werte.push(
      [wort('statistik.dieselGetankt'), `${nf(liter, 0)} l`],
      [wort('statistik.dieselJeStunde'), `${nf(jeStunde, 1)} l/h`],
    );
  }
  for (const [label, wertText] of werte) {
    const d = document.createElement('div');
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = label;
    const w = document.createElement('span');
    w.className = 'v';
    w.textContent = wertText;
    d.append(k, w);
    kacheln.appendChild(d);
  }
  ziel.appendChild(kacheln);

  
  const aktionen = document.createElement('div');
  aktionen.className = 'vb-aktionen';
  const meilenKnopf = document.createElement('button');
  meilenKnopf.type = 'button';
  meilenKnopf.className = 'btn';
  meilenKnopf.innerHTML = icon('dokument') + wort('statistik.meilennachweis');
  meilenKnopf.addEventListener('click', () => {
    
    const tab = pdfZiel(wort('statistik.pdfLaedt'));
    void (async () => {
      status.textContent = wort('statistik.pdfLaedt');
      try {
        const [crew, lokal] = await Promise.all([
          holeCrew(token, toern.id), holeLokalenToern(toern.id),
        ]);
        const blob = await toernblatt({
          toern: toernFuerPdf(toern, crew ?? [], lokal, motor), bilanz: b, sprache: aktuelleSprache(),
          
          ...(fahrten.find((f) => f.zeitzone)?.zeitzone ? { zeitzone: fahrten.find((f) => f.zeitzone)!.zeitzone! } : {}),
        });
        await biete(blob, pdfDateiname('nachweis', toern.name, aktuelleSprache(), { von: toern.von ?? null, bis: toern.bis ?? null }), tab);
        status.textContent = '';
      } catch {
        verwirfZiel(tab);
        status.textContent = wort('statistik.pdfFehler');
      }
    })();
  });
  aktionen.appendChild(meilenKnopf);

  
  
  if (toernAbgeschlossen(toern)) {
    const berichtKnopf = document.createElement('button');
    berichtKnopf.type = 'button';
    berichtKnopf.className = 'btn';
    berichtKnopf.innerHTML = icon('dokument') + wort('statistik.toernbericht');
    
    const baueBericht = async (): Promise<Blob> => {
          const [crew, lokal] = await Promise.all([
            holeCrew(token, toern.id), holeLokalenToern(toern.id).catch(() => null),
          ]);
          const gruppen = etappenJeFahrt(b.etappen).filter((g) => fahrtenNachId.has(g.fahrt));
          const tage: TagesblattEingabe[] = [];
          for (const [k, g] of gruppen.entries()) {
            
            
            status.textContent = wort('statistik.berichtFortschritt', { n: String(k + 1), von: String(gruppen.length) });
            tage.push(await tagesEingabe(fahrtenNachId.get(g.fahrt)!, g.indizes, lokal));
          }
          
          
          status.textContent = wort('statistik.gewaesser');
          const punkte = stichprobe(tage.map((t) => t.fixe));
          const gebiete: (Awaited<ReturnType<typeof fetchSeegebiet>>)[] = [];
          for (let i = 0; i < punkte.length; i += 4) {
            gebiete.push(...await Promise.all(punkte.slice(i, i + 4).map((p) => fetchSeegebiet(p.lat, p.lon).catch(() => null))));
          }
          const gewaesser = gewaesserStaaten(gebiete, aktuelleSprache());
          status.textContent = wort('statistik.pdfLaedt');
          const alleFixe = tage.flatMap((t) => t.fixe);
          
          
          const schiffFoto = await fetch(schiffFotoUrl(toern.id), { signal: AbortSignal.timeout(15_000) })
            .then(async (r) => (r.ok ? (await bilderFuerBlatt('schiff', [{ id: 'schiff', blob: await r.blob() }]))[0] : undefined))
            .catch(() => undefined);
          const blob = await toernbericht({
            toern: { ...toernFuerPdf(toern, crew ?? [], lokal, motor), crew: crewFuerBericht(crew ?? []) },
            bilanz: b, sprache: aktuelleSprache(), fahrtag,
            ...(gewaesser.hoheit.length || gewaesser.awz.length ? { gewaesser } : {}),
            ...(schiffFoto ? { schiffFoto } : {}),
            spuren: tage.map((t) => ({
              fixe: t.fixe, nr: t.tag?.nr ?? 0, wechsel: wechselAusEintraegen(t.eintraege),
              ...(t.fahrt.manuellePausen ? { manuellePausen: t.fahrt.manuellePausen } : {}),
            })),
            karteFuer: (breite, hoehe) => kartenbild(alleFixe, breite, hoehe),
            tage,
            ...startUndEnde(toern, b.etappen),
          });
          return blob;
    };
    berichtKnopf.addEventListener('click', () => {
      const tab = pdfZiel(wort('statistik.pdfLaedt'));
      void (async () => {
        status.textContent = wort('statistik.pdfLaedt');
        berichtKnopf.disabled = true;
        try {
          await biete(await baueBericht(), pdfDateiname('bericht', toern.name, aktuelleSprache(), { von: toern.von ?? null, bis: toern.bis ?? null }), tab);
          status.textContent = '';
        } catch {
          verwirfZiel(tab);
          status.textContent = wort('statistik.pdfFehler');
        } finally {
          berichtKnopf.disabled = false;
        }
      })();
    });
    aktionen.appendChild(berichtKnopf);

    
    
    
    if (toern.besitzer === liesEigeneNutzerId()) {
      const sendeKnopf = document.createElement('button');
      sendeKnopf.type = 'button';
      sendeKnopf.className = 'btn';
      sendeKnopf.innerHTML = icon('brief') + wort('statistik.berichtSenden');
      const vermerk = document.createElement('p');
      vermerk.className = 'vb-hinweis';
      const zeigeVermerk = (am: string | null | undefined): void => {
        vermerk.textContent = am
          ? wort('statistik.berichtGesendetAm', { am: new Date(am).toLocaleString(aktuelleSprache() === 'en' ? 'en-GB' : 'de-AT', { dateStyle: 'medium', timeStyle: 'short' }) })
          : wort('statistik.berichtNochNicht');
      };
      zeigeVermerk(toern.toernbericht_gesendet_am);
      sendeKnopf.addEventListener('click', () => {
        if (!window.confirm(wort('statistik.berichtSendenFrage'))) return;
        void (async () => {
          sendeKnopf.disabled = true;
          status.textContent = wort('statistik.pdfLaedt');
          try {
            const blob = await baueBericht();
            status.textContent = wort('statistik.berichtWirdGesendet');
            const r = await sendeToernbericht(token, toern.id, blob, aktuelleSprache());
            if (r.lage === 'gesendet') {
              status.textContent = wort('statistik.berichtGesendet', { n: String(r.empfaenger) });
              toern.toernbericht_gesendet_am = r.am;
              zeigeVermerk(r.am);
            } else {
              status.textContent = wort(r.lage === 'keine-adresse' ? 'statistik.berichtKeineAdresse' : 'statistik.berichtFehler');
            }
          } catch {
            status.textContent = wort('statistik.pdfFehler');
          } finally {
            sendeKnopf.disabled = false;
          }
        })();
      });
      aktionen.appendChild(sendeKnopf);
      aktionen.appendChild(vermerk);
    }
  }
  ziel.appendChild(aktionen);
  ziel.appendChild(status);

  
  const h4 = document.createElement('h4');
  h4.textContent = wort('statistik.etappen');
  ziel.appendChild(h4);

  const liste = document.createElement('ul');
  liste.className = 'vb-etappen';
  b.etappen.forEach((e, i) => {
    const li = document.createElement('li');
    const orte = `${e.vonOrt ?? '?'} → ${e.nachOrt ?? '?'}`;
    const kopf = document.createElement('div');
    kopf.textContent = `${i + 1}. ${orte}`;
    const zahlen = document.createElement('div');
    zahlen.className = 'zahl';
    zahlen.textContent = `${nf(e.nm, 1)} ${sm()} · ${dauer(e.fahrzeitS)}`;
    li.append(kopf, zahlen);

    
    
    const antrieb = antriebZeile(e);
    if (antrieb) {
      const az = document.createElement('div');
      az.className = 'zahl';
      az.textContent = antrieb;
      li.appendChild(az);
    }

    const nacht: string[] = [];
    if (e.nachtfahrten) nacht.push(`${e.nachtfahrten}× ${wort('statistik.nachtfahrten')}`);
    if (e.nachtansteuerung) nacht.push(wort('statistik.nachtansteuerungen'));
    if (nacht.length) {
      const n = document.createElement('div');
      n.className = 'nacht';
      n.textContent = nacht.join(' · ');
      li.appendChild(n);
    }

    const fahrt = fahrtenNachId.get(e.fahrt);
    if (fahrt) {
      const tagKnopf = document.createElement('button');
      tagKnopf.type = 'button';
      tagKnopf.className = 'btn vb-etappen-pdf';
      tagKnopf.innerHTML = icon('dokument') + wort('statistik.tagesblatt');
      tagKnopf.addEventListener('click', () => {
        const tab = pdfZiel(wort('statistik.pdfLaedt'));
        void (async () => {
          status.textContent = wort('statistik.pdfLaedt');
          try {
            const lokal = await holeLokalenToern(toern.id).catch(() => null);
            const blob = await tagesblatt(await tagesEingabe(fahrt, [i], lokal));
            await biete(blob, pdfDateiname('blatt', toern.name, aktuelleSprache(), { tag: new Date(b.etappen[i]?.von ?? fahrt.begonnen).toISOString().slice(0, 10) }), tab);
            status.textContent = '';
          } catch {
            verwirfZiel(tab);
            status.textContent = wort('statistik.pdfFehler');
          }
        })();
      });
      li.appendChild(tagKnopf);
    }
    liste.appendChild(li);
  });
  ziel.appendChild(liste);

  if (liter !== undefined && jeStunde !== null) {
    const d = document.createElement('p');
    d.className = 'vb-luecken';
    d.textContent = wort('statistik.dieselHinweis', { h: nf(b.motor.stunden, 1) });
    ziel.appendChild(d);
  }

  if (b.lueckenAnzahl) {
    const l = document.createElement('p');
    l.className = 'vb-luecken';
    l.textContent = wort('statistik.luecken', { n: String(b.lueckenAnzahl), d: dauer(b.lueckenS) });
    ziel.appendChild(l);
  }

  
  
  if (vomServer.size) {
    const h = document.createElement('p');
    h.className = 'vb-luecken';
    h.textContent = wort(vomServer.size === quellen.length && !lokalerToern?.unterschriften
      ? 'statistik.vomServerAlle' : 'statistik.vomServerTeil');
    ziel.appendChild(h);
  }
  return true;
}
