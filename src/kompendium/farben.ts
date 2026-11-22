export const FLAGGE = {
  rot: '#C8102E',
  blau: '#0A3A8C',
  gelb: '#F6C22B',
  schwarz: '#141414',
  weiss: '#FFFFFF',
} as const;

export const LICHT = {
  W: '#FFF6D8',
  R: '#FF3B3B',
  G: '#2BE37A',
  Y: '#FFC53D',
  Bu: '#3DA5FF',
} as const;
export type Lichtfarbe = keyof typeof LICHT;

export const TONNE = {
  rot: FLAGGE.rot,
  gruen: '#0E8A43',
  gelb: FLAGGE.gelb,
  schwarz: FLAGGE.schwarz,
  weiss: FLAGGE.weiss,
  blau: FLAGGE.blau,
} as const;

export const NOT = {
  rot: '#E8272F',
  orange: '#F07A1A',
} as const;
