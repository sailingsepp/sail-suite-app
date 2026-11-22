export interface Spanne { min: number; typisch: number; max: number }

export interface KraftstoffKlasse {
  id: string;
  laengeM: readonly [number, number];
  laengeFt: readonly [number, number];
  motorPS: readonly [number, number];

  verbrauchLh: { langsam: Spanne; reise: Spanne; hoch: Spanne };
  tankL: Spanne;
}

export interface KraftstoffModell {
  hersteller: string;
  modell: string;
  loaM: number;
  verdraengungKg?: number;
  tankL: number;
  motorPS: readonly number[];
  quelle: string;

  namen?: readonly string[];

  verbrauchLh?: number;
  verbrauchHerkunft?: string;
}

export const KRAFTSTOFF_KLASSEN: readonly KraftstoffKlasse[] = [
  {
    "id": "sailing_27_31ft",
    "laengeM": [
      8.2,
      9.4
    ],
    "laengeFt": [
      27,
      31
    ],
    "motorPS": [
      14,
      21
    ],
    "verbrauchLh": {
      "langsam": {
        "min": 0.5,
        "typisch": 1,
        "max": 1.5
      },
      "reise": {
        "min": 1.2,
        "typisch": 1.8,
        "max": 2.5
      },
      "hoch": {
        "min": 2.5,
        "typisch": 3.7,
        "max": 5
      }
    },
    "tankL": {
      "min": 40,
      "typisch": 70,
      "max": 100
    }
  },
  {
    "id": "sailing_32_35ft",
    "laengeM": [
      9.5,
      10.7
    ],
    "laengeFt": [
      32,
      35
    ],
    "motorPS": [
      18,
      30
    ],
    "verbrauchLh": {
      "langsam": {
        "min": 0.7,
        "typisch": 1.2,
        "max": 1.8
      },
      "reise": {
        "min": 1.5,
        "typisch": 2.2,
        "max": 3
      },
      "hoch": {
        "min": 3,
        "typisch": 4.5,
        "max": 6
      }
    },
    "tankL": {
      "min": 70,
      "typisch": 120,
      "max": 160
    }
  },
  {
    "id": "sailing_36_39ft",
    "laengeM": [
      11,
      11.9
    ],
    "laengeFt": [
      36,
      39
    ],
    "motorPS": [
      27,
      40
    ],
    "verbrauchLh": {
      "langsam": {
        "min": 0.8,
        "typisch": 1.4,
        "max": 2
      },
      "reise": {
        "min": 2,
        "typisch": 2.7,
        "max": 3.5
      },
      "hoch": {
        "min": 4,
        "typisch": 5.5,
        "max": 7
      }
    },
    "tankL": {
      "min": 100,
      "typisch": 150,
      "max": 200
    }
  },
  {
    "id": "sailing_40_43ft",
    "laengeM": [
      12.2,
      13.1
    ],
    "laengeFt": [
      40,
      43
    ],
    "motorPS": [
      40,
      57
    ],
    "verbrauchLh": {
      "langsam": {
        "min": 1,
        "typisch": 1.7,
        "max": 2.5
      },
      "reise": {
        "min": 2.5,
        "typisch": 3.5,
        "max": 4.5
      },
      "hoch": {
        "min": 5,
        "typisch": 7,
        "max": 9
      }
    },
    "tankL": {
      "min": 120,
      "typisch": 180,
      "max": 240
    }
  },
  {
    "id": "sailing_44_47ft",
    "laengeM": [
      13.4,
      14.3
    ],
    "laengeFt": [
      44,
      47
    ],
    "motorPS": [
      54,
      75
    ],
    "verbrauchLh": {
      "langsam": {
        "min": 1.5,
        "typisch": 2.2,
        "max": 3
      },
      "reise": {
        "min": 3,
        "typisch": 4.5,
        "max": 6
      },
      "hoch": {
        "min": 6,
        "typisch": 8.5,
        "max": 11
      }
    },
    "tankL": {
      "min": 150,
      "typisch": 220,
      "max": 300
    }
  },
  {
    "id": "sailing_48_52ft",
    "laengeM": [
      14.6,
      15.9
    ],
    "laengeFt": [
      48,
      52
    ],
    "motorPS": [
      75,
      110
    ],
    "verbrauchLh": {
      "langsam": {
        "min": 2,
        "typisch": 3,
        "max": 4
      },
      "reise": {
        "min": 4,
        "typisch": 5.5,
        "max": 7
      },
      "hoch": {
        "min": 8,
        "typisch": 11,
        "max": 14
      }
    },
    "tankL": {
      "min": 180,
      "typisch": 280,
      "max": 400
    }
  }
];

