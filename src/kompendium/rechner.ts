import { nf } from '@/core/time';
import {
  wegSm, hoehenwinkelGenau, hoehenwinkelFaust, relingslogge, kimmabstand,
  feuerInDerKimm, rumpfgeschwindigkeit, kursRueck, knotenUmrechnen, zwoelftel,
} from '@/core/kompendium';
import type { Sprache } from '@/core/types';

const STRICH = '–';

const grad = (x: number, s: Sprache) => {
  const g = (((Math.round(x * 10) / 10) % 360) + 360) % 360;
  const text = nf(g, g % 1 === 0 ? 0 : 1, s);
  const ganz = text.split(/[.,]/)[0]!;
  return `${ganz.padStart(3, '0')}${text.slice(ganz.length)}°`;
};

export function rechne(art: string, w: Record<string, number>, s: Sprache): string {
  const sm = s === 'en' ? 'NM' : 'sm';
  const ok = (...x: number[]) => x.every((v) => Number.isFinite(v));
  switch (art) {
    case 'swt': {
      if (!ok(w.v!, w.t!)) return STRICH;
      return `s = ${nf(wegSm(w.v!, w.t!), 2, s)} ${sm}`;
    }
    case 'hw': {
      if (!(w.h! > 0 && w.a! > 0)) return STRICH;
      return s === 'en'
        ? `d = ${nf(hoehenwinkelGenau(w.h!, w.a!), 2, s)} NM (exact) · ${nf(hoehenwinkelFaust(w.h!, w.a!), 2, s)} NM (rule of thumb)`
        : `d = ${nf(hoehenwinkelGenau(w.h!, w.a!), 2, s)} sm (genau) · ${nf(hoehenwinkelFaust(w.h!, w.a!), 2, s)} sm (Faustformel)`;
    }
    case 'rl': {
      if (!(w.s! > 0 && w.t! > 0)) return STRICH;
      return `v = ${nf(relingslogge(w.s!, w.t!), 1, s)} kn`;
    }
    case 'rg': {
      if (!(w.lwl! > 0)) return STRICH;
      return `v = ${nf(rumpfgeschwindigkeit(w.lwl!), 1, s)} kn`;
    }
    case 'ki': {
      if (!(w.auge! >= 0 && w.feuer! >= 0)) return STRICH;
      return `${s === 'en' ? 'Horizon' : 'Kimm'} ${nf(kimmabstand(w.auge!), 1, s)} ${sm} · `
        + `${s === 'en' ? 'Light' : 'Feuer'} ${nf(feuerInDerKimm(w.feuer!, w.auge!), 1, s)} ${sm}`;
    }
    case 'ks': {
      if (!ok(w.rw!, w.mw!, w.abl!)) return STRICH;
      const r = kursRueck(w.rw!, w.mw!, w.abl!);
      return s === 'en' ? `MC ${grad(r.mwK, s)} · CC ${grad(r.mgK, s)}` : `mwK ${grad(r.mwK, s)} · MgK ${grad(r.mgK, s)}`;
    }
    case 'u': {
      if (!ok(w.kn!)) return STRICH;
      const u = knotenUmrechnen(w.kn!);
      return `${nf(u.kmh, 2, s)} km/h · ${nf(u.ms, 2, s)} m/s`;
    }
    case 'tz': {
      const z = zwoelftel(w.hub!, w.std!);
      if (!z) return STRICH;
      return `${s === 'en' ? 'risen by' : 'gestiegen um'} ${z.zwoelftel}/12 = ${nf(z.meter, 2, s)} m`;
    }
    default: return STRICH;
  }
}
