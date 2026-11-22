
export function ladebildWeg(): void {
  const l = document.getElementById('ladebild');
  if (!l) return;
  l.classList.add('lb-weg');
  setTimeout(() => { if (l.classList.contains('lb-weg')) l.classList.add('lb-aus'); }, 300);
}


export function ladebildGezeichnet(): Promise<void> {
  const l = document.getElementById('ladebild');
  if (!l || l.classList.contains('lb-aus') || document.visibilityState === 'hidden') return Promise.resolve();
  return new Promise((weiter) => {
    let fertig = false;
    const los = (): void => { if (!fertig) { fertig = true; weiter(); } };
    requestAnimationFrame(() => setTimeout(los, 0));
    setTimeout(los, 500);
  });
}
