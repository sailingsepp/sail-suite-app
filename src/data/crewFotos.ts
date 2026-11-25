import { API_BASIS } from '@/shell/api';

export type ZeitQuelle = 'exif' | 'kamera' | 'datei' | 'hand';
export type OrtQuelle = 'exif' | 'geraet' | 'spur' | 'hand';

export interface CrewFoto {
  id: string;

  t: number;
  breite: number;
  hoehe: number;
  lat: number | null;
  lon: number | null;
  zeitQuelle: ZeitQuelle;
  ortQuelle: OrtQuelle | null;
  text: string | null;

  ort?: string;
  von: { vorname: string; nachname: string } | null;
  eigenes: boolean;
}

export interface NeuesFoto {
  bild: Blob;
  breite: number;
  hoehe: number;
  t: number;
  zeitQuelle: ZeitQuelle;
  ort: { lat: number; lon: number; quelle: OrtQuelle; name?: string } | null;
  text: string | null;
}

const pfad = (toernId: string) => `${API_BASIS}/api/toerne/${encodeURIComponent(toernId)}/fotos`;

export async function holeCrewFotos(token: string, toernId: string): Promise<CrewFoto[] | null> {
  try {
    const r = await fetch(pfad(toernId), { headers: { Authorization: `Bearer ${token}` }, credentials: 'include', signal: AbortSignal.timeout(15_000) });
    return r.ok ? (await r.json()) as CrewFoto[] : null;
  } catch {
    return null;
  }
}

export async function ladeCrewFotoHoch(token: string, toernId: string, f: NeuesFoto): Promise<string | null> {
  const q = new URLSearchParams({
    t: String(Math.round(f.t)), breite: String(f.breite), hoehe: String(f.hoehe), zeitQuelle: f.zeitQuelle,
    ...(f.ort ? { lat: f.ort.lat.toFixed(6), lon: f.ort.lon.toFixed(6), ortQuelle: f.ort.quelle } : {}),
    ...(f.ort?.name !== undefined ? { ort: f.ort.name } : {}),
    ...(f.text ? { text: f.text } : {}),
  });
  try {
    const r = await fetch(`${pfad(toernId)}?${q.toString()}`, {
      method: 'POST', body: f.bild, credentials: 'include', signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': f.bild.type || 'image/jpeg' },
    });
    if (!r.ok) console.error(`POST fotos → ${r.status}`, await r.json().catch(() => null));
    return r.ok ? ((await r.json()) as { id: string }).id : null;
  } catch {
    return null;
  }
}

export async function setzeCrewFotoOrt(token: string, toernId: string, id: string, ort: string): Promise<boolean> {
  try {
    const r = await fetch(`${pfad(toernId)}/${encodeURIComponent(id)}/ort`, {
      method: 'PUT', body: JSON.stringify({ ort }), credentials: 'include', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function loescheCrewFoto(token: string, toernId: string, id: string): Promise<boolean> {
  try {
    const r = await fetch(`${pfad(toernId)}/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include', signal: AbortSignal.timeout(15_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function holeCrewFotoBlob(token: string, toernId: string, id: string): Promise<Blob | null> {
  try {
    const r = await fetch(`${pfad(toernId)}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'include', signal: AbortSignal.timeout(30_000),
    });
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}
