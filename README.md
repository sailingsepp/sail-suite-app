# Sail-Suite

Source code of the web apps at [sail-suite.app](https://sail-suite.app): four tools for a
sailing voyage in the Mediterranean, bilingual (German/English), installable as PWAs for
use at sea without a connection.

| App | Version | Purpose |
|---|---|---|
| **VoyagePlan** · Törnplanung | 5.1.11 | Plans the whole voyage: which harbour on which day |
| **CourseCast** · Tagesplanung | 5.7.1 | Daily weather briefing for a fixed route: when to cast off, what to expect on the way |
| **SailPilot** · TörnNavLog | 6.2.0 | Automatic logbook and backup navigation on the phone already on board |
| **VoyageBook** · TörnBuch | 5.1.9 | Voyage, crew list, crew kitty, statistics and PDFs |

A fifth page, `stream/`, lets people at home follow a shared voyage read-only.

## What is in this repository

| Path | Contents |
|---|---|
| `index.html` | Landing page |
| `coursecast/`, `trackbook/`, `voyagebook/`, `voyageplan/`, `stream/` | HTML shell of each app |
| `src/core/` | Computation without DOM or network: geometry, polars, VMG, current triangle, pressure fields, astronomy and tides, voyage search |
| `src/briefing/` | Text generation for the briefings, purely functional |
| `src/data/` | Data retrieval and on-device storage |
| `src/map/` | Map layers and symbols |
| `src/apps/<app>/` | Entry point and views of each app |
| `src/shell/`, `src/ui/` | Code shared by all apps: session, language, theme, menus, compendium |
| `src/kompendium/` | Offline nautical compendium |
| `public/` | Icons, start images, service workers, static headers |

The apps rely on a server of their own at `api.sail-suite.app` for accounts and sync, voyage
and crew data, the shared track store, official marine weather reports, AIS and station
readings. That server is not part of this repository.

## Getting started

Requirements: [Node.js](https://nodejs.org/) 22 or later and npm.

```bash
git clone https://github.com/sailingsepp/sail-suite-app.git
cd sail-suite-app
npm ci
npm run dev        # development server at http://localhost:5173
```

| Command | Result |
|---|---|
| `npm run dev` | Development server with hot reload; the apps are at `/coursecast/`, `/trackbook/`, `/voyagebook/`, `/voyageplan/` |
| `npm run build` | Type check (`tsc`) and production build into `dist/` |
| `npm run preview` | Serves the build from `dist/` locally |
| `npm run lint` | ESLint over `src/` |

A local build has two limits:

- **Server features.** Everything that goes through `api.sail-suite.app` (sign-in, stored
  voyages, crew, official reports, AIS, stations, radar) needs that server and an account.
  Weather and sea data from Open-Meteo, maps, tides and all calculations run in the browser.
- **Boat polars.** The polar tables of the yacht models come from third parties whose terms do
  not allow redistribution. They are left empty here, so boat speeds in a local build are zero.

## Data and libraries

Weather and sea state: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0) and the
[Copernicus Marine Service](https://marine.copernicus.eu/). Maps and harbour data:
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL) and
[OpenSeaMap](https://www.openseamap.org/). Depth: [EMODnet Bathymetry](https://emodnet.ec.europa.eu/).
Sea areas and boundaries: [Marine Regions / VLIZ](https://www.marineregions.org/). Tides:
TICON-4 tide-gauge constants (DGFI-TUM, CC BY 4.0 / CC BY-NC 4.0 per gauge). The full list of
sources with their licences is in each app under "Data sources & licences".

Libraries: [Leaflet](https://leafletjs.com/), [jsPDF](https://github.com/parallax/jsPDF),
[PDF.js](https://mozilla.github.io/pdf.js/),
[`@neaps/tide-predictor`](https://github.com/neaps/tide-predictor),
[Piper](https://github.com/rhasspy/piper) via
[`@diffusionstudio/vits-web`](https://github.com/diffusionstudio/vits-web), the
[Inter](https://rsms.me/inter/) typeface (SIL OFL 1.1).

## Licence

© 2026 Sepp, Austria. All rights reserved. The code is published for reading and review; it
may not be used, copied or redistributed without written permission. See [LICENSE](LICENSE).

## Disclaimer

This software is not a substitute for an official marine weather forecast, a nautical chart or
a legally required logbook. All figures are model-based and carry uncertainty. The decision to
sail rests with the skipper.
