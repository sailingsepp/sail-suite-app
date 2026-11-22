import { liesSitzungsToken } from '@/shell/session';
import { API_BASIS } from '@/shell/api';




let tokenVonAussen: string | null = null;
export function setzeProxyToken(t: string | null | undefined): void { tokenVonAussen = t ?? null; }

function token(): string | null {
  if (tokenVonAussen) return tokenVonAussen;
  return typeof document === 'undefined' ? null : liesSitzungsToken();
}

const istAbbruch = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError';


let streamToken: string | null = null;
export function setzeStreamProxy(t: string | null): void { streamToken = t || null; }
const streamBasis = () => `${API_BASIS}/api/stream/${encodeURIComponent(streamToken!)}`;


export function serverPfad(url: string): string | null {
  const u = new URL(url);
  if (u.hostname === 'nominatim.openstreetmap.org' && (u.pathname === '/reverse' || u.pathname === '/search')) {
    return `/api/osm/nominatim${u.pathname}${u.search}`;
  }
  if (u.hostname === 'www.skipperguide.de' && u.pathname === '/api.php') return `/api/osm/skipperguide${u.search}`;
  return null;
}


export async function holeUeberServer(url: string, init: RequestInit = {}): Promise<Response> {
  const t = token();
  const pfad = serverPfad(url);
  if (t && pfad) {
    try {
      const res = await fetch(`${API_BASIS}${pfad}`, { signal: init.signal ?? null, credentials: 'include', headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) return res;
    } catch (err) {
      if (istAbbruch(err)) throw err;
    }
  } else if (streamToken && pfad?.startsWith('/api/osm/nominatim/')) {
    try {
      const res = await fetch(`${streamBasis()}${pfad.slice('/api/osm'.length)}`, { signal: init.signal ?? null });
      if (res.ok) return res;
    } catch (err) {
      if (istAbbruch(err)) throw err;
    }
  }
  return fetch(url, init);
}


export async function overpassUeberServer(ql: string, signal: AbortSignal): Promise<unknown | null> {
  const t = token();
  if (!t && !streamToken) return null;
  try {
    const res = t
      ? await fetch(`${API_BASIS}/api/osm/overpass`, {
        method: 'POST', signal, credentials: 'include',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ql }),
      })
      : await fetch(`${streamBasis()}/overpass`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ql }),
      });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    if (istAbbruch(err)) throw err;
    return null;
  }
}
