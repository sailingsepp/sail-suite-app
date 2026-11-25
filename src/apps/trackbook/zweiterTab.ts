export const TAB_SPERRE = 'sail-suite-trackbook-tab';

type Locks = LockManager | undefined;
const locks = (): Locks => (navigator as Navigator & { locks?: LockManager }).locks;

const halten = (): Promise<void> => new Promise<void>(() => {});

export async function besitzeTab(beiFreigabe: () => void): Promise<boolean> {
  const l = locks();
  if (!l) return true;
  try {
    const erster = await new Promise<boolean>((fertig) => {
      void l.request(TAB_SPERRE, { ifAvailable: true }, (lock) => {
        fertig(lock !== null);
        return lock ? halten() : undefined;
      }).catch(() => fertig(true));
    });
    if (erster) return true;
    void l.request(TAB_SPERRE, () => { beiFreigabe(); return halten(); }).catch(() => {  });
    return false;
  } catch {
    return true;
  }
}