export const KRAFTSTOFF_MODELLE: readonly KraftstoffModell[] = [
  {
    "hersteller": "Bavaria",
    "modell": "Cruiser 34",
    "loaM": 9.99,
    "verdraengungKg": 5298,
    "tankL": 135,
    "motorPS": [],
    "quelle": "https://www.bavariayachts.com/de-de/segelyachten/cruiser-34/daten-und-optionen/"
  },
  {
    "hersteller": "Bavaria",
    "modell": "Cruiser 37",
    "loaM": 11.3,
    "verdraengungKg": 7450,
    "tankL": 135,
    "motorPS": [],
    "quelle": "https://www.bavariayachts.com/sailing-yachts/cruiser-37/data-and-options/"
  },
  {
    "hersteller": "Jeanneau",
    "modell": "Sun Odyssey 349",
    "loaM": 10.34,
    "verdraengungKg": 5340,
    "tankL": 130,
    "motorPS": [
      21
    ],
    "quelle": "https://www.jeanneau.com/boats/sailboat/2-sun-odyssey/37-sun-odyssey-349",
    "namen": [
      "Sun Odyssey 34"
    ],
    "verbrauchLh": 2,
    "verbrauchHerkunft": "user_reported_average"
  },
  {
    "hersteller": "Jeanneau",
    "modell": "Sun Odyssey 440",
    "loaM": 13,
    "verdraengungKg": 8561,
    "tankL": 200,
    "motorPS": [],
    "quelle": "https://app.jeanneau.com/inventory/22579"
  },
  {
    "hersteller": "Beneteau",
    "modell": "Oceanis 30.1",
    "loaM": 9.53,
    "verdraengungKg": 4120,
    "tankL": 130,
    "motorPS": [
      15,
      21
    ],
    "quelle": "https://www.beneteau.com/oceanis/oceanis-301"
  },
  {
    "hersteller": "Beneteau",
    "modell": "Oceanis 34.1",
    "loaM": 10.77,
    "verdraengungKg": 5470,
    "tankL": 130,
    "motorPS": [
      30
    ],
    "quelle": "https://www.beneteau.com/oceanis/oceanis-341"
  },
  {
    "hersteller": "Beneteau",
    "modell": "Oceanis 46.1",
    "loaM": 14.6,
    "tankL": 200,
    "motorPS": [
      57,
      80
    ],
    "quelle": "https://www.beneteau.hr/media/c3mieotp/v12701_oceanis_46-1_en_light.pdf"
  },
  {
    "hersteller": "Elan",
    "modell": "Impression 40.1",
    "loaM": 11.99,
    "verdraengungKg": 8250,
    "tankL": 146,
    "motorPS": [
      29,
      45
    ],
    "quelle": "https://www.elan-yachts.com/tr/yacht-lines/impression-line/elan-impression-401"
  },
  {
    "hersteller": "Elan",
    "modell": "Impression 45",
    "loaM": 13.6,
    "verdraengungKg": 11100,
    "tankL": 287,
    "motorPS": [
      45,
      57,
      80
    ],
    "quelle": "https://www.elan-yachts.com/en/yacht-lines/impression-line/elan-impression-45"
  },
  {
    "hersteller": "Elan",
    "modell": "Impression 45.1",
    "loaM": 13.51,
    "verdraengungKg": 10790,
    "tankL": 215,
    "motorPS": [
      45,
      57
    ],
    "quelle": "https://www.elan-yachts.com/en/yacht-lines/impression-line/elan-impression-451"
  },
  {
    "hersteller": "Elan",
    "modell": "Impression 50.1",
    "loaM": 15.18,
    "verdraengungKg": 12660,
    "tankL": 255,
    "motorPS": [
      80
    ],
    "quelle": "https://www.elan-yachts.com/en/yacht-lines/impression-line"
  }
];

export const NUTZBARER_TANKANTEIL = 0.8;
