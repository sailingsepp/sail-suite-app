import './support.css';
import { API_BASIS } from './api';
import { liesSitzungsToken, ANMELDUNG_PER_COOKIE } from './session';
import { initModal } from './modal';
import { icon } from './icons';
import type { Sprache } from '@/core/types';

export type SupportApp = 'suite' | 'coursecast' | 'trackbook' | 'voyagebook' | 'voyageplan';
const APPS: readonly SupportApp[] = ['suite', 'coursecast', 'trackbook', 'voyagebook', 'voyageplan'];
const KATEGORIEN = ['technisch', 'bedienung', 'daten', 'karten', 'vorschlag', 'feedback', 'datenschutz', 'sonstiges'] as const;
type Kategorie = typeof KATEGORIEN[number];
const MIT_ISSUE: readonly Kategorie[] = ['technisch', 'vorschlag'];
const TEXT_MIN = 10;
const TEXT_MAX = 5000;

const T: Record<Sprache, {
  menue: string; titel: string; einleitung: string; app: string; email: string; kategorie: string; text: string;
  textPlatzhalter: string; senden: string; abbrechen: string; schliessen: string; sendet: string; ok: string; okIssue: string;
  fehler: string; zuViele: string; fehltEmail: string; fehltText: string; issueHinweis: string; wahl: string;
  appName: Record<SupportApp, string>; kat: Record<Kategorie, string>;
}> = {
  de: {
    menue: 'Support', titel: 'Support', einleitung: 'Frage, Problem oder Vorschlag: Die Nachricht geht per E-Mail an den Betreiber der Sail-Suite, die Antwort an deine Adresse.',
    app: 'App', email: 'Deine E-Mail-Adresse', kategorie: 'Anliegen', text: 'Beschreibung',
    textPlatzhalter: 'Was ist passiert, was hast du erwartet? Bei einem Fehler: Schritte, Route und Tag.',
    senden: 'Senden', abbrechen: 'Abbrechen', schliessen: 'Schließen', sendet: 'Wird gesendet …',
    ok: 'Danke, die Nachricht ist angekommen. Die Antwort kommt an deine E-Mail-Adresse, bitte auch im Spam-Ordner nachsehen.',
    okIssue: 'Danke, die Nachricht ist angekommen und als Aufgabe im Projekt angelegt. Die Antwort kommt an deine E-Mail-Adresse, bitte auch im Spam-Ordner nachsehen.',
    fehler: 'Senden hat nicht geklappt. Bitte später noch einmal versuchen.', zuViele: 'Zu viele Anfragen kurz hintereinander. Bitte in ein paar Minuten noch einmal.',
    fehltEmail: 'Bitte eine gültige E-Mail-Adresse eintragen.', fehltText: `Bitte das Anliegen beschreiben (mindestens ${TEXT_MIN} Zeichen).`,
    issueHinweis: 'Technische Probleme und Vorschläge werden zusätzlich als Aufgabe im (nicht öffentlichen) Projekt angelegt, ohne deine E-Mail-Adresse.',
    wahl: 'Bitte wählen …',
    appName: { suite: 'Sail-Suite allgemein', coursecast: 'Tagesplanung', trackbook: 'TörnNavLog', voyagebook: 'TörnBuch', voyageplan: 'Törnplanung' },
    kat: {
      technisch: 'Technisches Problem', bedienung: 'Frage zur Bedienung', daten: 'Problem mit Daten', karten: 'Karten & Navigation',
      vorschlag: 'Verbesserungsvorschlag / neue Funktion', feedback: 'Feedback zu Sail-Suite', datenschutz: 'Datenschutz & Konto', sonstiges: 'Sonstige Anfrage',
    },
  },
  en: {
    menue: 'Support', titel: 'Support', einleitung: 'Question, problem or suggestion: the message goes by e-mail to the operator of Sail-Suite, the reply to your address.',
    app: 'App', email: 'Your e-mail address', kategorie: 'Topic', text: 'Description',
    textPlatzhalter: 'What happened, what did you expect? For an error: steps, route and day.',
    senden: 'Send', abbrechen: 'Cancel', schliessen: 'Close', sendet: 'Sending …',
    ok: 'Thank you, the message has arrived. The reply will go to your e-mail address; please check your spam folder too.',
    okIssue: 'Thank you, the message has arrived and has been filed as a task in the project. The reply will go to your e-mail address; please check your spam folder too.',
    fehler: 'Sending did not work. Please try again later.', zuViele: 'Too many requests in a short time. Please try again in a few minutes.',
    fehltEmail: 'Please enter a valid e-mail address.', fehltText: `Please describe your request (at least ${TEXT_MIN} characters).`,
    issueHinweis: 'Technical problems and suggestions are also filed as a task in the (non-public) project, without your e-mail address.',
    wahl: 'Please choose …',
    appName: { suite: 'Sail-Suite in general', coursecast: 'CourseCast', trackbook: 'SailPilot', voyagebook: 'VoyageBook', voyageplan: 'VoyagePlan' },
    kat: {
      technisch: 'Technical problem', bedienung: 'Question about use', daten: 'Problem with data', karten: 'Charts & navigation',
      vorschlag: 'Suggestion / new feature', feedback: 'Feedback on Sail-Suite', datenschutz: 'Privacy & account', sonstiges: 'Other request',
    },
  },
};

