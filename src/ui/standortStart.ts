import L from 'leaflet';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { icon } from '@/shell/icons';
import { startAusPosition } from '@/data/navroute';



const TEXT = {
  de: {
    titel: 'Start auf meine Position setzen',
    laeuft: 'Position wird bestimmt …',
    keinGeo: 'Dieser Browser kann keine Position bestimmen.',
    verweigert: 'Standortfreigabe verweigert: bitte in den Browser-Einstellungen erlauben.',
    fehlschlag: 'Position konnte nicht bestimmt werden.',
  },
  en: {
    titel: 'Set start to my position',
    laeuft: 'Getting position …',
    keinGeo: 'This browser cannot determine a position.',
    verweigert: 'Location access denied: please allow it in the browser settings.',
    fehlschlag: 'Could not determine the position.',
  },
} as const;


const MAX_ALTER_MS = 10_000;
const TIMEOUT_MS = 20_000;

export function addStandortStart(karte: L.Map, setzeStart: (lat: number, lon: number) => void): void {
  const Knopf = L.Control.extend({
    onAdd(): HTMLElement {
      const behaelter = L.DomUtil.create('div', 'leaflet-bar standort-start');
      
      
      L.DomEvent.disableClickPropagation(behaelter);
      L.DomEvent.disableScrollPropagation(behaelter);

      const knopf = L.DomUtil.create('button', 'standort-start-knopf', behaelter) as HTMLButtonElement;
      knopf.type = 'button';
      knopf.innerHTML = icon('zentrieren');

      const meldung = L.DomUtil.create('p', 'standort-start-meldung', behaelter);
      meldung.setAttribute('role', 'status');
      meldung.hidden = true;

      let meldungsSchluessel: keyof typeof TEXT['de'] | null = null;
      function zeige(schluessel: keyof typeof TEXT['de'] | null): void {
        meldungsSchluessel = schluessel;
        meldung.hidden = schluessel === null;
        meldung.textContent = schluessel ? TEXT[aktuelleSprache()][schluessel] : '';
      }
      function lokalisiere(): void {
        const t = TEXT[aktuelleSprache()];
        knopf.title = t.titel;
        knopf.setAttribute('aria-label', t.titel);
        zeige(meldungsSchluessel);
      }

      knopf.addEventListener('click', () => {
        if (!('geolocation' in navigator)) { zeige('keinGeo'); return; }
        knopf.disabled = true;
        zeige('laeuft');
        
        
        
        
        
        const frist = setTimeout(() => {
          knopf.disabled = false;
          zeige('fehlschlag');
        }, TIMEOUT_MS + 5_000);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(frist);
            const { latitude: lat, longitude: lon } = pos.coords;
            
            
            void startAusPosition({ lat, lon }).catch(() => null).then((r) => {
              knopf.disabled = false;
              zeige(null);
              setzeStart(r?.punkt.lat ?? lat, r?.punkt.lon ?? lon);
            });
          },
          (err) => {
            clearTimeout(frist);
            knopf.disabled = false;
            zeige(err.code === err.PERMISSION_DENIED ? 'verweigert' : 'fehlschlag');
          },
          { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: MAX_ALTER_MS },
        );
      });

      lokalisiere();
      aufSprachwechsel(lokalisiere);
      return behaelter;
    },
  });

  new Knopf({ position: 'bottomleft' }).addTo(karte);
}


export function startBeimOeffnen(
  istLeer: () => boolean,
  startPunkt: (lat: number, lon: number) => Promise<{ lat: number; lon: number } | null>,
  setzeStart: (lat: number, lon: number) => void,
  zentriere?: (lat: number, lon: number) => void,
): void {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      if (!istLeer()) return;
      zentriere?.(lat, lon);
      void startPunkt(lat, lon).then((s) => { if (s && istLeer()) setzeStart(s.lat, s.lon); }).catch(() => {});
    },
    () => {},
    { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 60_000 },
  );
}
