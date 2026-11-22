import { API_BASIS } from './api';
import { loescheLesestand } from './lesestand';


const SESSION_COOKIE = 'session';

const ANGEMELDET_COOKIE = 'angemeldet';

export const ANMELDUNG_PER_COOKIE = 'cookie';

const COOKIE_DOMAIN = 'sail-suite.app';


function loescheCookie(): void {
  try {
    for (const name of [SESSION_COOKIE, ANGEMELDET_COOKIE]) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
      document.cookie = `${name}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
    }
  } catch {
    
  }
}


export function meldeAb(): void {
  
  const fertig = (): void => { loescheCookie(); void loescheLesestand().finally(() => { window.location.href = '/'; }); };
  fetch(`${API_BASIS}/api/auth/abmelden`, {
    method: 'POST', credentials: 'include', signal: AbortSignal.timeout(3000),
  }).then(fertig, fertig);
}


export function initLogout(buttonId = 'btn-logout'): void {
  const btn = document.getElementById(buttonId);
  if (btn) btn.addEventListener('click', meldeAb);
}


interface ProfilAntwort { profil: { vorname?: string; nachname?: string } | null }
interface MeAntwort { username: string | null; hatPasswort?: boolean; istAdmin?: boolean }


async function holeAnzeigename(token: string): Promise<string | null> {
  try {
    const kopf = { Authorization: `Bearer ${token}` };
    const [profilRes, meRes] = await Promise.all([
      fetch(`${API_BASIS}/api/profil`, { headers: kopf, credentials: 'include' }),
      fetch(`${API_BASIS}/api/me`, { headers: kopf, credentials: 'include' }),
    ]);
    if (profilRes.ok) {
      const j = await profilRes.json() as ProfilAntwort;
      const teile = [j.profil?.vorname, j.profil?.nachname].filter((t): t is string => Boolean(t));
      if (teile.length) return teile.join(' ');
    }
    if (meRes.ok) {
      const j = await meRes.json() as MeAntwort;
      if (j.username) return j.username;
    }
    return null;
  } catch {
    return null;
  }
}


async function kontoInfo(token: string): Promise<MeAntwort | null> {
  try {
    const res = await fetch(`${API_BASIS}/api/me`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    return res.ok ? await res.json() as MeAntwort : null;
  } catch {
    return null;
  }
}


function schuetzeVorBfcache(): void {
  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted) window.location.reload();
  });
}


export function initUserMenu(): void {
  schuetzeVorBfcache();
  const toggle = document.getElementById('btn-user');
  const panel = document.getElementById('user-panel') as HTMLDivElement | null;
  const nameEl = document.getElementById('user-name');
  const profilBtn = document.getElementById('btn-profil');
  const passwortBtn = document.getElementById('btn-passwort');
  const logoutBtn = document.getElementById('btn-logout');
  const token = liesSitzungsToken();

  
  
  
  
  toggle?.addEventListener('touchstart', () => {}, { passive: true });

  if (profilBtn) {
    profilBtn.addEventListener('click', () => {
      window.location.href = '/?profil=1';
    });
  }
  
  
  if (passwortBtn) {
    passwortBtn.addEventListener('click', () => {
      window.location.href = '/?konto=passwort';
    });
  }
  if (logoutBtn) logoutBtn.addEventListener('click', meldeAb);
  
  document.getElementById('btn-logout-alle')?.addEventListener('click', () => {
    window.location.href = '/?konto=abmelden-alle';
  });
  if (!toggle) return;

  if (!token) {
    toggle.addEventListener('click', () => {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/?login=1&next=${encodeURIComponent(next)}`;
    });
    return;
  }

  toggle.classList.add('angemeldet');
  if (!panel) return;

  function oeffnen(): void {
    panel!.hidden = false;
    toggle!.setAttribute('aria-expanded', 'true');
  }
  function schliessen(): void {
    if (panel!.hidden) return;
    panel!.hidden = true;
    toggle!.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => { if (panel.hidden) oeffnen(); else schliessen(); });
  document.addEventListener('click', (e) => {
    const ziel = e.target as Node;
    
    
    
    if (!panel.hidden && !panel.contains(ziel) && !toggle.contains(ziel)) schliessen();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) { schliessen(); toggle.focus(); }
  });

  
  
  void kontoInfo(token).then((me) => {
    if (passwortBtn) passwortBtn.hidden = me?.hatPasswort !== true;
    const betrieb = document.getElementById('btn-betrieb');
    if (betrieb) betrieb.hidden = me?.istAdmin !== true;
    
    document.querySelectorAll<HTMLElement>('[data-nur-betreiber]').forEach((el) => { el.hidden = me?.istAdmin !== true; });
  });

  void holeAnzeigename(token).then((name) => {
    if (!nameEl) return;
    if (name) { nameEl.textContent = name; nameEl.hidden = false; }
    else nameEl.hidden = true;
  });
}


export function liesSitzungsToken(): string | null {
  
  
  
  
  if (liesCookie(SESSION_COOKIE)) return liesCookie(SESSION_COOKIE);
  return liesCookie(ANGEMELDET_COOKIE) ? ANMELDUNG_PER_COOKIE : null;
}

function liesCookie(name: string): string | null {
  try {
    for (const teil of document.cookie.split(';')) {
      const t = teil.trimStart();
      if (t.startsWith(`${name}=`)) return t.slice(name.length + 1) || null;
    }
  } catch {
    
  }
  return null;
}


export function liesEigeneNutzerId(): string | null {
  const token = liesSitzungsToken();
  if (!token) return null;
  if (token === ANMELDUNG_PER_COOKIE) {
    const id = liesCookie(ANGEMELDET_COOKIE);
    return id ? decodeURIComponent(id) : null;
  }
  try {
    const rohNutzlast = token.split('.')[1];
    if (!rohNutzlast) return null;
    const base64 = rohNutzlast.replace(/-/g, '+').replace(/_/g, '/');
    const gepolstert = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(gepolstert)) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
