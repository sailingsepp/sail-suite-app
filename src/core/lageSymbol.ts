
export type Lage = 'motor' | 'segel' | 'angelegt' | 'treibend' | 'ankernd' | 'liegeplatz';

type Eintrag = { art: string; t: number; liegeart?: string | undefined };

const LIEGE_ARTEN = ['anlegen', 'ankern', 'treiben', 'liegeplatz', 'ankerplatz'];


function juengstesLiegen(eintraege: readonly Eintrag[]): Eintrag | null {
  let liegen: Eintrag | null = null;
  let ablegen = -Infinity;
  for (const e of eintraege) {
    if (e.art === 'start') ablegen = Math.max(ablegen, e.t);
    else if (LIEGE_ARTEN.includes(e.art) && (!liegen || e.t >= liegen.t)) liegen = e;
  }
  return liegen && liegen.t >= ablegen ? liegen : null;
}

function ausLiegen(e: Eintrag | null): Lage {
  if (!e) return 'angelegt';
  if (e.art === 'treiben' || e.liegeart === 'treiben') return 'treibend';
  if (e.art === 'ankern' || e.art === 'ankerplatz' || e.liegeart === 'anker') return 'ankernd';
  if (e.art === 'liegeplatz') return 'liegeplatz';
  return 'angelegt';
}


export function lageNachTag(eintraege: readonly Eintrag[]): Lage {
  return ausLiegen(juengstesLiegen(eintraege));
}

export function lage(z: {
  betriebsart: 'gestoppt' | 'laeuft' | 'pausiert' | 'pausiert-anker';
  antrieb: 'segel' | 'motor' | null;
  abgelegt: boolean;
  eintraege: readonly Eintrag[];
}): Lage | null {
  if (z.betriebsart === 'gestoppt') return null;
  if (z.betriebsart === 'pausiert-anker') return 'ankernd';
  const liegen = juengstesLiegen(z.eintraege);
  if (z.betriebsart === 'pausiert') return ausLiegen(liegen);
  
  if (!z.abgelegt) return liegen ? ausLiegen(liegen) : 'liegeplatz';
  return z.antrieb === 'motor' ? 'motor' : 'segel';
}


export function festmachart(eintraege: readonly Eintrag[]): 'heck' | 'bug' | 'laengsseits' | 'boje' | null {
  const l = juengstesLiegen(eintraege)?.liegeart;
  return l === 'heck' || l === 'bug' || l === 'laengsseits' || l === 'boje' ? l : null;
}
