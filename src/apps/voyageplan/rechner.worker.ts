import { rechne } from './rechner';
import { neuerKostenkartenSpeicher } from './zwischenspeicher';
import type { RechnerAnfrage, RechnerAntwort, RechnerFortschritt } from './rechnerProtokoll';
import { setzeProxyToken } from '@/data/fremdProxy';

const SPEICHER = neuerKostenkartenSpeicher();

self.onmessage = (e: MessageEvent<RechnerAnfrage>): void => {

  setzeProxyToken((e.data as RechnerAnfrage & { proxyToken?: string | null }).proxyToken);

  rechne(e.data, (f: RechnerFortschritt) => self.postMessage(f), SPEICHER)
    .then((antwort) => self.postMessage(antwort))
    .catch((err: unknown) => {
      const text = err instanceof Error ? err.message : String(err);
      self.postMessage({ lage: 'fehler', text } satisfies RechnerAntwort);
    });
};
