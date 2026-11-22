import { nf } from '@/core/time';
import { navigatorbericht, type Berichtsblock, type BerichtFahrt } from '@/core/navigatorbericht';
import { wechselAusEintraegen } from '@/core/antriebsbilanz';
import { dieselJeStunde } from '@/core/dieselverbrauch';
import { fahrtenZuToern, ladeFixe, ladeEintraege, holeToern } from '@/data/logdb';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { STRINGS } from './strings';



const $ = (id: string): HTMLElement | null => document.getElementById(id);
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;

let modalGriff: ModalHandle | null = null;

function schliesse(): void {
  const m = $('tb-statistik');
  if (!m || m.hidden) return;
  m.hidden = true;
  modalGriff?.beimSchliessen();
}


function zeile(
  label: string,
  nm: number,
  prozent: number | null,
  knoten: number,
  sprache: 'de' | 'en',
): string {
  const sm = sprache === 'en' ? 'NM' : 'sm';
  const anteil = prozent === null ? '' : `${nf(prozent, 0, sprache)} %`;
  const schnitt = knoten > 0 ? `${nf(knoten, 1, sprache)} kn` : '–';
  return `<tr><th scope="row">${label}</th>`
    + `<td>${nf(nm, 1, sprache)} ${sm}</td><td>${anteil}</td><td>${schnitt}</td></tr>`;
}

function block(b: Berichtsblock, titel: string, sprache: 'de' | 'en'): string {
  
  
  if (b.nm <= 0.05) {
    return `<h3 class="tb-stat-titel">${titel}</h3>`
      + `<p class="tb-hinweis">${wort('statistik.nochNichts')}</p>`;
  }
  const zeilen = [
    zeile(wort('statistik.gesamtstrecke'), b.nm, null, b.knoten, sprache),
    zeile(wort('statistik.segel'), b.segel.nm, b.segel.prozent, b.segel.knoten, sprache),
    zeile(wort('statistik.motor'), b.motor.nm, b.motor.prozent, b.motor.knoten, sprache),
  ];
  
  
  if (b.offen.nm > 0.05) {
    zeilen.push(zeile(wort('statistik.offen'), b.offen.nm, b.offen.prozent, b.offen.knoten, sprache));
  }
  return `<h3 class="tb-stat-titel">${titel}</h3>`
    + '<table class="tb-stat-tabelle"><thead><tr>'
    + `<th scope="col">${wort('statistik.spalteArt')}</th>`
    + `<th scope="col">${wort('statistik.spalteStrecke')}</th>`
    + `<th scope="col">${wort('statistik.spalteAnteil')}</th>`
    + `<th scope="col">${wort('statistik.spalteSchnitt')}</th>`
    + `</tr></thead><tbody>${zeilen.join('')}</tbody></table>`;
}


export async function zeigeStatistik(toernId: string | null,
  position: { lat: number; lon: number } | null): Promise<void> {
  const modal = $('tb-statistik');
  const inhalt = $('tb-statistik-inhalt');
  if (!modal || !inhalt) return;
  if (!modalGriff) modalGriff = initModal(modal, schliesse);

  modal.hidden = false;
  modalGriff.beimOeffnen();
  inhalt.innerHTML = `<p class="tb-hinweis">${wort('statistik.laedt')}</p>`;

  if (!toernId) {
    inhalt.innerHTML = `<p class="tb-hinweis">${wort('statistik.keinToern')}</p>`;
    return;
  }

  try {
    const fahrten = await fahrtenZuToern(toernId);
    const mitSpur: BerichtFahrt[] = [];
    for (const f of fahrten) {
      const [fixe, eintraege] = await Promise.all([ladeFixe(f.id), ladeEintraege(f.id)]);
      mitSpur.push({
        fixe, wechsel: wechselAusEintraegen(eintraege),
        ...(f.manuellePausen ? { manuellePausen: f.manuellePausen } : {}),
      });
    }
    
    
    
    const letzteAusSpur = mitSpur
      .flatMap((f) => f.fixe)
      .reduce<{ lat: number; lon: number; t: number } | null>(
        (best, f) => (best === null || f.t > best.t ? { lat: f.lat, lon: f.lon, t: f.t } : best),
        null,
      );
    const ort = position ?? (letzteAusSpur ? { lat: letzteAusSpur.lat, lon: letzteAusSpur.lon } : null);
    const sprache = aktuelleSprache();
    const bericht = navigatorbericht(mitSpur, Date.now(), ort);
    
    
    const liter = (await holeToern(toernId).catch(() => null))?.dieselGetanktL;
    const jeStunde = dieselJeStunde(liter, bericht.gesamt.motor.stunden);
    const diesel = liter !== undefined && jeStunde !== null
      ? `<p class="tb-hinweis">${wort('statistik.diesel')
        .replace('{v}', nf(jeStunde, 1, sprache))
        .replace('{l}', nf(liter, 0, sprache))
        .replace('{h}', nf(bericht.gesamt.motor.stunden, 1, sprache))}</p>`
      : '';
    inhalt.innerHTML = block(bericht.gesamt, wort('statistik.gesamt'), sprache)
      + diesel
      + block(bericht.heute, wort('statistik.heute'), sprache);
  } catch {
    inhalt.innerHTML = `<p class="tb-fehler">${wort('statistik.fehler')}</p>`;
  }
}

export function initStatistik(): void {
  $('btn-statistik-zu')?.addEventListener('click', schliesse);
}
