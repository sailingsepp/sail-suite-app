const TAGE_MAX = 6;

export interface WindEnsemble {
  time: string[];

  mitglieder: (number | null)[][];
}

export async function fetchWindEnsemble(lat: number, lon: number, tage: number): Promise<WindEnsemble | null> {
  const url = 'https://ensemble-api.open-meteo.com/v1/ensemble'
    + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + '&hourly=wind_speed_10m&models=ecmwf_ifs025'
    + `&wind_speed_unit=kn&timezone=auto&forecast_days=${Math.min(tage, TAGE_MAX)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const daten = (await res.json()) as { hourly?: { time?: string[] } & Record<string, unknown> };
    const hourly = daten.hourly;
    if (!hourly?.time) return null;
    const mitgliederSchluessel = Object.keys(hourly)
      .filter((k) => /^wind_speed_10m_member\d+$/.test(k))
      .sort();
    if (mitgliederSchluessel.length === 0) return null;
    const mitglieder = mitgliederSchluessel.map((k) => hourly[k] as (number | null)[]);
    return { time: hourly.time, mitglieder };
  } catch {
    return null;
  }
}
