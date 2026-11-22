
import type { BoatPolar } from './polar';

export interface Punkt {
  lat: number;
  lon: number;
}


export interface Halt {
  min: number;
  text: string;
  wp: number;
}


export interface HaltZeit extends Halt {
  an: Date;
  ab: Date;
  nm: number;
  
  lat?: number;
  lon?: number;
  
  dunkelMin?: number;
}


export interface StreckenPunkt extends Punkt {
  cum: number;            
  course: number | null;
  
  halt?: Halt;
}

export interface SchiffConfig {
  model: 'polar' | 'constant';
  speedKn: number;        
  motorSpeed: number;
  minSailWind: number;    
  boat: BoatPolar;        
  crewFactor: number;     
  
  crewZumutbarkeit?: number | null;
  sailPref: number;       
  useCurrent: boolean;
  maneuverMin: number;    
  
  
  
  
  wachgaenger: number;
  
  tiefgangM: number;
}

export interface Grenzwerte {
  mean: number;           
  gust: number;           
  wave: number;           
}


export interface Wind {
  speed: number;
  dir: number;
  gust: number;
  code: number | null;
  precip: number;
  cape: number;
  
  speed80: number | null;
  
  visibility: number | null;
  
  liftedIndex: number | null;
  
  boeigWind: number;
  boeigGust: number;
  
  windLuecke?: boolean;
}


export interface Strom {
  speed: number;
  dir: number;
  valid: boolean;
}


export interface Gezeit {
  hoeheM: number;
  valid: boolean;
  
  anteil?: 'wetter';
}


export interface Seegang {
  hs: number;
  tp: number;
  dir: number;
  swellHs: number;
  swellTp: number;
  swellDir: number;
  windWaveHs: number;
  windWaveTp: number;
  windWaveDir: number;
  steep: number;
  
  kreuzWinkel: number;
  valid: boolean;
  
  maxIndividualHs?: number;
  
  stokesSpeed?: number;
  stokesDir?: number;
}

export interface SegmentLoesung {
  sog: number;            
  stw: number;            
  stwReal: number;        
  heading: number;
  twa: number;            
  targetTwa: number;      
  sailWind: number;       
  sailWind10: number;
  aws: number;            
  awa: number;
  underMotor: boolean;
  beating: boolean;
  gybing: boolean;
  blocked: boolean;
}

export interface StundenWind {
  time: string[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  weather_code: number[];
  precipitation: number[];
  cape: number[];
  
  
  
  pressure_msl?: number[];
  cloud_cover?: number[];
  temperature_2m?: number[];
  dew_point_2m?: number[];
  
  
  wind_speed_80m?: (number | null)[];
  visibility?: (number | null)[];
  lifted_index?: (number | null)[];
}

export interface StundenMarine {
  time: string[];
  ocean_current_velocity: (number | null)[];
  ocean_current_direction: (number | null)[];
  wave_height: (number | null)[];
  wave_period: (number | null)[];
  wave_direction: (number | null)[];
  swell_wave_height: (number | null)[];
  swell_wave_period: (number | null)[];
  swell_wave_direction: (number | null)[];
  
  
  
  wind_wave_height?: (number | null)[];
  wind_wave_period?: (number | null)[];
  
  
  wind_wave_direction?: (number | null)[];
  
  
  sea_level_height_msl?: (number | null)[];
  sea_surface_temperature?: (number | null)[];
}

export interface Tageslicht {
  time: string[];
  sunrise: string[];
  sunset: string[];
  
  uv_index_max?: number[];
}


export type Sprache = 'de' | 'en';


export type Tageszeit = 'tag' | 'nacht';

export type WarnStufe = 'rot' | 'gelb';
export interface Warnung {
  lvl: WarnStufe;
  text: string;
}


export type AnkerplatzArt = 'marina' | 'bucht' | null;


export type EreignisTyp = 'gewitter' | 'cape' | 'regen' | 'sturm' | 'nebel';
export interface WetterEreignis {
  time: Date;
  t: number;
  nm: number;
  code: number | null;
  precip: number;
  cape: number;
  gust: number;
  
  visibility: number | null;
  type: EreignisTyp;
}


export interface Ablegezeit {
  departure: Date;
  arrival: Date;
  maxWind: number;
  avgDiscomfort: number;
  isDaylight: boolean | null;
  
  dunkelHrs: number;
  dunkelShare: number;
  safetyFail: boolean;
  score: number;
  totalHrs: number;
  sailHrs: number;
  manHrs: number;
  
  haltHrs?: number;
  
  halte?: HaltZeit[];
  avgSpeed: number;
  motorShare: number;
  beyondForecast: boolean;
  
  windLuecke?: { nm: number; time: Date };
  maxCurrent: number;
  currentGainMin: number;
  blockedShare: number;
  maxGust: number;
  
  maxWindAt: { nm: number; time: Date };
  maxGustAt: { nm: number; time: Date };
  maxHsAt: { nm: number; time: Date };
  
  gustFactor: number;
  
  gustFactorWind: number;
  gustFactorGust: number;
  meanFail: boolean;
  gustFail: boolean;
  
  grenzen?: Grenzwerte;
  beatShare: number;
  gybeShare: number;
  vmgShare: number;
  extraNM: number;
  waterNM: number;
  maxHs: number;
  hsTp: number;
  maxSteep: number;
  steepHs: number;
  steepTp: number;
  
  maxIndividualHs: number;
  stokesSpeed: number;
  stokesDir: number;
  
  maxKreuzWinkel: number;
  kreuzWindWaveHs: number;
  kreuzSwellHs: number;
  headSeaShare: number;
  
  followSeaShare: number;
  
  messinaKabbelNM?: number;
  
  messinaEinfahrt?: { zeit: Date; nachNorden: boolean; vKn: number; imFenster: boolean };
  seaFail: boolean;
  seaValid: boolean;
  avgAwa: number;
  avgAws: number;
  avgTwa: number;
  minWind: number;
  events: WetterEreignis[];
  hasStorm: boolean;
  seaAngle: number | null;
  windTrend: number;
  windFirst: number | null;
  windLast: number;
  twaFirst: number | null;
  twaLast: number;
  
  twaMin?: number;
  twaMinNM?: number;
  twaMax?: number;
  twaMaxNM?: number;
  maxPrecip: number;
  precipShare: number;
  precipFirst: { time: Date; nm: number } | null;
  avgWindDir: number;
  midLat: number;
  midLon: number;
}
