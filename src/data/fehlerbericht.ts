import { liesSitzungsToken } from '@/shell/session';
import { API_BASIS } from '@/shell/api';

const AUSSCHNITT_MAX = 500;

function kuerzeAusschnitt(v: unknown): string {
  let s: string;
  try { s = JSON.stringify(v) ?? String(v); } catch { s = String(v); }
  return s.length > AUSSCHNITT_MAX ? s.slice(0, AUSSCHNITT_MAX) + '…' : s;
}

const SPERRE_MS = 10 * 60_000;
const zuletztGemeldet = new Map<string, number>();

export function meldeFormatabweichung(quelle: string, meldung: string, beispiel?: unknown): void {
  const token = liesSitzungsToken();
  if (!token) return;

  const jetzt = Date.now();
  const letztes = zuletztGemeldet.get(quelle) ?? 0;
  if (jetzt - letztes < SPERRE_MS) return;
  zuletztGemeldet.set(quelle, jetzt);

  const body: { quelle: string; meldung: string; beispiel?: string } = { quelle, meldung };
  if (beispiel !== undefined) body.beispiel = kuerzeAusschnitt(beispiel);

  void fetch(`${API_BASIS}/api/fehlerbericht`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => {  });
}
