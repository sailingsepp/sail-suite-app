export interface Yachttyp {
  hersteller: string;
  modell: string;

  baujahrAb?: number;

  loaM?: number;

  lwlM?: number;

  breiteM?: number;

  tiefgangM?: number;

  verdraengungT?: number;

  segelflaecheM2?: number;

  motorPS?: number;

  geprueft?: boolean;
}

export const YACHTTYPEN: readonly Yachttyp[] = [
  { hersteller: "Arcona", modell: "380", baujahrAb: 2014, loaM: 11.35, lwlM: 10, breiteM: 3.6, tiefgangM: 2.2, verdraengungT: 6.4, segelflaecheM2: 78, motorPS: 30 },
  { hersteller: "Arcona", modell: "400", baujahrAb: 2001, loaM: 12.2, lwlM: 10.65, breiteM: 3.8, tiefgangM: 2.2, verdraengungT: 7.2, segelflaecheM2: 82, motorPS: 40 },
  { hersteller: "Arcona", modell: "430", baujahrAb: 2011, loaM: 13.2, lwlM: 11.6, breiteM: 3.9, tiefgangM: 2.4, verdraengungT: 8.8, segelflaecheM2: 91, motorPS: 40 },
  { hersteller: "Bavaria", modell: "C38", baujahrAb: 2020, loaM: 11.31, lwlM: 11, breiteM: 3.98, tiefgangM: 2, verdraengungT: 9.39, segelflaecheM2: 84, motorPS: 40, geprueft: true },
  { hersteller: "Bavaria", modell: "C42", baujahrAb: 2020, loaM: 12.4, lwlM: 11.9, breiteM: 4.3, tiefgangM: 2.1, verdraengungT: 10.07, segelflaecheM2: 90.5, motorPS: 57, geprueft: true },
  { hersteller: "Bavaria", modell: "C45", baujahrAb: 2021, loaM: 13.98, lwlM: 13.5, breiteM: 4.49, tiefgangM: 2.2, verdraengungT: 12.5, segelflaecheM2: 102, motorPS: 57 },
  { hersteller: "Bavaria", modell: "C46", baujahrAb: 2021, loaM: 14.5, lwlM: 13.7, breiteM: 4.7, tiefgangM: 2.3, verdraengungT: 12.6, segelflaecheM2: 112, motorPS: 57 },
  { hersteller: "Bavaria", modell: "C50", baujahrAb: 2018, loaM: 15.43, lwlM: 14.6, breiteM: 5, tiefgangM: 2.3, verdraengungT: 14.5, segelflaecheM2: 127, motorPS: 80 },
  { hersteller: "Bavaria", modell: "Cruiser 34", baujahrAb: 2013, loaM: 9.99, lwlM: 9.15, breiteM: 3.42, tiefgangM: 1.95, verdraengungT: 5.3, segelflaecheM2: 61, motorPS: 30 },
  { hersteller: "Bavaria", modell: "Cruiser 37", baujahrAb: 2013, loaM: 11.3, lwlM: 10.9, breiteM: 3.67, tiefgangM: 1.95, verdraengungT: 7, segelflaecheM2: 71, motorPS: 40 },
  { hersteller: "Bavaria", modell: "Cruiser 40", baujahrAb: 2011, loaM: 12.35, lwlM: 11.99, breiteM: 3.96, tiefgangM: 2.05, verdraengungT: 8.6, segelflaecheM2: 75, motorPS: 40 },
  { hersteller: "Bavaria", modell: "Cruiser 41", baujahrAb: 2012, loaM: 12.35, lwlM: 11.99, breiteM: 3.96, tiefgangM: 2.05, verdraengungT: 9, segelflaecheM2: 80, motorPS: 40 },
  { hersteller: "Bavaria", modell: "Cruiser 45", baujahrAb: 2009, loaM: 13.6, lwlM: 12.75, breiteM: 4.35, tiefgangM: 2.1, verdraengungT: 11.6, segelflaecheM2: 105, motorPS: 55 },
  { hersteller: "Bavaria", modell: "Cruiser 46", baujahrAb: 2014, loaM: 14.27, lwlM: 13.24, breiteM: 4.35, tiefgangM: 2.1, verdraengungT: 12.6, segelflaecheM2: 110, motorPS: 55 },
  { hersteller: "Bavaria", modell: "Cruiser 50", baujahrAb: 2005, loaM: 14.99, lwlM: 13.8, breiteM: 4.46, tiefgangM: 2.1, verdraengungT: 14.3, segelflaecheM2: 125, motorPS: 75 },
  { hersteller: "Bénéteau", modell: "Oceanis 31", baujahrAb: 2007, loaM: 9.66, lwlM: 8.7, breiteM: 3.39, tiefgangM: 1.8, verdraengungT: 4.65, segelflaecheM2: 52, motorPS: 21 },
  { hersteller: "Bénéteau", modell: "Oceanis 34", baujahrAb: 2008, loaM: 10.34, lwlM: 9.35, breiteM: 3.66, tiefgangM: 1.85, verdraengungT: 5.7, segelflaecheM2: 50.4, motorPS: 21 },
  { hersteller: "Bénéteau", modell: "Oceanis 34.1", baujahrAb: 2021, loaM: 10.77, lwlM: 9.5, breiteM: 3.57, tiefgangM: 2, verdraengungT: 5.47, segelflaecheM2: 49.3, motorPS: 21, geprueft: true },
  { hersteller: "Bénéteau", modell: "Oceanis 35", baujahrAb: 2014, loaM: 10.45, lwlM: 9.4, breiteM: 3.72, tiefgangM: 1.85, verdraengungT: 5.5, segelflaecheM2: 55, motorPS: 21 },
  { hersteller: "Bénéteau", modell: "Oceanis 35.1", baujahrAb: 2017, loaM: 10.45, lwlM: 9.4, breiteM: 3.72, tiefgangM: 1.85, verdraengungT: 5.5, segelflaecheM2: 55, motorPS: 30 },
  { hersteller: "Bénéteau", modell: "Oceanis 37", baujahrAb: 2007, loaM: 11.13, lwlM: 10.2, breiteM: 3.92, tiefgangM: 2, verdraengungT: 6.6, segelflaecheM2: 66, motorPS: 29 },
  { hersteller: "Bénéteau", modell: "Oceanis 37.1", baujahrAb: 2022, loaM: 11.93, lwlM: 10.8, breiteM: 3.92, tiefgangM: 2.1, verdraengungT: 7.5, segelflaecheM2: 70, motorPS: 40 },
  { hersteller: "Bénéteau", modell: "Oceanis 38", baujahrAb: 2013, loaM: 11.5, lwlM: 10.4, breiteM: 3.99, tiefgangM: 2.08, verdraengungT: 7, segelflaecheM2: 67, motorPS: 40 },
  { hersteller: "Bénéteau", modell: "Oceanis 40", baujahrAb: 2007, loaM: 12.17, lwlM: 11.25, breiteM: 3.91, tiefgangM: 1.7, verdraengungT: 7.6, segelflaecheM2: 70, motorPS: 40 },
  { hersteller: "Bénéteau", modell: "Oceanis 40.1", baujahrAb: 2020, loaM: 12.87, lwlM: 11.7, breiteM: 4.18, tiefgangM: 2.17, verdraengungT: 7.99, segelflaecheM2: 73.4, motorPS: 45, geprueft: true },
  { hersteller: "Bénéteau", modell: "Oceanis 41", baujahrAb: 2012, loaM: 12.38, lwlM: 11.3, breiteM: 4.2, tiefgangM: 2.05, verdraengungT: 8, segelflaecheM2: 74, motorPS: 40 },
  { hersteller: "Bénéteau", modell: "Oceanis 43", baujahrAb: 2007, loaM: 13.1, lwlM: 12.15, breiteM: 4.12, tiefgangM: 2, verdraengungT: 9.2, segelflaecheM2: 82, motorPS: 54 },
  { hersteller: "Bénéteau", modell: "Oceanis 45", baujahrAb: 2011, loaM: 13.94, lwlM: 12.6, breiteM: 4.49, tiefgangM: 2.15, verdraengungT: 10.6, segelflaecheM2: 91, motorPS: 54 },
  { hersteller: "Bénéteau", modell: "Oceanis 46", baujahrAb: 2006, loaM: 14.6, lwlM: 13.3, breiteM: 4.25, tiefgangM: 2.1, verdraengungT: 10.5, segelflaecheM2: 95, motorPS: 75 },
  { hersteller: "Bénéteau", modell: "Oceanis 46.1", baujahrAb: 2018, loaM: 14.6, lwlM: 13.24, breiteM: 4.5, tiefgangM: 2.35, verdraengungT: 10.6, segelflaecheM2: 94, motorPS: 80 },
  { hersteller: "Bénéteau", modell: "Oceanis 48", baujahrAb: 2012, loaM: 14.6, lwlM: 13.45, breiteM: 4.74, tiefgangM: 2.15, verdraengungT: 12.6, segelflaecheM2: 111, motorPS: 80 },
  { hersteller: "Bénéteau", modell: "Oceanis 51.1", baujahrAb: 2017, loaM: 15.94, lwlM: 14.38, breiteM: 4.8, tiefgangM: 2.3, verdraengungT: 13.9, segelflaecheM2: 114, motorPS: 80 },
  { hersteller: "Dehler", modell: "34", baujahrAb: 1992, loaM: 10.6, lwlM: 8.6, breiteM: 3.4, tiefgangM: 1.95, verdraengungT: 4.5, segelflaecheM2: 57, motorPS: 18 },
  { hersteller: "Dehler", modell: "36 SQ", baujahrAb: 2006, loaM: 10.95, lwlM: 9.3, breiteM: 3.59, tiefgangM: 2, verdraengungT: 5.8, segelflaecheM2: 67, motorPS: 29 },
  { hersteller: "Dehler", modell: "38", baujahrAb: 2013, loaM: 11.3, lwlM: 10, breiteM: 3.75, tiefgangM: 2.1, verdraengungT: 7, segelflaecheM2: 76, motorPS: 30 },
  { hersteller: "Dehler", modell: "38 SQ", baujahrAb: 2020, loaM: 11.64, lwlM: 10.3, breiteM: 3.75, tiefgangM: 2.1, verdraengungT: 7, segelflaecheM2: 78, motorPS: 40 },
  { hersteller: "Dehler", modell: "42", baujahrAb: 2015, loaM: 12.84, lwlM: 11.3, breiteM: 4.18, tiefgangM: 2.15, verdraengungT: 9, segelflaecheM2: 88, motorPS: 40 },
  { hersteller: "Dehler", modell: "46", baujahrAb: 2014, loaM: 14.4, lwlM: 12.9, breiteM: 4.38, tiefgangM: 2.25, verdraengungT: 11, segelflaecheM2: 105, motorPS: 57 },
  { hersteller: "Dufour", modell: "360 Grand Large", baujahrAb: 2017, loaM: 10.73, lwlM: 9.3, breiteM: 3.54, tiefgangM: 1.9, verdraengungT: 6.1, segelflaecheM2: 66, motorPS: 30 },
  { hersteller: "Dufour", modell: "382 Grand Large", baujahrAb: 2013, loaM: 11.25, lwlM: 9.8, breiteM: 3.85, tiefgangM: 2, verdraengungT: 7.3, segelflaecheM2: 70, motorPS: 40 },
  { hersteller: "Dufour", modell: "390 Grand Large", baujahrAb: 2019, loaM: 11.93, lwlM: 10.45, breiteM: 3.99, tiefgangM: 1.95, verdraengungT: 7.9, segelflaecheM2: 75, motorPS: 40 },
  { hersteller: "Dufour", modell: "410 Grand Large", baujahrAb: 2013, loaM: 12.35, lwlM: 11.1, breiteM: 4.2, tiefgangM: 2.1, verdraengungT: 9, segelflaecheM2: 79, motorPS: 40 },
  { hersteller: "Dufour", modell: "430 Grand Large", baujahrAb: 2015, loaM: 13.24, lwlM: 11.95, breiteM: 4.35, tiefgangM: 2.1, verdraengungT: 10.6, segelflaecheM2: 86, motorPS: 50 },
  { hersteller: "Dufour", modell: "460 Grand Large", baujahrAb: 2016, loaM: 14.6, lwlM: 13.1, breiteM: 4.5, tiefgangM: 2.2, verdraengungT: 11.8, segelflaecheM2: 105, motorPS: 75 },
  { hersteller: "Dufour", modell: "470", baujahrAb: 2020, loaM: 14.85, lwlM: 13.4, breiteM: 4.49, tiefgangM: 2.25, verdraengungT: 13, segelflaecheM2: 110, motorPS: 75 },
  { hersteller: "Elan", modell: "E3", baujahrAb: 2013, loaM: 9.25, lwlM: 8, breiteM: 3.22, tiefgangM: 1.9, verdraengungT: 4.6, segelflaecheM2: 49, motorPS: 20 },
  { hersteller: "Elan", modell: "E4", baujahrAb: 2017, loaM: 10.6, lwlM: 9.3, breiteM: 3.5, tiefgangM: 2.15, verdraengungT: 6, segelflaecheM2: 67, motorPS: 29 },
  { hersteller: "Elan", modell: "E5", baujahrAb: 2015, loaM: 11.96, lwlM: 10.4, breiteM: 3.91, tiefgangM: 2.35, verdraengungT: 8.5, segelflaecheM2: 80, motorPS: 40 },
  { hersteller: "Elan", modell: "E6", baujahrAb: 2020, loaM: 15.14, lwlM: 13.5, breiteM: 4.49, tiefgangM: 2.8, verdraengungT: 13.5, segelflaecheM2: 118, motorPS: 80 },
  { hersteller: "Elan", modell: "Impression 344", baujahrAb: 2006, loaM: 10.46, lwlM: 9.3, breiteM: 3.49, tiefgangM: 1.98, verdraengungT: 5.7, segelflaecheM2: 62, motorPS: 29 },
  { hersteller: "Elan", modell: "Impression 35", baujahrAb: 2014, loaM: 10.6, lwlM: 9.55, breiteM: 3.49, tiefgangM: 1.95, verdraengungT: 6.1, segelflaecheM2: 63, motorPS: 29 },
  { hersteller: "Elan", modell: "Impression 40.1", baujahrAb: 2019, loaM: 11.99, lwlM: 10, breiteM: 3.91, tiefgangM: 1.8, verdraengungT: 8.37, segelflaecheM2: 76, motorPS: 29, geprueft: true },
  { hersteller: "Elan", modell: "Impression 43", baujahrAb: 2022, loaM: 13.32, lwlM: 11.8, breiteM: 4.19, tiefgangM: 2.15, verdraengungT: 10.2, segelflaecheM2: 92, motorPS: 50 },
  { hersteller: "Elan", modell: "Impression 45.1", baujahrAb: 2019, loaM: 13.85, lwlM: 12.1, breiteM: 4.18, tiefgangM: 2.15, verdraengungT: 11.2, segelflaecheM2: 105, motorPS: 57 },
  { hersteller: "Elan", modell: "Impression 50.1", baujahrAb: 2019, loaM: 15.2, lwlM: 13.7, breiteM: 4.49, tiefgangM: 2.35, verdraengungT: 14.2, segelflaecheM2: 125, motorPS: 80 },
  { hersteller: "Hallberg-Rassy", modell: "34", baujahrAb: 1990, loaM: 10.28, lwlM: 8.9, breiteM: 3.42, tiefgangM: 1.85, verdraengungT: 5.3, segelflaecheM2: 59, motorPS: 29 },
  { hersteller: "Hallberg-Rassy", modell: "372", baujahrAb: 2009, loaM: 11.35, lwlM: 9.65, breiteM: 3.55, tiefgangM: 2, verdraengungT: 7.5, segelflaecheM2: 68, motorPS: 29 },
  { hersteller: "Hallberg-Rassy", modell: "40", baujahrAb: 2002, loaM: 12.4, lwlM: 10.5, breiteM: 3.82, tiefgangM: 1.99, verdraengungT: 9.1, segelflaecheM2: 72, motorPS: 55 },
  { hersteller: "Hallberg-Rassy", modell: "44", baujahrAb: 2016, loaM: 13.68, lwlM: 11.8, breiteM: 4.2, tiefgangM: 2.1, verdraengungT: 12.3, segelflaecheM2: 96, motorPS: 75 },
  { hersteller: "Hallberg-Rassy", modell: "48", baujahrAb: 2005, loaM: 14.78, lwlM: 12.5, breiteM: 4.42, tiefgangM: 2.35, verdraengungT: 14, segelflaecheM2: 110, motorPS: 100 },
  { hersteller: "Hanse", modell: "315 (2016)", baujahrAb: 2016, loaM: 9.62, lwlM: 8.7, breiteM: 3.35, tiefgangM: 1.85, verdraengungT: 4.7, segelflaecheM2: 46.9, motorPS: 12, geprueft: true },
  { hersteller: "Hanse", modell: "320", baujahrAb: 2004, loaM: 9.63, lwlM: 8.45, breiteM: 3.3, tiefgangM: 1.84, verdraengungT: 4.9, segelflaecheM2: 52, motorPS: 18 },
  { hersteller: "Hanse", modell: "325", baujahrAb: 2009, loaM: 9.63, lwlM: 8.6, breiteM: 3.3, tiefgangM: 1.84, verdraengungT: 4.9, segelflaecheM2: 52, motorPS: 18 },
  { hersteller: "Hanse", modell: "345", baujahrAb: 2012, loaM: 10.4, lwlM: 9.4, breiteM: 3.5, tiefgangM: 1.87, verdraengungT: 5.5, segelflaecheM2: 58, motorPS: 18 },
  { hersteller: "Hanse", modell: "348", baujahrAb: 2018, loaM: 10.4, lwlM: 9.55, breiteM: 3.5, tiefgangM: 1.95, verdraengungT: 6.7, segelflaecheM2: 61, motorPS: 21 },
  { hersteller: "Hanse", modell: "350", baujahrAb: 2007, loaM: 10.59, lwlM: 9.4, breiteM: 3.55, tiefgangM: 1.95, verdraengungT: 5.9, segelflaecheM2: 65, motorPS: 27 },
  { hersteller: "Hanse", modell: "355", baujahrAb: 2009, loaM: 10.59, lwlM: 9.4, breiteM: 3.55, tiefgangM: 1.95, verdraengungT: 5.9, segelflaecheM2: 65, motorPS: 27 },
  { hersteller: "Hanse", modell: "370", baujahrAb: 2006, loaM: 11.35, lwlM: 10.05, breiteM: 3.75, tiefgangM: 2, verdraengungT: 7, segelflaecheM2: 73, motorPS: 29 },
  { hersteller: "Hanse", modell: "375", baujahrAb: 2009, loaM: 11.4, lwlM: 10.3, breiteM: 3.9, tiefgangM: 2, verdraengungT: 7.5, segelflaecheM2: 74, motorPS: 29 },
  { hersteller: "Hanse", modell: "385", baujahrAb: 2011, loaM: 11.4, lwlM: 10.3, breiteM: 3.9, tiefgangM: 2, verdraengungT: 7.6, segelflaecheM2: 76, motorPS: 29 },
  { hersteller: "Hanse", modell: "388", baujahrAb: 2017, loaM: 11.4, lwlM: 10.3, breiteM: 3.9, tiefgangM: 2.1, verdraengungT: 8, segelflaecheM2: 74, motorPS: 29 },
  { hersteller: "Hanse", modell: "400", baujahrAb: 2006, loaM: 12.1, lwlM: 10.85, breiteM: 4.04, tiefgangM: 2.1, verdraengungT: 8.9, segelflaecheM2: 79, motorPS: 40 },
  { hersteller: "Hanse", modell: "410", baujahrAb: 2023, loaM: 12.55, lwlM: 11.65, breiteM: 4.29, tiefgangM: 2.1, verdraengungT: 10, segelflaecheM2: 88, motorPS: 40 },
  { hersteller: "Hanse", modell: "411", baujahrAb: 2001, loaM: 12.35, lwlM: 11, breiteM: 3.9, tiefgangM: 2.1, verdraengungT: 8.5, segelflaecheM2: 76, motorPS: 40 },
  { hersteller: "Hanse", modell: "415", baujahrAb: 2012, loaM: 12.4, lwlM: 11.25, breiteM: 4.17, tiefgangM: 2.1, verdraengungT: 9.2, segelflaecheM2: 83, motorPS: 40 },
  { hersteller: "Hanse", modell: "418", baujahrAb: 2017, loaM: 12.4, lwlM: 11.25, breiteM: 4.17, tiefgangM: 2.1, verdraengungT: 10, segelflaecheM2: 83, motorPS: 40 },
  { hersteller: "Hanse", modell: "430", baujahrAb: 2005, loaM: 13.3, lwlM: 11.9, breiteM: 4.13, tiefgangM: 2.1, verdraengungT: 10.5, segelflaecheM2: 95, motorPS: 54 },
  { hersteller: "Hanse", modell: "445", baujahrAb: 2010, loaM: 13.52, lwlM: 12.35, breiteM: 4.38, tiefgangM: 2.1, verdraengungT: 11.5, segelflaecheM2: 104, motorPS: 54 },
  { hersteller: "Hanse", modell: "455", baujahrAb: 2014, loaM: 13.55, lwlM: 12.5, breiteM: 4.38, tiefgangM: 2.25, verdraengungT: 12, segelflaecheM2: 107, motorPS: 54 },
  { hersteller: "Hanse", modell: "458", baujahrAb: 2018, loaM: 14.04, lwlM: 12.55, breiteM: 4.49, tiefgangM: 2.25, verdraengungT: 12.6, segelflaecheM2: 107, motorPS: 57 },
  { hersteller: "Hanse", modell: "460", baujahrAb: 2022, loaM: 14.6, lwlM: 13, breiteM: 4.79, tiefgangM: 2.25, verdraengungT: 13.2, segelflaecheM2: 120, motorPS: 80 },
  { hersteller: "Hanse", modell: "508", baujahrAb: 2018, loaM: 15.55, lwlM: 14.2, breiteM: 4.75, tiefgangM: 2.4, verdraengungT: 15.2, segelflaecheM2: 139, motorPS: 80 },
  { hersteller: "Hanse", modell: "510", baujahrAb: 2023, loaM: 15.97, lwlM: 14.6, breiteM: 4.91, tiefgangM: 2.45, verdraengungT: 15, segelflaecheM2: 145, motorPS: 80 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 32", baujahrAb: 2000, loaM: 9.6, lwlM: 8.55, breiteM: 3.3, tiefgangM: 1.75, verdraengungT: 4.2, segelflaecheM2: 51, motorPS: 19 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 33i", baujahrAb: 2009, loaM: 9.96, lwlM: 8.7, breiteM: 3.34, tiefgangM: 1.9, verdraengungT: 4.95, segelflaecheM2: 54, motorPS: 21 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 34", baujahrAb: 2014, loaM: 10.34, lwlM: 9.4, breiteM: 3.44, tiefgangM: 2, verdraengungT: 5.4, segelflaecheM2: 57, motorPS: 21 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 349", baujahrAb: 2014, loaM: 10.34, lwlM: 9.4, breiteM: 3.44, tiefgangM: 2, verdraengungT: 5.4, segelflaecheM2: 57, motorPS: 21 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 36i", baujahrAb: 2006, loaM: 10.94, lwlM: 9.55, breiteM: 3.59, tiefgangM: 1.94, verdraengungT: 5.7, segelflaecheM2: 62, motorPS: 29 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 379", baujahrAb: 2011, loaM: 11.34, lwlM: 10.3, breiteM: 3.76, tiefgangM: 2.1, verdraengungT: 6.6, segelflaecheM2: 66, motorPS: 29 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 380", baujahrAb: 2020, loaM: 11.22, lwlM: 10.55, breiteM: 3.76, tiefgangM: 2, verdraengungT: 7, segelflaecheM2: 71, motorPS: 40 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 39i", baujahrAb: 2006, loaM: 11.86, lwlM: 10.55, breiteM: 3.96, tiefgangM: 1.95, verdraengungT: 7, segelflaecheM2: 71, motorPS: 40 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 409", baujahrAb: 2010, loaM: 12.34, lwlM: 11.35, breiteM: 3.99, tiefgangM: 2.1, verdraengungT: 8, segelflaecheM2: 75, motorPS: 40 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 410", baujahrAb: 2018, loaM: 12.35, lwlM: 11.47, breiteM: 3.99, tiefgangM: 2.14, verdraengungT: 7.9, segelflaecheM2: 77.1, motorPS: 40, geprueft: true },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 419", baujahrAb: 2011, loaM: 12.76, lwlM: 11.65, breiteM: 3.99, tiefgangM: 2.1, verdraengungT: 8, segelflaecheM2: 78, motorPS: 45 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 42i", baujahrAb: 2007, loaM: 12.85, lwlM: 11.3, breiteM: 4.13, tiefgangM: 2.13, verdraengungT: 8.3, segelflaecheM2: 82, motorPS: 54 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 439", baujahrAb: 2011, loaM: 13.39, lwlM: 12.1, breiteM: 4.24, tiefgangM: 2.2, verdraengungT: 9.9, segelflaecheM2: 90, motorPS: 54 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 440", baujahrAb: 2017, loaM: 13.39, lwlM: 12.6, breiteM: 4.29, tiefgangM: 2.2, verdraengungT: 10.3, segelflaecheM2: 94, motorPS: 45 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 449", baujahrAb: 2013, loaM: 13.76, lwlM: 12.6, breiteM: 4.24, tiefgangM: 2.2, verdraengungT: 10.3, segelflaecheM2: 96, motorPS: 54 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 479", baujahrAb: 2012, loaM: 14.43, lwlM: 13.05, breiteM: 4.49, tiefgangM: 2.24, verdraengungT: 12, segelflaecheM2: 105, motorPS: 75 },
  { hersteller: "Jeanneau", modell: "Sun Odyssey 490", baujahrAb: 2018, loaM: 14.42, lwlM: 13, breiteM: 4.49, tiefgangM: 2.24, verdraengungT: 13, segelflaecheM2: 110, motorPS: 80 },
  { hersteller: "Najad", modell: "361", baujahrAb: 1998, loaM: 11.2, lwlM: 9.2, breiteM: 3.62, tiefgangM: 1.8, verdraengungT: 7, segelflaecheM2: 63, motorPS: 29 },
  { hersteller: "Najad", modell: "390", baujahrAb: 2002, loaM: 11.75, lwlM: 9.8, breiteM: 3.7, tiefgangM: 1.95, verdraengungT: 8, segelflaecheM2: 70, motorPS: 40 },
  { hersteller: "Najad", modell: "400", baujahrAb: 2007, loaM: 12.2, lwlM: 10.1, breiteM: 3.8, tiefgangM: 2.05, verdraengungT: 9, segelflaecheM2: 78, motorPS: 55 },
  { hersteller: "Sunbeam", modell: "34", baujahrAb: 2000, loaM: 10.3, lwlM: 8.8, breiteM: 3.48, tiefgangM: 1.85, verdraengungT: 5.5, segelflaecheM2: 58, motorPS: 29 },
  { hersteller: "Sunbeam", modell: "36.1", baujahrAb: 2010, loaM: 10.8, lwlM: 9.3, breiteM: 3.59, tiefgangM: 2, verdraengungT: 6, segelflaecheM2: 64, motorPS: 29 },
  { hersteller: "Sunbeam", modell: "40.1", baujahrAb: 2015, loaM: 12.4, lwlM: 10.7, breiteM: 3.9, tiefgangM: 2.15, verdraengungT: 8, segelflaecheM2: 76, motorPS: 40 },
  { hersteller: "X-Yachts", modell: "Xc 35", baujahrAb: 2014, loaM: 10.36, lwlM: 9.1, breiteM: 3.81, tiefgangM: 1.9, verdraengungT: 6.4, segelflaecheM2: 60, motorPS: 29 },
  { hersteller: "X-Yachts", modell: "Xc 38", baujahrAb: 2010, loaM: 11.58, lwlM: 10.15, breiteM: 3.81, tiefgangM: 2, verdraengungT: 7.5, segelflaecheM2: 70, motorPS: 40 },
  { hersteller: "X-Yachts", modell: "Xc 42", baujahrAb: 2008, loaM: 12.81, lwlM: 11.2, breiteM: 4.12, tiefgangM: 2.1, verdraengungT: 9, segelflaecheM2: 80, motorPS: 40 },
];

export function typName(t: Yachttyp): string {
  return t.hersteller + ' ' + t.modell;
}

export function typFinden(name: string): Yachttyp | undefined {
  const gesucht = name.trim().toLowerCase();
  return YACHTTYPEN.find((t) => typName(t).toLowerCase() === gesucht);
}
