import type { Sprache } from '@/core/types';

export interface TourSchritt {
  titel: string;
  text: string;
}

export const SUITE: Record<Sprache, string> = {
  de: 'Sail-Suite',
  en: 'Sail-Suite',
};

export const SCHALE_STRINGS: Record<Sprache, Record<string, string>> = {
  de: {
    'theme.title': 'Ansicht',
    'theme.day': 'Tag',
    'theme.night': 'Nacht',
    'theme.auto': 'Auto',
    'sprache.title': 'Sprache / Language',
    'menu.merken': 'Auswahl merken',
    'aria.menue': 'Menü', 'aria.konto': 'Konto', 'aria.schliessen': 'Schließen', 'aria.zentrieren': 'Zentrieren',
    'menu.tour': 'Einführung',
    'menu.gruppe.einstellungen': 'Einstellungen',
    'menu.gruppe.hilfeInfo': 'Hilfe und Info',
    'menu.kompendium': 'Kompendium',
    'kompendium.titel': 'Nautisches Kompendium',
    'kompendium.schliessen': 'Kompendium schließen',
    'kompendium.navigation': 'Abschnitte des Kompendiums',
    'kompendium.laedt': 'Kompendium wird geladen …',
    'kompendium.fehlt': 'Das Kompendium konnte nicht geladen werden. Einmal mit Netz öffnen, danach geht es auch ohne.',
    'kompendium.hinweis': 'Nachschlagehilfe: ersetzt weder KVR-Text noch Seekarte, Leuchtfeuerverzeichnis oder Gezeitentafel.',

    'menu.technik': 'Technik an Bord',
    'technik.titel': 'Technik an Bord',
    'technik.fensterZu': 'Technik an Bord schließen',
    'technik.reiter': 'Technik',
    'technik.sucheTitel': 'Suche in den Handbüchern',
    'technik.suchePlatzhalter': 'z. B. Kanal einstellen, Dual Watch, Ölwechsel',
    'technik.filter': 'Handbücher',
    'technik.filterAlle': 'Alle Handbücher',
    'technik.filterYacht': 'Yacht {yacht}',
    'technik.listeTitel': 'Handbücher auf diesem Gerät',
    'technik.listeHinweis': 'Nur auf diesem Gerät gespeichert. Suche und Seitenansicht ohne Netz.',
    'technik.hinzufuegen': 'Handbuch hinzufügen (PDF)',
    'technik.bezeichnung': 'Bezeichnung',
    'technik.geraet': 'Gerät',
    'technik.yacht': 'Yacht',
    'technik.yachtAlle': 'alle Yachten',
    'technik.indexieren': 'Indexieren und speichern',
    'technik.abbrechen': 'Abbrechen',
    'technik.geraet.funk': 'Funkgerät',
    'technik.geraet.plotter': 'Plotter und Navigation',
    'technik.geraet.autopilot': 'Autopilot',
    'technik.geraet.instrumente': 'Instrumente',
    'technik.geraet.motor': 'Motor',
    'technik.geraet.elektrik': 'Elektrik',
    'technik.geraet.versorgung': 'Versorgung an Bord',
    'technik.geraet.sonstiges': 'Sonstiges',
    'technik.leer': 'Noch keine Handbücher auf diesem Gerät.',
    'technik.seiten': '{n} Seiten',
    'technik.seite': 'S. {nr}',
    'technik.seiteMitPdf': 'S. {name} (PDF {nr})',
    'technik.ohneText': 'ohne Textebene, Suche findet darin wenig',
    'technik.ohneTextLang': 'Die meisten Seiten haben keine Textebene (gescannt). Blättern geht, die Suche findet darin wenig.',
    'technik.oeffnen': 'Öffnen',
    'technik.loeschen': 'Löschen',
    'technik.loeschenAria': '{titel} löschen',
    'technik.loeschenFrage': '„{titel}“ von diesem Gerät löschen?',
    'technik.geloescht': 'Gelöscht: {titel}.',
    'technik.sucheOhneHandbuch': 'Zuerst ein Handbuch hinzufügen.',
    'technik.indexLaedt': 'Index wird geladen …',
    'technik.treffer': '{n} Fundstellen',
    'technik.einTreffer': '1 Fundstelle',
    'technik.keineTreffer': 'Keine Fundstelle.',
    'technik.teilweise': '{a} von {b} Begriffen',
    'technik.keinPdf': 'Bitte eine PDF-Datei wählen.',
    'technik.doppelt': 'Dieses Handbuch ist schon gespeichert: {titel}.',
    'technik.speicherVoll': 'Zu wenig Speicher auf diesem Gerät für dieses Handbuch.',
    'technik.liest': 'PDF wird gelesen …',
    'technik.fortschritt': 'Seite {n} von {von} gelesen …',
    'technik.abgebrochen': 'Abgebrochen, nichts gespeichert.',
    'technik.gespeichert': 'Gespeichert: {titel}, {n} Seiten.',
    'technik.speichernFehler': 'Speichern auf diesem Gerät ist fehlgeschlagen.',
    'technik.passwort': 'Das PDF ist passwortgeschützt und lässt sich nicht lesen.',
    'technik.lesefehler': 'Das PDF ließ sich nicht lesen.',
    'technik.vorige': 'Vorige Seite',
    'technik.naechste': 'Nächste Seite',
    'technik.schliessen': 'Schließen',
    'technik.laedt': 'Lädt …',
    'technik.anzeigeFehler': 'Die Seite ließ sich nicht anzeigen.',
    'offline.stand': 'Ohne Netz: Stand vom {zeit}. Ändern geht erst wieder mit Netz.',
    'offline.wieder': 'Wieder Netz. Angezeigt ist noch der Stand vom {zeit}.',
    'offline.neuLaden': 'Neu laden',
    'menu.suite': 'Alle Apps',
    'menu.profil': 'Profil',
    'menu.passwort': 'Passwort ändern',
    'menu.betrieb': 'Betrieb',
    'menu.logout': 'Abmelden',
    'menu.logoutAlle': 'Auf allen Geräten abmelden',

    'footer.copyright': '© 2026 Sail-Suite · Alle Rechte vorbehalten.<br>Entwickelt von Sepp · Österreich',
    'footer.version': 'Version',
    'footer.sourcesSummary': 'Datenquellen & Lizenzen',
    'footer.disclaimerSummary': 'Hinweise & Haftungsausschluss',
    'footer.legalLinks': 'Rechtliches: <a href="/#impressum">Impressum</a> · <a href="/#datenschutz">Datenschutzerklärung</a> · <a href="/#urheberrecht">Urheberrecht &amp; Lizenzierung</a>',
  },
  en: {
    'theme.title': 'View',
    'theme.day': 'Day',
    'theme.night': 'Night',
    'theme.auto': 'Auto',
    'sprache.title': 'Sprache / Language',
    'menu.merken': 'Remember choice',
    'aria.menue': 'Menu', 'aria.konto': 'Account', 'aria.schliessen': 'Close', 'aria.zentrieren': 'Centre boat',
    'menu.tour': 'Introduction',
    'menu.gruppe.einstellungen': 'Settings',
    'menu.gruppe.hilfeInfo': 'Help and info',
    'menu.kompendium': 'Compendium',
    'kompendium.titel': 'Nautical compendium',
    'kompendium.schliessen': 'Close compendium',
    'kompendium.navigation': 'Compendium sections',
    'kompendium.laedt': 'Loading the compendium …',
    'kompendium.fehlt': 'The compendium could not be loaded. Open it once with a connection; after that it works offline.',
    'kompendium.hinweis': 'A reference aid: it does not replace the text of the COLREGs, the chart, the List of Lights or the tide tables.',

    'menu.technik': 'Equipment on board',
    'technik.titel': 'Equipment on board',
    'technik.fensterZu': 'Close equipment on board',
    'technik.reiter': 'Equipment',
    'technik.sucheTitel': 'Search the manuals',
    'technik.suchePlatzhalter': 'e.g. set channel, dual watch, oil change',
    'technik.filter': 'Manuals',
    'technik.filterAlle': 'All manuals',
    'technik.filterYacht': 'Yacht {yacht}',
    'technik.listeTitel': 'Manuals on this device',
    'technik.listeHinweis': 'Stored on this device only. Search and page view work offline.',
    'technik.hinzufuegen': 'Add manual (PDF)',
    'technik.bezeichnung': 'Name',
    'technik.geraet': 'Equipment',
    'technik.yacht': 'Yacht',
    'technik.yachtAlle': 'all yachts',
    'technik.indexieren': 'Index and save',
    'technik.abbrechen': 'Cancel',
    'technik.geraet.funk': 'VHF radio',
    'technik.geraet.plotter': 'Plotter and navigation',
    'technik.geraet.autopilot': 'Autopilot',
    'technik.geraet.instrumente': 'Instruments',
    'technik.geraet.motor': 'Engine',
    'technik.geraet.elektrik': 'Electrical',
    'technik.geraet.versorgung': 'Domestic systems',
    'technik.geraet.sonstiges': 'Other',
    'technik.leer': 'No manuals on this device yet.',
    'technik.seiten': '{n} pages',
    'technik.seite': 'p. {nr}',
    'technik.seiteMitPdf': 'p. {name} (PDF {nr})',
    'technik.ohneText': 'no text layer, search finds little',
    'technik.ohneTextLang': 'Most pages have no text layer (scanned). Paging works, the search finds little.',
    'technik.oeffnen': 'Open',
    'technik.loeschen': 'Delete',
    'technik.loeschenAria': 'Delete {titel}',
    'technik.loeschenFrage': 'Delete "{titel}" from this device?',
    'technik.geloescht': 'Deleted: {titel}.',
    'technik.sucheOhneHandbuch': 'Add a manual first.',
    'technik.indexLaedt': 'Loading index …',
    'technik.treffer': '{n} matches',
    'technik.einTreffer': '1 match',
    'technik.keineTreffer': 'No match.',
    'technik.teilweise': '{a} of {b} terms',
    'technik.keinPdf': 'Please choose a PDF file.',
    'technik.doppelt': 'This manual is already saved: {titel}.',
    'technik.speicherVoll': 'Not enough storage on this device for this manual.',
    'technik.liest': 'Reading PDF …',
    'technik.fortschritt': 'Read page {n} of {von} …',
    'technik.abgebrochen': 'Cancelled, nothing saved.',
    'technik.gespeichert': 'Saved: {titel}, {n} pages.',
    'technik.speichernFehler': 'Saving on this device failed.',
    'technik.passwort': 'The PDF is password-protected and cannot be read.',
    'technik.lesefehler': 'The PDF could not be read.',
    'technik.vorige': 'Previous page',
    'technik.naechste': 'Next page',
    'technik.schliessen': 'Close',
    'technik.laedt': 'Loading …',
    'technik.anzeigeFehler': 'The page could not be displayed.',
    'offline.stand': 'Offline: data as of {zeit}. Changes need a connection.',
    'offline.wieder': 'Back online. The data shown is still from {zeit}.',
    'offline.neuLaden': 'Reload',
    'menu.suite': 'All apps',
    'menu.profil': 'Profile',
    'menu.passwort': 'Change password',
    'menu.betrieb': 'Operations',
    'menu.logout': 'Log out',
    'menu.logoutAlle': 'Log out on all devices',
    'footer.copyright': '© 2026 Sail-Suite · All rights reserved.<br>Developed by Sepp · Austria',
    'footer.version': 'Version',
    'footer.sourcesSummary': 'Data sources & licences',
    'footer.disclaimerSummary': 'Notes & disclaimer',
    'footer.legalLinks': 'Legal: <a href="/#impressum">Legal notice</a> · <a href="/#datenschutz">Privacy policy</a> · <a href="/#urheberrecht">Copyright &amp; licensing</a>',
  },
};

export interface AppTexte {

  titel: Record<Sprache, string>;

  beschreibung: Record<Sprache, string>;

  strings: Record<Sprache, Record<string, string>>;

  tour: Record<Sprache, TourSchritt[]>;
}

let app: AppTexte | null = null;

export function setzeAppTexte(texte: AppTexte): void {
  app = texte;
}

function pflicht(): AppTexte {
  if (!app) {
    throw new Error(
      'setzeAppTexte() wurde nicht aufgerufen: die App muss ihre Texte anmelden, ' +
        'bevor die Schale sie anwendet (vor initSprache()).',
    );
  }
  return app;
}

export function woerter(sprache: Sprache): Record<string, string> {
  return { ...SCHALE_STRINGS[sprache], ...pflicht().strings[sprache] };
}

export function appTitel(sprache: Sprache): string {
  return pflicht().titel[sprache];
}

export function appBeschreibung(sprache: Sprache): string {
  return pflicht().beschreibung[sprache];
}

export function tourSchritte(sprache: Sprache): TourSchritt[] {
  return pflicht().tour[sprache];
}
