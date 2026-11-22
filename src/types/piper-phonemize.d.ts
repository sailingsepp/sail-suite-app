declare module 'piper-phonemize-intern' {
  interface PiperPhonemizeModul { callMain(args: string[]): void }
  export function createPiperPhonemize(optionen: {
    print: (zeile: string) => void;
    printErr: (zeile: string) => void;
    locateFile: (datei: string) => string;
  }): Promise<PiperPhonemizeModul>;
}