const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[^\s@<>".]{2,}$/;

let overlay: HTMLDivElement | null = null;
let modal: ReturnType<typeof initModal> | null = null;

function schliessen(): void {
  if (!overlay) return;
  overlay.hidden = true;
  modal?.beimSchliessen();
}

const sprache = (): Sprache => (document.documentElement.lang === 'en' ? 'en' : 'de');

async function kontoAdresse(): Promise<string | null> {
  const token = liesSitzungsToken();
  if (!token) return null;
  try {
    const kopf: Record<string, string> = {};
    if (token !== ANMELDUNG_PER_COOKIE) kopf['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASIS}/api/me`, { headers: kopf, credentials: 'include', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json() as { email?: string | null };
    return j.email ?? null;
  } catch {
    return null;
  }
}

function baueDialog(app: SupportApp, sp: Sprache): HTMLDivElement {
  const t = T[sp];
  const el = document.createElement('div');
  el.className = 'sup-overlay';
  el.hidden = true;
  el.innerHTML = `
    <div class="sup-modal" role="dialog" aria-modal="true" aria-labelledby="sup-titel" tabindex="-1">
      <button type="button" class="sup-zu" aria-label="${t.schliessen}">✕</button>
      <h2 id="sup-titel">${t.titel}</h2>
      <p class="sup-hinweis">${t.einleitung}</p>
      <form class="sup-form" novalidate>
        <label>${t.app}
          <select name="app">${APPS.map((a) => `<option value="${a}"${a === app ? ' selected' : ''}>${t.appName[a]}</option>`).join('')}</select>
        </label>
        <label>${t.email}
          <input type="email" name="email" autocomplete="email" maxlength="254" required>
        </label>
        <label>${t.kategorie}
          <select name="kategorie" required><option value="">${t.wahl}</option>${KATEGORIEN.map((k, i) => `<option value="${k}">${i + 1}. ${t.kat[k]}</option>`).join('')}</select>
        </label>
        <p class="sup-hinweis sup-issue" hidden>${t.issueHinweis}</p>
        <label>${t.text}
          <textarea name="text" rows="6" maxlength="${TEXT_MAX}" required placeholder="${t.textPlatzhalter}"></textarea>
        </label>
        <input type="text" name="website" class="sup-honig" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="sup-status" role="status" aria-live="polite"></p>
        <div class="sup-aktionen">
          <button type="submit" class="sup-senden">${t.senden}</button>
          <button type="button" class="sup-abbrechen">${t.abbrechen}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(el);
  const form = el.querySelector('form')!;
  const status = el.querySelector<HTMLElement>('.sup-status')!;
  const kategorie = form.elements.namedItem('kategorie') as HTMLSelectElement;
  const issueHinweis = el.querySelector<HTMLElement>('.sup-issue')!;
  kategorie.addEventListener('change', () => { issueHinweis.hidden = !MIT_ISSUE.includes(kategorie.value as Kategorie); });
  el.querySelector('.sup-zu')!.addEventListener('click', schliessen);
  el.querySelector('.sup-abbrechen')!.addEventListener('click', schliessen);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void (async () => {
      const feld = (n: string): HTMLInputElement => form.elements.namedItem(n) as HTMLInputElement;
      const email = feld('email').value.trim();
      const text = feld('text').value.trim();
      for (const n of ['email', 'kategorie', 'text']) feld(n).removeAttribute('aria-invalid');
      if (!EMAIL.test(email)) { feld('email').setAttribute('aria-invalid', 'true'); status.textContent = t.fehltEmail; feld('email').focus(); return; }
      if (!kategorie.value) { kategorie.setAttribute('aria-invalid', 'true'); status.textContent = `${t.kategorie}: ${t.wahl}`; kategorie.focus(); return; }
      if (text.length < TEXT_MIN) { feld('text').setAttribute('aria-invalid', 'true'); status.textContent = t.fehltText; feld('text').focus(); return; }
      const knopf = el.querySelector<HTMLButtonElement>('.sup-senden')!;
      knopf.disabled = true;
      status.textContent = t.sendet;
      try {
        const version = document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content;
        const res = await fetch(`${API_BASIS}/api/support`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({
            app: (form.elements.namedItem('app') as HTMLSelectElement).value, kategorie: kategorie.value,
            email, text, website: feld('website').value, ...(version ? { version } : {}),
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 429) { status.textContent = t.zuViele; return; }
        if (!res.ok) { status.textContent = t.fehler; return; }
        const j = await res.json() as { issue?: boolean };
        status.textContent = j.issue ? t.okIssue : t.ok;
        feld('text').value = '';
        kategorie.value = '';
        issueHinweis.hidden = true;
      } catch {
        status.textContent = t.fehler;
      } finally {
        knopf.disabled = false;
      }
    })();
  });
  return el;
}

function oeffne(app: SupportApp): void {
  const sp = sprache();

  if (overlay && overlay.dataset['sprache'] !== sp) { overlay.remove(); overlay = null; }
  if (!overlay) {
    overlay = baueDialog(app, sp);
    overlay.dataset['sprache'] = sp;
    modal = initModal(overlay.querySelector<HTMLElement>('.sup-modal')!, schliessen);
  }
  const email = overlay.querySelector<HTMLInputElement>('input[name="email"]')!;
  overlay.querySelector<HTMLParagraphElement>('.sup-status')!.textContent = '';
  overlay.hidden = false;
  modal?.beimOeffnen(undefined, email.value ? overlay.querySelector<HTMLSelectElement>('select[name="kategorie"]') : email);
  if (!email.value) void kontoAdresse().then((a) => { if (a && !email.value) email.value = a; });
}

export function initSupport(app: SupportApp): void {
  const panel = document.getElementById('menu-panel');
  if (!panel || panel.querySelector('#btn-support')) return;
  const ziel = document.getElementById('menu-hilfe') ?? panel;
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.id = 'btn-support';
  knopf.className = 'menu-link';
  knopf.innerHTML = `${icon('rettungsring')}<span>${T[sprache()].menue}</span>`;
  knopf.addEventListener('click', () => {
    panel.hidden = true;
    document.getElementById('btn-menu')?.setAttribute('aria-expanded', 'false');
    oeffne(app);
  });
  ziel.appendChild(knopf);
}
